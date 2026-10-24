import asyncio
import httpx
from app.main import app

async def run_tests():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        print("\n--- 1. Testing Health Endpoint ---")
        res = await client.get("/health")
        print("Status:", res.status_code, res.json())
        assert res.status_code == 200

        print("\n--- 2. Testing Dashboard Summary ---")
        res = await client.get("/api/v1/dashboard/summary")
        print("Status:", res.status_code)
        data = res.json()
        print("Store:", data.get("store_name"))
        print("Today Revenue:", data.get("revenue"))
        print("Briefing:", data.get("briefing"))
        print("Todos Count:", len(data.get("todos", [])))
        assert res.status_code == 200

        print("\n--- 3. Testing Inventory Current ---")
        res = await client.get("/api/v1/inventory/current")
        print("Status:", res.status_code)
        inv = res.json()
        print("Total Products:", len(inv.get("products", [])))
        print("Total Stock Value:", f"{inv.get('total_stock_value'):,} KRW")
        print("Low Stock Count:", inv.get("low_stock_count"))
        assert res.status_code == 200

        print("\n--- 4. Testing AI Purchase Recommendations ---")
        res = await client.get("/api/v1/purchases/recommend")
        print("Status:", res.status_code)
        recs = res.json()
        print("Recommended Items Count:", len(recs))
        if recs:
            first = recs[0]
            print(f"Sample Rec: {first['item_name']} -> {first['recommended_qty']} {first['category']} (Amount: {first['order_amount']:,} KRW)")
            print(f"Reason: {first['reason']}")
        assert res.status_code == 200

        print("\n--- 5. Testing Forecast for Item (p10 - Milk) ---")
        res = await client.get("/api/v1/forecast/p10")
        print("Status:", res.status_code)
        fc = res.json()
        print("Item:", fc.get("item_name"))
        print("Forecast Points:", len(fc.get("forecasts", [])))
        assert res.status_code == 200

        print("\n--- 6. Testing Sales Summary ---")
        res = await client.get("/api/v1/sales/summary?days=14")
        print("Status:", res.status_code)
        sales = res.json()
        print("14-day Total Revenue:", f"{sales.get('total_revenue'):,} KRW")
        print("Top Categories:", [c['name'] for c in sales.get("categories", [])[:3]])
        assert res.status_code == 200

        print("\n--- 7. Testing Mobile AI Agent Chat ---")
        res = await client.post("/api/v1/agent/chat", json={"message": "우유 재고 얼마 남아있어?"})
        print("Status:", res.status_code)
        chat_res = res.json()
        print("AI Agent Reply:\n", chat_res.get("content"))
        print("Cards:", len(chat_res.get("cards", [])))
        assert res.status_code == 200

        print("\n ALL 7 TESTS PASSED SUCCESSFULLY! ")

if __name__ == "__main__":
    asyncio.run(run_tests())
