import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def migrate_and_clean_db():
    print("🚀 [MIGRATION] Starting schema migration and decimal quantity cleanup...")

    async with AsyncSessionLocal() as session:
        # 1. Add columns to purchase_orders
        print("1. Updating purchase_orders table schema...")
        alter_orders = [
            "ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;",
            "ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rec_id VARCHAR(50);",
            "ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rec_model_version VARCHAR(50);",
            "ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS memo TEXT;",
            "ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"
        ]
        for q in alter_orders:
            await session.execute(text(q))

        # 2. Add columns to purchase_order_lines
        print("2. Updating purchase_order_lines table schema...")
        alter_lines = [
            "ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS original_rec_qty NUMERIC(12, 3) DEFAULT 0 NOT NULL;",
            "ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS uom VARCHAR(20);",
            "ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS line_amount BIGINT DEFAULT 0 NOT NULL;"
        ]
        for q in alter_lines:
            await session.execute(text(q))

        # Backfill line_amount where 0
        await session.execute(text("UPDATE purchase_order_lines SET line_amount = CAST(order_qty * unit_cost AS BIGINT) WHERE line_amount = 0;"))
        await session.execute(text("UPDATE purchase_order_lines SET original_rec_qty = order_qty WHERE original_rec_qty = 0;"))

        # 3. Clean up decimal quantities in inventory_batches
        print("3. Rounding decimal quantities in inventory_batches to integers...")
        await session.execute(text("UPDATE inventory_batches SET qty = ROUND(qty) WHERE qty % 1 != 0;"))

        # 4. Clean up decimal quantities in inventory_daily
        print("4. Rounding decimal quantities in inventory_daily to integers...")
        await session.execute(text("UPDATE inventory_daily SET on_hand_qty = ROUND(on_hand_qty), available_qty = ROUND(available_qty) WHERE on_hand_qty % 1 != 0 OR available_qty % 1 != 0;"))

        # 5. Clean up decimal quantities in sales
        print("5. Rounding decimal quantities in sales to integers and recalculating amount...")
        await session.execute(text("UPDATE sales SET qty = ROUND(qty), amount = CAST(ROUND(qty) * unit_price AS BIGINT) WHERE qty % 1 != 0;"))

        # 6. Clean up decimal quantities in order_recommendations
        print("6. Rounding decimal quantities in order_recommendations...")
        await session.execute(text("UPDATE order_recommendations SET current_stock = ROUND(current_stock), safety_stock = CEIL(safety_stock), recommended_qty = ROUND(recommended_qty) WHERE current_stock % 1 != 0 OR safety_stock % 1 != 0 OR recommended_qty % 1 != 0;"))

        await session.commit()
        print("✅ [MIGRATION SUCCESS] Schema updated and all quantities cleaned to integers!")

        # 7. Verification check
        print("\n🔍 [VERIFICATION] Checking for remaining decimal quantities:")
        for t, col in [
            ('inventory_batches', 'qty'),
            ('inventory_daily', 'on_hand_qty'),
            ('sales', 'qty'),
            ('purchase_order_lines', 'order_qty'),
            ('purchase_order_lines', 'received_qty'),
            ('order_recommendations', 'current_stock'),
            ('order_recommendations', 'recommended_qty')
        ]:
            res = await session.execute(text(f"SELECT COUNT(*) FROM {t} WHERE {col} % 1 != 0"))
            cnt = res.scalar()
            print(f"   {t}.{col}: {cnt} rows with decimal parts (Expected: 0)")

if __name__ == "__main__":
    asyncio.run(migrate_and_clean_db())
