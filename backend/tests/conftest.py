"""
테스트 공통 설정.
- 운영 Postgres 대신 SQLite(aiosqlite)로 테이블을 만들어 실제 서비스/엔드포인트를 돌린다.
- fixtures: db(세션), client(FastAPI E2E), 그리고 공통 시드 데이터.
"""
import random
from datetime import date, timedelta

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from sqlalchemy import Integer

from app.core.database import Base, get_db
import app.models  # noqa: F401  모든 모델을 메타데이터에 등록
from app.models.features import Forecast
from app.models.inventory import InventoryBatch
from app.models.master import Item, Supplier, SupplyTerm, Warehouse
from app.models.sales import Sales

# --- SQLite 전용 제약 보정 (Postgres 운영에는 영향 없음, 테스트 프로세스 한정) ---
# 1) 복합PK의 autoincrement 미지원 → 끄고 id를 직접 주입한다.
Sales.__table__.c.id.autoincrement = False
Sales.__table__.c.id.nullable = False
# 2) BigInteger 단일PK는 SQLite에서 rowid 자동증가가 안 됨 → INTEGER로 보정.
Forecast.__table__.c.forecast_id.type = Integer()

TODAY = date.today()


async def seed(session: AsyncSession) -> None:
    session.add(Warehouse(warehouse_id="WH-ASAN", warehouse_name="아산점", region_code="KR-ASAN"))
    session.add(Supplier(supplier_id="s2", supplier_name="한우리 축산", lead_time_days=1, min_order_amount=100000))
    session.add(Item(item_id="p07", item_name="삼겹살 600g", category_l="정육·계란", uom="팩",
                     pack_size=10, cost_price=9800, sale_price=13900, shelf_life_days=5, safety_stock=8))
    session.add(SupplyTerm(item_id="p07", supplier_id="s2", is_primary=True, lead_time_days=1,
                           moq=10, order_multiple=10, unit_cost=9800))
    session.add(InventoryBatch(batch_id="B-p07-1", item_id="p07", warehouse_id="WH-ASAN",
                               expiry_date=TODAY + timedelta(days=3), qty=12, received_date=TODAY - timedelta(days=1)))
    random.seed(42)
    sid = 0
    for off in range(30, 0, -1):
        d = TODAY - timedelta(days=off)
        mult = random.uniform(1.2, 1.6) if d.weekday() in (4, 5, 6) else random.uniform(0.8, 1.1)
        q = round(10 * mult, 1)
        sid += 1
        session.add(Sales(sale_date=d, id=sid, order_id=f"SO-{d:%y%m%d}-p07", item_id="p07",
                          warehouse_id="WH-ASAN", channel="offline", qty=q,
                          unit_price=13900, amount=int(q * 13900)))
    await session.commit()


@pytest_asyncio.fixture
async def _engine(tmp_path):
    eng = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'test.sqlite'}")
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(bind=eng, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        await seed(s)
    yield eng, factory
    await eng.dispose()


@pytest_asyncio.fixture
async def db(_engine):
    _, factory = _engine
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(_engine):
    _, factory = _engine
    from app.main import app

    async def _override_get_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
