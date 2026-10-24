"""통합 테스트 — 실제 서비스 코드 + SQLite DB."""
import math

import pytest

from app.services.forecast_service import ForecastService
from app.services.replenishment_service import ReplenishmentService, SERVICE_Z


async def test_forecast_returns_14_points(db):
    fc = await ForecastService.get_item_forecast(db, "p07", "WH-ASAN")
    assert fc.item_name == "삼겹살 600g"
    assert len(fc.forecasts) == 14


async def test_forecast_weekday_pattern(db):
    fc = await ForecastService.get_item_forecast(db, "p07")
    by_wd = {p.target_date.weekday(): p.yhat for p in fc.forecasts}
    # 같은 base에 요일계수만 곱하므로 일(6) > 월(0)
    assert by_wd[6] > by_wd[0]


async def test_forecast_band_and_version(db):
    fc = await ForecastService.get_item_forecast(db, "p07")
    for p in fc.forecasts:
        assert p.yhat_p10 <= p.yhat <= p.yhat_p90
        assert p.model_version == "dow-seasonal-v1"


async def test_forecast_unknown_item_raises(db):
    with pytest.raises(ValueError):
        await ForecastService.get_item_forecast(db, "NOPE")


async def test_run_batch_persists_and_reads_back(db):
    n = await ForecastService.run_batch_forecast(db, "WH-ASAN")
    assert n == 14  # 품목 1 × 14일
    fc = await ForecastService.get_item_forecast(db, "p07")
    assert len(fc.forecasts) == 14


async def test_recommendation_uses_computed_safety_stock(db):
    recs = await ReplenishmentService.get_or_generate_recommendations(db, "WH-ASAN")
    assert len(recs) == 1
    r = recs[0]
    assert r.item_id == "p07"
    # 고정상수 8이 아니라 z·√(리드수요)로 산출돼야 함
    assert r.safety_stock != 8.0
    assert r.safety_stock > 0
    assert "서비스수준 95%" in (r.reason or "")
    # 발주배수(10) 올림
    assert r.recommended_qty % 10 == 0


async def test_recommendation_idempotent(db):
    r1 = await ReplenishmentService.get_or_generate_recommendations(db)
    r2 = await ReplenishmentService.get_or_generate_recommendations(db)
    assert [x.rec_id for x in r1] == [x.rec_id for x in r2]


async def test_full_replenishment_flow(db):
    recs = await ReplenishmentService.get_or_generate_recommendations(db)
    rec = recs[0]
    await ReplenishmentService.update_recommendation_action(db, rec.rec_id, "approve", None)
    po = await ReplenishmentService.create_purchase_order_from_approved(db, "s2", "WH-ASAN")
    assert po.status == "ordered"
    assert len(po.lines) == 1
    qty = po.lines[0].order_qty
    res = await ReplenishmentService.receive_purchase_order(
        db, po.po_id, [{"line_no": 1, "received_qty": qty, "expiry_date": None}]
    )
    assert res["new_status"] == "received"
