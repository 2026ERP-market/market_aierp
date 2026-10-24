import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from app.main import app

async def test_automation():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Reset to OFF first
        curr = (await client.get("/api/v1/automation/settings?warehouse_id=WH-ASAN")).json()
        if curr["enabled"]:
            await client.put("/api/v1/automation/settings", json={
                "warehouse_id": "WH-ASAN",
                "enabled": False,
                "expected_version": curr["version"],
                "agreed_by": "STORE_OWNER",
                "policy_version": "v1"
            })

        print("\n--- 1. Testing GET /api/v1/automation/settings ---")
        res = await client.get("/api/v1/automation/settings?warehouse_id=WH-ASAN")
        print("Status:", res.status_code)
        settings = res.json()
        print("Settings:", settings)
        assert res.status_code == 200
        assert settings["warehouse_id"] == "WH-ASAN"
        assert settings["enabled"] is False
        assert settings["version"] >= 1

        print("\n--- 2. Testing PUT /api/v1/automation/settings with version conflict ---")
        conflict_res = await client.put("/api/v1/automation/settings", json={
            "warehouse_id": "WH-ASAN",
            "enabled": True,
            "expected_version": settings["version"] + 999,
            "agreed_by": "STORE_OWNER",
            "policy_version": "v1"
        })
        print("Conflict status:", conflict_res.status_code, conflict_res.json())
        assert conflict_res.status_code == 409

        print("\n--- 3. Testing PUT /api/v1/automation/settings (ON) ---")
        on_res = await client.put("/api/v1/automation/settings", json={
            "warehouse_id": "WH-ASAN",
            "enabled": True,
            "expected_version": settings["version"],
            "agreed_by": "STORE_OWNER",
            "policy_version": "v1"
        })
        print("ON status:", on_res.status_code)
        on_data = on_res.json()
        print("ON data:", on_data)
        assert on_res.status_code == 200
        assert on_data["enabled"] is True
        assert on_data["version"] == settings["version"] + 1

        print("\n--- 4. Testing GET /api/v1/automation/runs ---")
        runs_res = await client.get("/api/v1/automation/runs?warehouse_id=WH-ASAN")
        print("Runs status:", runs_res.status_code)
        runs_data = runs_res.json()
        print("Total runs recorded:", len(runs_data["runs"]))
        for r in runs_data["runs"][:5]:
            print(f" - [{r['status']}] {r['product_name']}: {r['final_qty']}개 (Reason: {r['reason']}, PO: {r.get('order_id')})")
        assert runs_res.status_code == 200

        print("\n--- 5. Testing GET /api/v1/purchases/orders (verify source=automation) ---")
        orders_res = await client.get("/api/v1/purchases/orders")
        assert orders_res.status_code == 200
        orders = orders_res.json()
        auto_orders = [o for o in orders if o.get("source") == "automation"]
        print(f"Orders count: {len(orders)}, Automation orders: {len(auto_orders)}")
        if auto_orders:
            first_auto = auto_orders[0]
            print(f"Sample auto order: {first_auto['po_id']}, lines: {len(first_auto['lines'])}, total: {first_auto['total_amount']:,} KRW, source: {first_auto['source']}")

        print("\n--- 6. Testing PUT /api/v1/automation/settings (OFF) ---")
        off_res = await client.put("/api/v1/automation/settings", json={
            "warehouse_id": "WH-ASAN",
            "enabled": False,
            "expected_version": on_data["version"],
            "agreed_by": "STORE_OWNER",
            "policy_version": "v1"
        })
        print("OFF status:", off_res.status_code)
        off_data = off_res.json()
        assert off_res.status_code == 200
        assert off_data["enabled"] is False

        print("\n ALL AUTOMATION BACKEND TESTS PASSED SUCCESSFULLY! ")

if __name__ == "__main__":
    asyncio.run(test_automation())
