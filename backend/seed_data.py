import asyncio
import random
from datetime import date, timedelta, datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
from app.models.master import Warehouse, Customer, Supplier, Item, SupplyTerm
from app.models.inventory import InventoryBatch, InventoryDaily
from app.models.sales import Sales
from app.models.features import WeatherForecast, Calendar, Promotion

# 5개 공급업체 (mock.ts 일치)
SUPPLIERS = [
    {"supplier_id": "s1", "supplier_name": "푸르메 농산", "lead_time_days": 1, "min_order_amount": 50000, "phone": "02-555-0101"},
    {"supplier_id": "s2", "supplier_name": "한우리 축산", "lead_time_days": 1, "min_order_amount": 100000, "phone": "02-555-0102"},
    {"supplier_id": "s3", "supplier_name": "서울우유 대리점", "lead_time_days": 1, "min_order_amount": 30000, "phone": "02-555-0103"},
    {"supplier_id": "s4", "supplier_name": "대한식품 도매", "lead_time_days": 2, "min_order_amount": 150000, "phone": "02-555-0104"},
    {"supplier_id": "s5", "supplier_name": "청량음료 유통", "lead_time_days": 3, "min_order_amount": 100000, "phone": "02-555-0105"},
]

# 24개 품목 및 로트 (mock.ts 일치)
PRODUCTS = [
    ("p01", "대파", "채소·과일", "단", 10.0, 8.0, 1800, 2500, "s1", [(6.0, 2), (4.0, 4)]),
    ("p02", "양파 1.5kg", "채소·과일", "망", 10.0, 10.0, 2400, 3500, "s1", [(18.0, 14)]),
    ("p03", "사과 5입", "채소·과일", "봉", 6.0, 6.0, 6500, 8900, "s1", [(3.0, 5)]),
    ("p04", "방울토마토 500g", "채소·과일", "팩", 8.0, 6.0, 3200, 4500, "s1", [(5.0, 1), (4.0, 3)]),
    ("p05", "시금치", "채소·과일", "단", 10.0, 6.0, 1500, 2200, "s1", [(2.0, 1)]),
    ("p06", "두부 300g", "채소·과일", "모", 10.0, 8.0, 1100, 1800, "s1", [(1.0, -1), (5.0, 3), (6.0, 7)]),
    ("p07", "삼겹살 600g", "정육·계란", "팩", 10.0, 8.0, 9800, 13900, "s2", [(7.0, 2), (5.0, 4)]),
    ("p08", "계란 30구", "정육·계란", "판", 6.0, 8.0, 6200, 7900, "s2", [(14.0, 9)]),
    ("p09", "닭볶음탕용", "정육·계란", "팩", 8.0, 5.0, 6400, 8900, "s2", [(3.0, 2)]),
    ("p10", "우유 1L", "유제품", "개", 12.0, 12.0, 2100, 2800, "s3", [(10.0, 4), (12.0, 9)]),
    ("p11", "요구르트 10입", "유제품", "팩", 6.0, 4.0, 3800, 5200, "s3", [(6.0, 12)]),
    ("p12", "슬라이스치즈", "유제품", "봉", 10.0, 6.0, 3300, 4500, "s3", [(4.0, 30)]),
    ("p13", "신라면 5입", "가공식품", "봉", 8.0, 12.0, 3300, 4200, "s4", [(20.0, 160)]),
    ("p14", "햇반 210g", "가공식품", "개", 24.0, 20.0, 1150, 1600, "s4", [(30.0, 180)]),
    ("p15", "참치캔 150g", "가공식품", "개", 24.0, 24.0, 1450, 2000, "s4", [(16.0, 540)]),
    ("p16", "진간장 840ml", "조미료", "병", 12.0, 6.0, 3900, 5500, "s4", [(9.0, 300)]),
    ("p17", "고추장 500g", "조미료", "개", 12.0, 4.0, 3600, 5000, "s4", [(3.0, 200)]),
    ("p18", "식용유 900ml", "조미료", "병", 12.0, 6.0, 3800, 5200, "s4", [(14.0, 400)]),
    ("p19", "새우깡 90g", "과자", "봉", 20.0, 15.0, 880, 1300, "s4", [(22.0, 45)]),
    ("p20", "초코파이 12입", "과자", "상자", 12.0, 6.0, 2700, 3800, "s4", [(2.0, 25)]),
    ("p21", "생수 2L 6입", "음료", "묶음", 6.0, 10.0, 2600, 3600, "s5", [(8.0, 365)]),
    ("p22", "콜라 1.5L", "음료", "병", 12.0, 12.0, 1500, 2300, "s5", [(18.0, 120)]),
    ("p23", "오렌지주스 1.5L", "음료", "개", 6.0, 5.0, 2800, 3900, "s5", [(3.0, 3), (7.0, 6)]),
    ("p24", "보리차 티백", "음료", "상자", 10.0, 4.0, 2100, 3000, "s5", [(9.0, 200)]),
]

async def seed():
    engine = create_async_engine(settings.DATABASE_URL)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        print("[INFO] Seeding database...")
        today = date.today()

        # 1. 창고 생성
        wh = Warehouse(
            warehouse_id="WH-ASAN",
            warehouse_name="아산 스마트마트 본점",
            region_code="232",
            address="충청남도 아산시 배방읍 광장로 210",
            is_active=True
        )
        await db.merge(wh)

        # 2. 거래처 생성
        cust = Customer(
            customer_id="CUS-0001",
            customer_name="배방 한식뷔페",
            customer_type="restaurant",
            region_code="44200",
            segment="A",
            first_order_date=today - timedelta(days=365)
        )
        await db.merge(cust)

        # 3. 공급업체 생성
        for sup in SUPPLIERS:
            s_entity = Supplier(**sup)
            await db.merge(s_entity)

        # 4. 품목, 공급조건, 로트 생성
        batch_counter = 1
        for p_id, name, cat, unit, pack, safety, cost, sale, sup_id, batches in PRODUCTS:
            item = Item(
                item_id=p_id,
                item_name=name,
                category_l=cat,
                uom=unit,
                pack_size=pack,
                safety_stock=safety,
                cost_price=cost,
                sale_price=sale,
                shelf_life_days=90,
                launch_date=today - timedelta(days=180)
            )
            await db.merge(item)

            # 공급 계약 조건
            term = SupplyTerm(
                item_id=p_id,
                supplier_id=sup_id,
                is_primary=True,
                lead_time_days=1 if sup_id in ("s1", "s2", "s3") else (2 if sup_id == "s4" else 3),
                moq=pack,
                order_multiple=pack,
                unit_cost=cost
            )
            await db.merge(term)

            # 로트별 재고
            for qty, days_left in batches:
                exp_date = today + timedelta(days=days_left)
                b_entity = InventoryBatch(
                    batch_id=f"BAT-{p_id}-{batch_counter:03d}",
                    item_id=p_id,
                    warehouse_id="WH-ASAN",
                    expiry_date=exp_date,
                    qty=qty,
                    received_date=today - timedelta(days=5)
                )
                await db.merge(b_entity)
                batch_counter += 1

        # 5. 과거 30일 판매 내역 생성 (시계열 모델 학습 및 대시보드 통계용)
        print("  - Generating 30 days of sales history...")
        for day_offset in range(30, -1, -1):
            sale_date = today - timedelta(days=day_offset)
            weekday = sale_date.weekday()
            is_weekend = weekday in (4, 5, 6)

            for p_id, name, cat, unit, pack, safety, cost, sale, sup_id, batches in PRODUCTS:
                base_qty = safety * 0.4
                mult = random.uniform(1.2, 1.8) if is_weekend else random.uniform(0.7, 1.2)
                q = round(base_qty * mult, 1)

                if q > 0:
                    amt = int(q * sale)
                    s_rec = Sales(
                        sale_date=sale_date,
                        order_id=f"SO-{sale_date.strftime('%y%m%d')}-{p_id}",
                        item_id=p_id,
                        warehouse_id="WH-ASAN",
                        channel="offline" if random.random() > 0.3 else "online",
                        qty=q,
                        unit_price=sale,
                        amount=amt,
                        is_return=False
                    )
                    db.add(s_rec)

        # 6. 기상청 단기예보 샘플 (향후 7일)
        for i in range(8):
            t_date = today + timedelta(days=i)
            wf = WeatherForecast(
                issued_at=datetime.utcnow(),
                target_date=t_date,
                region_code="232",
                source="short",
                temp_max=18.5 + (i % 3) * 2.0,
                temp_min=8.0 + (i % 2) * 1.5,
                pop=0.7 if i in (2, 5) else 0.1,
                pcp_mm=15.0 if i in (2, 5) else 0.0
            )
            await db.merge(wf)

        # 7. 프로모션 샘플
        promo = Promotion(
            promo_id="PR-2610-01",
            item_id="p10", # 우유
            warehouse_id="WH-ASAN",
            start_date=today - timedelta(days=2),
            end_date=today + timedelta(days=5),
            promo_type="discount",
            regular_price=2800,
            promo_price=2300,
            discount_rate=0.1785
        )
        await db.merge(promo)

        await db.commit()
        print("[SUCCESS] Seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
