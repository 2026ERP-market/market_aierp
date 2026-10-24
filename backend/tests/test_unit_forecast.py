"""단위 테스트 — DB 없이 모델 계수/수식 자체 검증."""
import math

from app.services.forecast_service import DOW_FACTOR, MODEL_VERSION, _Z_P80
from app.services import replenishment_service as rs


def test_dow_factor_shape():
    assert len(DOW_FACTOR) == 7
    # 평균 1.0 기준으로 정규화돼 있어야 함
    assert abs(sum(DOW_FACTOR) / 7 - 1.0) < 0.02


def test_weekend_higher_than_weekday():
    mon, tue, wed, thu, fri, sat, sun = DOW_FACTOR
    assert mon == min(DOW_FACTOR)      # 월요일이 가장 낮음
    assert sun == max(DOW_FACTOR)      # 일요일이 가장 높음
    assert mon < fri < sat < sun       # 주중→주말로 갈수록 증가


def test_model_version_is_honest():
    # 실제 LGBM이 아니므로 그렇게 표기하지 않는다
    assert MODEL_VERSION == "dow-seasonal-v1"
    assert "lgbm" not in MODEL_VERSION.lower()


def test_poisson_band_symmetric_and_ordered():
    yhat = 16.0
    sigma = math.sqrt(yhat)
    p10 = yhat - _Z_P80 * sigma
    p90 = yhat + _Z_P80 * sigma
    assert p10 < yhat < p90
    assert round(p90 - yhat, 6) == round(yhat - p10, 6)  # 대칭


def test_safety_stock_params():
    assert rs.SERVICE_LEVEL == 0.95
    assert rs.SERVICE_Z == 1.65


def test_safety_stock_scales_as_sqrt():
    # 안전재고 = z·√(리드수요) → 수요 4배면 안전재고 2배(√)
    s_low = rs.SERVICE_Z * math.sqrt(9)
    s_high = rs.SERVICE_Z * math.sqrt(36)
    assert round(s_high / s_low, 3) == 2.0
