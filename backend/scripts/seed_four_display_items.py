import asyncio
from datetime import date, timedelta, datetime
from app.core.database import AsyncSessionLocal
from app.models.master import Item, SupplyTerm, Supplier
from app.models.inventory import InventoryBatch
from app.models.purchases import OrderRecommendation
from sqlalchemy import select, delete

async def seed():
    today = date.today()
    warehouse_id = "WH-ASAN"

    async with AsyncSessionLocal() as session:
        print("Inserting / Updating 4 display items...")

        items_data = [
            {
                "item_id": "milk",
                "item_name": "신선한 아침 우유 1L",
                "category_l": "유제품",
                "uom": "개",
                "sale_price": 2900,
                "cost_price": 2100,
                "safety_stock": 20.0,
                "pack_size": 1.0,
                "shelf_life_days": 10,
                "supplier_id": "s3",
                "lead_time_days": 1,
            },
            {
                "item_id": "egg",
                "item_name": "동물복지 유정란 10구",
                "category_l": "신선식품",
                "uom": "팩",
                "sale_price": 6500,
                "cost_price": None, # None displays as '미제공'
                "safety_stock": 8.0,
                "pack_size": 1.0,
                "shelf_life_days": 14,
                "supplier_id": "s1",
                "lead_time_days": 1,
            },
            {
                "item_id": "bread",
                "item_name": "통밀 식빵",
                "category_l": "가공식품",
                "uom": "개",
                "sale_price": 3800,
                "cost_price": 2500,
                "safety_stock": 10.0,
                "pack_size": 1.0,
                "shelf_life_days": 7,
                "supplier_id": "s4",
                "lead_time_days": 1,
            },
            {
                "item_id": "water",
                "item_name": "맑은 샘물 2L",
                "category_l": "음료",
                "uom": "병",
                "sale_price": 1000,
                "cost_price": 600,
                "safety_stock": 24.0,
                "pack_size": 1.0,
                "shelf_life_days": 365,
                "supplier_id": "s5",
                "lead_time_days": 3,
            },
        ]

        for data in items_data:
            item_cols = {k: v for k, v in data.items() if k not in ["supplier_id", "lead_time_days"]}
            item = await session.get(Item, data["item_id"])
            if not item:
                item = Item(**item_cols)
                session.add(item)
            else:
                for k, v in item_cols.items():
                    setattr(item, k, v)
        await session.flush()

        # Supply Terms
        for data in items_data:
            st = await session.get(SupplyTerm, (data["item_id"], data["supplier_id"]))
            if not st:
                st = SupplyTerm(
                    item_id=data["item_id"],
                    supplier_id=data["supplier_id"],
                    is_primary=True,
                    lead_time_days=data["lead_time_days"],
                    unit_cost=data["cost_price"] or 0,
                    moq=1.0,
                    order_multiple=1.0
                )
                session.add(st)
            else:
                st.is_primary = True
                st.unit_cost = data["cost_price"] or 0
                st.lead_time_days = data["lead_time_days"]

        await session.flush()

        # Inventory Batches
        # Delete existing batches for these 4 items
        await session.execute(delete(InventoryBatch).where(InventoryBatch.item_id.in_(["milk", "egg", "bread", "water"])))
        
        # 1. Milk: 8 units (not expiring soon -> e.g. today + 10 days) -> Total 8 < safety 20 -> status: low
        session.add(InventoryBatch(
            batch_id="batch-milk",
            item_id="milk",
            warehouse_id=warehouse_id,
            expiry_date=today + timedelta(days=10),
            qty=8.0,
            received_date=today - timedelta(days=2)
        ))

        # 2. Egg: 12 units (expiring soon -> today + 2 days, D-2 <= 3 days) -> status: expiring
        session.add(InventoryBatch(
            batch_id="batch-egg",
            item_id="egg",
            warehouse_id=warehouse_id,
            expiry_date=today + timedelta(days=2),
            qty=12.0,
            received_date=today - timedelta(days=5)
        ))

        # 3. Bread: 0 units -> status: out
        # (no batches added)

        # 4. Water: 60 units (safety 24, so 60 >= 24 * 2.5) -> overstock
        session.add(InventoryBatch(
            batch_id="batch-water",
            item_id="water",
            warehouse_id=warehouse_id,
            expiry_date=today + timedelta(days=180),
            qty=60.0,
            received_date=today - timedelta(days=10)
        ))

        await session.flush()

        # Order Recommendations
        recs_data = [
            {
                "rec_id": "rec-milk",
                "recommend_date": today,
                "item_id": "milk",
                "warehouse_id": warehouse_id,
                "supplier_id": "s3",
                "current_stock": 8.0,
                "forecast_demand": 36.0,
                "safety_stock": 20.0,
                "recommended_qty": 30.0,
                "status": "draft",
                "reason": "데모 예측: 주말 예상 판매 36개와 납기 1일을 고려한 추천입니다.",
            },
            {
                "rec_id": "rec-bread",
                "recommend_date": today,
                "item_id": "bread",
                "warehouse_id": warehouse_id,
                "supplier_id": "s4",
                "current_stock": 0.0,
                "forecast_demand": 18.0,
                "safety_stock": 10.0,
                "recommended_qty": 20.0,
                "status": "draft",
                "reason": "현재 재고가 0개(품절)이므로 긴급 보충 발주가 필요합니다.",
            },
            {
                "rec_id": "rec-water",
                "recommend_date": today,
                "item_id": "water",
                "warehouse_id": warehouse_id,
                "supplier_id": "s5",
                "current_stock": 60.0,
                "forecast_demand": 15.0,
                "safety_stock": 24.0,
                "recommended_qty": 10.0,
                "status": "draft",
                "reason": "리드타임(3일) 예상수요 15병 대비 과잉 재고 상태이나 최소 발주 배수 적용.",
            }
        ]

        for rdata in recs_data:
            rec = await session.get(OrderRecommendation, rdata["rec_id"])
            if not rec:
                rec = OrderRecommendation(**rdata)
                session.add(rec)
            else:
                for k, v in rdata.items():
                    setattr(rec, k, v)

        await session.commit()
        print("Successfully seeded milk, egg, bread, water!")

if __name__ == "__main__":
    asyncio.run(seed())
