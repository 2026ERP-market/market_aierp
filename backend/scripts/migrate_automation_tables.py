import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        print("[MIGRATE] Updating purchase_orders table...")
        await conn.execute(text("""
            ALTER TABLE purchase_orders 
            ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
        """))
        await conn.execute(text("""
            ALTER TABLE purchase_orders 
            ADD COLUMN IF NOT EXISTS automation_run_id VARCHAR(50);
        """))
        await conn.execute(text("""
            ALTER TABLE purchase_orders 
            ADD COLUMN IF NOT EXISTS rec_id VARCHAR(50);
        """))
        await conn.execute(text("""
            ALTER TABLE purchase_orders 
            ADD COLUMN IF NOT EXISTS rec_model_version VARCHAR(50);
        """))

        print("[MIGRATE] Creating store_automation_settings table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS store_automation_settings (
                warehouse_id VARCHAR(30) PRIMARY KEY REFERENCES warehouses(warehouse_id),
                enabled BOOLEAN NOT NULL DEFAULT FALSE,
                version INTEGER NOT NULL DEFAULT 1,
                can_manage BOOLEAN NOT NULL DEFAULT TRUE,
                daily_budget_limit BIGINT DEFAULT 5000000,
                allowed_categories TEXT DEFAULT '[]',
                agreed_by VARCHAR(50),
                agreed_at TIMESTAMP WITH TIME ZONE,
                policy_version VARCHAR(20) NOT NULL DEFAULT 'v1',
                worker_status VARCHAR(20) NOT NULL DEFAULT 'idle',
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
        """))

        print("[MIGRATE] Creating automation_run_logs table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS automation_run_logs (
                run_id VARCHAR(50) PRIMARY KEY,
                warehouse_id VARCHAR(30) NOT NULL REFERENCES warehouses(warehouse_id),
                recommendation_id VARCHAR(50),
                item_id VARCHAR(30) NOT NULL REFERENCES items(item_id),
                item_name VARCHAR(100) NOT NULL,
                status VARCHAR(20) NOT NULL,
                original_qty NUMERIC(12, 3) NOT NULL,
                final_qty NUMERIC(12, 3) NOT NULL,
                reason TEXT,
                order_id VARCHAR(50),
                policy_version VARCHAR(20) NOT NULL DEFAULT 'v1',
                executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
        """))

        print("[MIGRATE] Seeding default setting for WH-ASAN if not present...")
        await conn.execute(text("""
            INSERT INTO store_automation_settings (warehouse_id, enabled, version, can_manage, daily_budget_limit, allowed_categories, policy_version, worker_status, updated_at)
            VALUES ('WH-ASAN', FALSE, 1, TRUE, 5000000, '[]', 'v1', 'idle', NOW())
            ON CONFLICT (warehouse_id) DO NOTHING;
        """))

        print("[MIGRATE] Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
