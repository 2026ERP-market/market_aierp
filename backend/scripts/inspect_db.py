import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.core.database import engine

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"))
        tables = [row[0] for row in res.fetchall()]
        print("Existing tables in public schema:")
        for t in tables:
            print(" -", t)

        # Check columns of purchase_orders
        res_cols = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='purchase_orders'"))
        print("\nColumns in purchase_orders:")
        for col, dtype in res_cols.fetchall():
            print(f" - {col}: {dtype}")

if __name__ == "__main__":
    asyncio.run(main())
