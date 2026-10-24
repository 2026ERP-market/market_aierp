"""E2E 테스트 — FastAPI 앱을 실제 HTTP로 호출 (DB는 SQLite로 오버라이드)."""


async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


async def test_root(client):
    r = await client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "online"


async def test_forecast_endpoint(client):
    r = await client.get("/api/v1/forecast/p07")
    assert r.status_code == 200
    data = r.json()
    assert data["item_id"] == "p07"
    assert len(data["forecasts"]) == 14
    assert data["forecasts"][0]["model_version"] == "dow-seasonal-v1"


async def test_forecast_unknown_returns_404(client):
    r = await client.get("/api/v1/forecast/NOPE")
    assert r.status_code == 404


async def test_run_batch_endpoint(client):
    r = await client.post("/api/v1/forecast/run-batch")
    assert r.status_code == 200
    assert r.json()["generated_forecast_points"] == 14


async def test_recommend_endpoint(client):
    r = await client.get("/api/v1/purchases/recommend")
    assert r.status_code == 200
    recs = r.json()
    assert len(recs) == 1
    assert "서비스수준 95%" in (recs[0]["reason"] or "")


async def test_items_endpoint(client):
    r = await client.get("/api/v1/items")
    assert r.status_code == 200
    assert any(it["item_id"] == "p07" for it in r.json())


async def test_full_po_flow_via_api(client):
    recs = (await client.get("/api/v1/purchases/recommend")).json()
    rec_id = recs[0]["rec_id"]

    a = await client.post(f"/api/v1/purchases/recommend/{rec_id}/action", json={"action": "approve"})
    assert a.status_code == 200

    po = await client.post("/api/v1/purchases/orders", params={"supplier_id": "s2"})
    assert po.status_code == 200
    po_id = po.json()["po_id"]

    recv = await client.post(
        f"/api/v1/purchases/orders/{po_id}/receive",
        json={"received_items": [{"line_no": 1, "received_qty": 30, "expiry_date": None}]},
    )
    assert recv.status_code == 200
    assert recv.json()["new_status"] == "received"
