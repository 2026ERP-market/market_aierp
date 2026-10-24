import asyncio
import random
import math
from datetime import date, timedelta, datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import delete, insert
from app.core.config import settings
from app.models.master import Warehouse, Customer, Supplier, Item, SupplyTerm
from app.models.inventory import InventoryBatch, InventoryDaily
from app.models.sales import Sales, OpenOrder
from app.models.purchases import PurchaseOrder, PurchaseOrderLine, OrderRecommendation
from app.models.features import (
    Promotion, Calendar, Weather, WeatherForecast, Event, Forecast, MarketIndex
)

# -------------------------------------------------------------
# 1. 마스터 데이터 정의
# -------------------------------------------------------------
WAREHOUSES = [
    {"warehouse_id": "WH-ASAN", "warehouse_name": "아산 스마트물류센터 본점", "region_code": "232", "address": "충남 아산시 배방읍 광장로 210", "is_active": True},
    {"warehouse_id": "WH-CHEONAN", "warehouse_name": "천안 동부유통센터", "region_code": "232", "address": "충남 천안시 동남구 신부동 120", "is_active": True},
]

CUSTOMERS = [
    {"customer_id": "CUS-0001", "customer_name": "배방 한식뷔페", "customer_type": "restaurant", "region_code": "44200", "segment": "A"},
    {"customer_id": "CUS-0002", "customer_name": "온양 식자재할인마트", "customer_type": "wholesale", "region_code": "44200", "segment": "A"},
    {"customer_id": "CUS-0003", "customer_name": "신정호 베이커리카페", "customer_type": "restaurant", "region_code": "44200", "segment": "B"},
    {"customer_id": "CUS-0004", "customer_name": "천안 프레시밀 온라인", "customer_type": "online", "region_code": "44131", "segment": "A"},
    {"customer_id": "CUS-0005", "customer_name": "탕정 분식코너", "customer_type": "restaurant", "region_code": "44200", "segment": "C"},
    {"customer_id": "CUS-0006", "customer_name": "아산 로컬소비자연합", "customer_type": "retail", "region_code": "44200", "segment": "B"},
    {"customer_id": "CUS-0007", "customer_name": "천안 대학가 삼겹살전문점", "customer_type": "restaurant", "region_code": "44131", "segment": "A"},
    {"customer_id": "CUS-0008", "customer_name": "배방 중앙할인마트", "customer_type": "wholesale", "region_code": "44200", "segment": "B"},
]

SUPPLIERS = [
    {"supplier_id": "s1", "supplier_name": "푸르메 농산", "lead_time_days": 1, "min_order_amount": 50000, "phone": "02-555-0101"},
    {"supplier_id": "s2", "supplier_name": "한우리 축산", "lead_time_days": 1, "min_order_amount": 100000, "phone": "02-555-0102"},
    {"supplier_id": "s3", "supplier_name": "서울우유 대리점", "lead_time_days": 1, "min_order_amount": 30000, "phone": "02-555-0103"},
    {"supplier_id": "s4", "supplier_name": "대한식품 도매", "lead_time_days": 2, "min_order_amount": 150000, "phone": "02-555-0104"},
    {"supplier_id": "s5", "supplier_name": "청량음료 유통", "lead_time_days": 3, "min_order_amount": 100000, "phone": "02-555-0105"},
]

# 25개 품목 (대·중·소 분류 및 대체그룹 완비)
PRODUCTS_MASTER = [
    # id, name, cat_l, cat_m, cat_s, uom, pack_size, safety_stock, cost_price, sale_price, sup_id, sub_group, shelf_life
    ("p01", "대파", "식품", "신선채소", "파·양파", "단", 10.0, 8.0, 1800, 2500, "s1", "SUB-VEG", 7),
    ("p02", "양파 1.5kg", "식품", "신선채소", "파·양파", "망", 10.0, 10.0, 2400, 3500, "s1", "SUB-VEG", 21),
    ("p03", "사과 5입", "식품", "신선과일", "사과", "봉", 6.0, 6.0, 6500, 8900, "s1", "SUB-FRUIT", 14),
    ("p04", "방울토마토 500g", "식품", "신선채소", "토마토", "팩", 8.0, 6.0, 3200, 4500, "s1", "SUB-VEG", 10),
    ("p05", "시금치", "식품", "신선채소", "잎채소", "단", 10.0, 6.0, 1500, 2200, "s1", "SUB-VEG", 5),
    ("p06", "두부 300g", "식품", "가공식품", "두부·콩", "모", 10.0, 8.0, 1100, 1800, "s1", "SUB-TOFU", 14),
    ("p07", "삼겹살 600g", "식품", "축산물", "돼지고기", "팩", 10.0, 8.0, 9800, 13900, "s2", "SUB-MEAT", 7),
    ("p08", "계란 30구", "식품", "축산물", "계란", "판", 6.0, 8.0, 6200, 7900, "s2", "SUB-EGG", 25),
    ("p09", "닭볶음탕용 1kg", "식품", "축산물", "닭고기", "팩", 8.0, 5.0, 6400, 8900, "s2", "SUB-MEAT", 6),
    ("p10", "우유 1L", "식품", "유가공품", "백색시유", "개", 12.0, 12.0, 2100, 2800, "s3", "SUB-MILK", 14),
    ("p11", "요구르트 10입", "식품", "유가공품", "발효유", "팩", 6.0, 4.0, 3800, 5200, "s3", "SUB-MILK", 21),
    ("p12", "슬라이스치즈 10매", "식품", "유가공품", "치즈", "봉", 10.0, 6.0, 3300, 4500, "s3", "SUB-DAIRY", 90),
    ("p13", "신라면 5입", "가공식품", "면류", "봉지라면", "봉", 8.0, 12.0, 3300, 4200, "s4", "SUB-RAMEN", 180),
    ("p14", "햇반 210g", "가공식품", "밥류", "즉석밥", "개", 24.0, 20.0, 1150, 1600, "s4", "SUB-RICE", 270),
    ("p15", "참치캔 150g", "가공식품", "수산캔", "참치", "개", 24.0, 24.0, 1450, 2000, "s4", "SUB-CAN", 1080),
    ("p16", "진간장 840ml", "가공식품", "조미료", "간장", "병", 12.0, 6.0, 3900, 5500, "s4", "SUB-CONDIMENT", 720),
    ("p17", "고추장 500g", "가공식품", "조미료", "장류", "개", 12.0, 4.0, 3600, 5000, "s4", "SUB-CONDIMENT", 540),
    ("p18", "식용유 900ml", "가공식품", "유지류", "식용유", "병", 12.0, 6.0, 3800, 5200, "s4", "SUB-OIL", 720),
    ("p19", "새우깡 90g", "과자", "스낵", "스낵류", "봉", 20.0, 15.0, 880, 1300, "s4", "SUB-SNACK", 180),
    ("p20", "초코파이 12입", "과자", "파이류", "초코파이", "상자", 12.0, 6.0, 2700, 3800, "s4", "SUB-SNACK", 180),
    ("p21", "생수 2L 6입", "음료", "생수", "먹는샘물", "묶음", 6.0, 10.0, 2600, 3600, "s5", "SUB-WATER", 365),
    ("p22", "콜라 1.5L", "음료", "탄산음료", "콜라", "병", 12.0, 12.0, 1500, 2300, "s5", "SUB-BEVERAGE", 365),
    ("p23", "오렌지주스 1.5L", "음료", "과채음료", "과즙주스", "개", 6.0, 5.0, 2800, 3900, "s5", "SUB-BEVERAGE", 180),
    ("p24", "보리차 티백 30입", "음료", "차류", "침출차", "상자", 10.0, 4.0, 2100, 3000, "s5", "SUB-TEA", 720),
    ("ITM-00123", "냉동 만두 1kg", "가공식품", "냉동식품", "만두", "봉", 12.0, 15.0, 3500, 4900, "s4", "SUB-DUMPLING", 180),
]

# 한국 실제 공휴일 목록 (2025, 2026)
HOLIDAYS_MAP = {
    # 2025
    date(2025, 1, 1): "신정",
    date(2025, 1, 28): "설날 연휴",
    date(2025, 1, 29): "설날",
    date(2025, 1, 30): "설날 연휴",
    date(2025, 3, 1): "삼일절",
    date(2025, 3, 3): "삼일절 대체공휴일",
    date(2025, 5, 5): "어린이날",
    date(2025, 5, 6): "부처님오신날",
    date(2025, 6, 6): "현충일",
    date(2025, 8, 15): "광복절",
    date(2025, 10, 3): "개천절",
    date(2025, 10, 5): "추석 연휴",
    date(2025, 10, 6): "추석",
    date(2025, 10, 7): "추석 연휴",
    date(2025, 10, 8): "대체공휴일",
    date(2025, 10, 9): "한글날",
    date(2025, 12, 25): "크리스마스",
    # 2026
    date(2026, 1, 1): "신정",
    date(2026, 2, 16): "설날 연휴",
    date(2026, 2, 17): "설날",
    date(2026, 2, 18): "설날 연휴",
    date(2026, 3, 1): "삼일절",
    date(2026, 3, 2): "삼일절 대체공휴일",
    date(2026, 5, 5): "어린이날",
    date(2026, 5, 24): "부처님오신날",
    date(2026, 6, 6): "현충일",
    date(2026, 8, 15): "광복절",
    date(2026, 8, 17): "광복절 대체공휴일",
    date(2026, 9, 24): "추석 연휴",
    date(2026, 9, 25): "추석",
    date(2026, 9, 26): "추석 연휴",
    date(2026, 10, 3): "개천절",
    date(2026, 10, 5): "개천절 대체공휴일",
    date(2026, 10, 9): "한글날",
    date(2026, 12, 25): "크리스마스",
}

async def generate_and_insert_dataset():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        print("[DATASET] Starting comprehensive dataset injection based on 수요예측 데이터 명세...")
        random.seed(42) # 재현성을 위한 시드 고정

        # -------------------------------------------------------------
        # 1. 기존 데이터 정리 (깨끗한 적재를 위해 역순 삭제)
        # -------------------------------------------------------------
        print("  1. Cleaning existing data...")
        await db.execute(delete(Sales))
        await db.execute(delete(InventoryDaily))
        await db.execute(delete(InventoryBatch))
        await db.execute(delete(PurchaseOrderLine))
        await db.execute(delete(PurchaseOrder))
        await db.execute(delete(OrderRecommendation))
        await db.execute(delete(Forecast))
        await db.execute(delete(OpenOrder))
        await db.execute(delete(Promotion))
        await db.execute(delete(Event))
        await db.execute(delete(Weather))
        await db.execute(delete(WeatherForecast))
        await db.execute(delete(Calendar))
        await db.execute(delete(MarketIndex))
        await db.execute(delete(SupplyTerm))
        await db.execute(delete(Item))
        await db.execute(delete(Customer))
        await db.execute(delete(Supplier))
        await db.execute(delete(Warehouse))
        await db.commit()

        # -------------------------------------------------------------
        # 2. 마스터 데이터 등록
        # -------------------------------------------------------------
        print("  2. Inserting master tables (warehouses, customers, suppliers, items, terms)...")
        for w in WAREHOUSES:
            db.add(Warehouse(**w))
        for c in CUSTOMERS:
            db.add(Customer(**c, first_order_date=date(2024, 6, 1)))
        for s in SUPPLIERS:
            db.add(Supplier(**s))

        for p_id, name, cat_l, cat_m, cat_s, uom, pack, safety, cost, sale, sup_id, sub_grp, shelf in PRODUCTS_MASTER:
            item = Item(
                item_id=p_id,
                item_name=name,
                category_l=cat_l,
                category_m=cat_m,
                category_s=cat_s,
                uom=uom,
                pack_size=pack,
                safety_stock=safety,
                cost_price=cost,
                sale_price=sale,
                substitute_group=sub_grp,
                shelf_life_days=shelf,
                launch_date=date(2024, 1, 1)
            )
            db.add(item)

            term = SupplyTerm(
                item_id=p_id,
                supplier_id=sup_id,
                is_primary=True,
                lead_time_days=1 if sup_id in ("s1", "s2", "s3") else (2 if sup_id == "s4" else 3),
                moq=pack,
                order_multiple=pack,
                unit_cost=cost,
                order_days="MON,TUE,WED,THU,FRI"
            )
            db.add(term)
        await db.commit()

        # -------------------------------------------------------------
        # 3. 캘린더 생성 (2025-01-01 ~ 2026-12-31, 730일)
        # -------------------------------------------------------------
        print("  3. Generating calendar table (730 days)...")
        start_cal = date(2025, 1, 1)
        end_cal = date(2026, 12, 31)
        curr = start_cal

        cal_records = []
        while curr <= end_cal:
            weekday = curr.weekday() # 0=월 ... 6=일
            is_hol = curr in HOLIDAYS_MAP
            hol_name = HOLIDAYS_MAP.get(curr)

            # 설날/추석 D-Day 계산
            seollal_target = date(2025, 1, 29) if curr.year == 2025 else date(2026, 2, 17)
            chuseok_target = date(2025, 10, 6) if curr.year == 2025 else date(2026, 9, 25)
            d_seollal = (seollal_target - curr).days
            d_chuseok = (chuseok_target - curr).days

            # 계절
            month = curr.month
            if month in (3, 4, 5):
                season = "spring"
            elif month in (6, 7, 8):
                season = "summer"
            elif month in (9, 10, 11):
                season = "autumn"
            else:
                season = "winter"

            is_pay = curr.day in (25, 30, 31)

            cal_records.append(
                Calendar(
                    date=curr,
                    weekday=weekday,
                    week_of_year=curr.isocalendar()[1],
                    month=month,
                    is_holiday=is_hol,
                    holiday_name=hol_name,
                    days_to_seollal=d_seollal,
                    days_to_chuseok=d_chuseok,
                    is_payday=is_pay,
                    season=season
                )
            )
            curr += timedelta(days=1)

        db.add_all(cal_records)
        await db.commit()

        # -------------------------------------------------------------
        # 4. 날씨 실측 (weather) 2025-01-01 ~ 2026-10-24
        # -------------------------------------------------------------
        print("  4. Generating weather history (663 days)...")
        curr = start_cal
        hist_end = date(2026, 10, 24)
        weather_records = []

        while curr <= hist_end:
            month = curr.month
            # 계절별 기온 분포
            if month in (12, 1, 2):
                t_avg = round(random.uniform(-6.0, 3.0), 1)
                t_min = round(t_avg - random.uniform(3.0, 6.0), 1)
                t_max = round(t_avg + random.uniform(3.0, 5.0), 1)
                is_rain = random.random() < 0.15
                precip = round(random.uniform(2.0, 10.0), 1) if is_rain else 0.0
            elif month in (6, 7, 8):
                # 여름 폭염 및 장마
                t_avg = round(random.uniform(25.0, 32.0), 1)
                t_min = round(t_avg - random.uniform(2.0, 4.0), 1)
                t_max = round(t_avg + random.uniform(3.0, 6.0), 1)
                is_rain = random.random() < (0.45 if month == 7 else 0.25)
                precip = round(random.uniform(15.0, 65.0), 1) if is_rain else 0.0
            else:
                # 봄 / 가을
                t_avg = round(random.uniform(11.0, 21.0), 1)
                t_min = round(t_avg - random.uniform(3.0, 6.0), 1)
                t_max = round(t_avg + random.uniform(3.0, 6.0), 1)
                is_rain = random.random() < 0.2
                precip = round(random.uniform(5.0, 20.0), 1) if is_rain else 0.0

            weather_records.append(
                Weather(
                    date=curr,
                    region_code="232",
                    temp_avg=t_avg,
                    temp_min=t_min,
                    temp_max=t_max,
                    precipitation_mm=precip,
                    is_rain=is_rain
                )
            )
            curr += timedelta(days=1)

        db.add_all(weather_records)

        # 향후 7일 기상 예보
        for i in range(8):
            f_date = hist_end + timedelta(days=i)
            db.add(
                WeatherForecast(
                    issued_at=datetime.utcnow(),
                    target_date=f_date,
                    region_code="232",
                    source="short",
                    temp_max=18.5 + (i % 3) * 1.5,
                    temp_min=8.0 + (i % 2) * 1.0,
                    pop=0.7 if i in (2, 5) else 0.1,
                    pcp_mm=12.5 if i in (2, 5) else 0.0
                )
            )
        await db.commit()

        # -------------------------------------------------------------
        # 5. 프로모션, 이벤트, 외부지표 등록
        # -------------------------------------------------------------
        print("  5. Inserting promotions, events, market index...")
        PROMOTIONS = [
            ("PR-2501-01", "p07", date(2025, 1, 20), date(2025, 1, 28), "discount", 13900, 10900, 0.2158),
            ("PR-2503-01", "p07", date(2025, 3, 1), date(2025, 3, 4), "discount", 13900, 9900, 0.2878), # 삼겹살데이
            ("PR-2507-01", "p21", date(2025, 7, 10), date(2025, 7, 25), "one_plus_one", 3600, 1800, 0.5000), # 생수 1+1
            ("PR-2507-02", "p22", date(2025, 7, 15), date(2025, 7, 31), "discount", 2300, 1700, 0.2609), # 콜라
            ("PR-2509-01", "p03", date(2025, 9, 25), date(2025, 10, 5), "discount", 8900, 6900, 0.2247), # 추석 사과
            ("PR-2512-01", "ITM-00123", date(2025, 12, 15), date(2025, 12, 31), "bundle", 4900, 3900, 0.2041), # 겨울 만두
            ("PR-2601-01", "p07", date(2026, 2, 8), date(2026, 2, 16), "discount", 13900, 11500, 0.1727),
            ("PR-2603-01", "p07", date(2026, 3, 1), date(2026, 3, 4), "discount", 13900, 9900, 0.2878),
            ("PR-2607-01", "p21", date(2026, 7, 10), date(2026, 7, 25), "one_plus_one", 3600, 1800, 0.5000),
            ("PR-2609-01", "p03", date(2026, 9, 15), date(2026, 9, 24), "discount", 8900, 6900, 0.2247),
            ("PR-2610-01", "p10", date(2026, 10, 18), date(2026, 10, 26), "discount", 2800, 2200, 0.2143), # 우유
        ]
        for pr_id, i_id, s_d, e_d, p_type, r_pr, p_pr, disc in PROMOTIONS:
            db.add(Promotion(
                promo_id=pr_id, item_id=i_id, warehouse_id="WH-ASAN",
                start_date=s_d, end_date=e_d, promo_type=p_type,
                regular_price=r_pr, promo_price=p_pr, discount_rate=disc
            ))

        EVENTS = [
            ("EV-2504-01", date(2025, 4, 25), date(2025, 4, 28), "ITM-00123", "WH-ASAN", "one_off_bulk", "아산 성웅 이순신 축제 푸드코트 단체 납품 대량 주문"),
            ("EV-2507-01", date(2025, 7, 18), date(2025, 7, 22), "p01", "WH-ASAN", "supply_issue", "중부지방 집중호우로 인한 채소 산지 출하 지연"),
            ("EV-2511-01", date(2025, 11, 10), date(2025, 11, 14), None, "WH-ASAN", "competitor", "인근 대형마트 창립기념 초특가 행사로 인한 일시 내방객 감소"),
            ("EV-2605-01", date(2026, 5, 12), date(2026, 5, 14), "p06", "WH-ASAN", "media", "인기 TV 예능 '나혼자산다' 순두부/두부 요리 방영 효과"),
            ("EV-2608-01", date(2026, 8, 3), date(2026, 8, 8), "p21", "WH-ASAN", "weather_disaster", "낮 최고 35.8도 폭염경보 발령으로 생수 소비 폭증"),
        ]
        for e_id, s_d, e_d, itm, wh, e_type, note in EVENTS:
            db.add(Event(
                event_id=e_id, start_date=s_d, end_date=e_d,
                item_id=itm, warehouse_id=wh, event_type=e_type, note=note
            ))

        # 외부 거시 지표 (market_index) 2025-01 ~ 2026-10 (22개월)
        for yr in [2025, 2026]:
            max_m = 10 if yr == 2026 else 12
            for m in range(1, max_m + 1):
                m_str = f"{yr}-{m:02d}"
                cpi_val = round(112.5 + ((yr - 2025) * 12 + m) * 0.18, 2)
                food_cpi_val = round(118.0 + ((yr - 2025) * 12 + m) * 0.25, 2)
                db.add(MarketIndex(month=m_str, index_name="cpi", value=cpi_val))
                db.add(MarketIndex(month=m_str, index_name="food_cpi", value=food_cpi_val))

        await db.commit()

        # -------------------------------------------------------------
        # 6. 판매 이력(sales) & 일별 재고 스냅샷(inventory_daily) 시뮬레이션
        # -------------------------------------------------------------
        print("  6. Simulating realistic daily sales & inventory snapshots with stockouts...")
        # 663일간 각 품목의 일별 판매량과 재고 증감 시뮬레이션
        curr = start_cal
        
        # 품목별 초기 재고 설정 (안전재고의 약 3배)
        curr_stock = {p[0]: float(p[7]) * 3.5 for p in PRODUCTS_MASTER}
        
        sales_chunk = []
        inv_daily_chunk = []
        po_counter = 1

        promo_items_by_date = {}
        for pr_id, i_id, s_d, e_d, _, _, _, _ in PROMOTIONS:
            d = s_d
            while d <= e_d:
                promo_items_by_date.setdefault(d, set()).add(i_id)
                d += timedelta(days=1)

        while curr <= hist_end:
            weekday = curr.weekday()
            is_weekend = weekday in (4, 5, 6)
            is_hol = curr in HOLIDAYS_MAP

            # 날씨 정보 조회 (리스트에서)
            w_info = weather_records[(curr - start_cal).days]
            is_rain = w_info.is_rain
            temp_max = float(w_info.temp_max or 20.0)

            promoted_items = promo_items_by_date.get(curr, set())

            for p_id, name, cat_l, cat_m, cat_s, uom, pack, safety, cost, sale, sup_id, sub_grp, shelf in PRODUCTS_MASTER:
                # 기본 일평균 수요
                base_demand = safety * 0.45

                # 1. 요일 효과 (주말 +40~70%)
                w_mult = random.uniform(1.4, 1.7) if is_weekend else random.uniform(0.85, 1.15)
                
                # 2. 명절 D-Day 효과 (설/추석 7일 전 선물용 사과/정육 급증)
                seollal_target = date(2025, 1, 29) if curr.year == 2025 else date(2026, 2, 17)
                chuseok_target = date(2025, 10, 6) if curr.year == 2025 else date(2026, 9, 25)
                seollal_d = (seollal_target - curr).days
                chuseok_d = (chuseok_target - curr).days
                festive_mult = 1.0
                if (0 <= seollal_d <= 7 or 0 <= chuseok_d <= 7) and cat_l in ("식품", "과자"):
                    festive_mult = 2.2 if p_id in ("p03", "p07", "p08", "p20") else 1.5

                # 3. 날씨 효과
                weather_mult = 1.0
                if temp_max >= 32.0 and p_id in ("p21", "p22", "p23"): # 폭염 음료 폭증
                    weather_mult = 1.85
                elif is_rain and p_id in ("p18", "p06", "p13"): # 비 올 때 식용유/두부/라면
                    weather_mult = 1.45
                elif temp_max <= -3.0 and p_id in ("p13", "p24", "ITM-00123"): # 한파 만두/라면
                    weather_mult = 1.40

                # 4. 프로모션 효과
                promo_mult = 2.4 if p_id in promoted_items else 1.0

                # 최종 잠재 수요 (True Demand)
                true_demand = base_demand * w_mult * festive_mult * weather_mult * promo_mult
                true_demand = round(max(0.5, true_demand + random.gauss(0, base_demand * 0.15)), 1)

                # 재고와 판매량 상호작용 (Censored Demand)
                on_hand = curr_stock[p_id]
                stockout = False

                if on_hand <= 0:
                    actual_sale = 0.0
                    stockout = True
                elif on_hand < true_demand:
                    actual_sale = on_hand # 재고만큼만 팔리고 품절
                    stockout = True
                    curr_stock[p_id] = 0.0
                else:
                    actual_sale = true_demand
                    curr_stock[p_id] -= actual_sale

                # 판매 트랜잭션 기록
                if actual_sale > 0:
                    sales_chunk.append({
                        "sale_date": curr,
                        "order_id": f"SO-{curr.strftime('%y%m%d')}-{p_id}-{random.randint(100, 999)}",
                        "item_id": p_id,
                        "warehouse_id": "WH-ASAN",
                        "customer_id": f"CUS-000{random.randint(1, 8)}" if random.random() < 0.25 else None,
                        "channel": "b2b" if random.random() < 0.15 else ("online" if random.random() < 0.3 else "offline"),
                        "qty": actual_sale,
                        "unit_price": sale,
                        "amount": int(actual_sale * sale),
                        "is_return": False
                    })

                # 일일 마감 재고 스냅샷 기록
                inv_daily_chunk.append({
                    "snapshot_date": curr,
                    "item_id": p_id,
                    "warehouse_id": "WH-ASAN",
                    "on_hand_qty": curr_stock[p_id],
                    "available_qty": curr_stock[p_id],
                    "stockout_flag": stockout
                })

                # 주기적 발주 및 입고 시뮬레이션 (재고가 안전재고 이하로 떨어지면 발주)
                if curr_stock[p_id] < safety * 1.2:
                    lead_days = 1 if sup_id in ("s1", "s2", "s3") else (2 if sup_id == "s4" else 3)
                    order_qty = pack * math.ceil((safety * 2.5) / pack)
                    
                    # 발주일 = curr, 입고일 = curr + lead_days
                    recv_date = curr + timedelta(days=lead_days)
                    if recv_date <= hist_end:
                        curr_stock[p_id] += order_qty # 입고 시점에 재고 충전

                    # 주기적인 purchase_order 생성 (한 달에 2~3회 샘플링)
                    if random.random() < 0.15:
                        po_id = f"PO-{curr.strftime('%y%m%d')}-{po_counter:04d}"
                        po_counter += 1
                        po = PurchaseOrder(
                            po_id=po_id,
                            supplier_id=sup_id,
                            order_date=curr,
                            expected_date=curr + timedelta(days=lead_days),
                            received_date=curr + timedelta(days=lead_days + (1 if random.random() < 0.1 else 0)),
                            total_amount=int(order_qty * cost),
                            status="received"
                        )
                        db.add(po)
                        db.add(PurchaseOrderLine(
                            po_id=po_id,
                            line_no=1,
                            item_id=p_id,
                            order_qty=order_qty,
                            received_qty=order_qty,
                            unit_cost=cost
                        ))

            # 배치 DB 삽입 (메모리 절약을 위해 100일 단위로 커밋)
            if len(sales_chunk) >= 2000:
                await db.execute(insert(Sales), sales_chunk)
                await db.execute(insert(InventoryDaily), inv_daily_chunk)
                await db.commit()
                sales_chunk.clear()
                inv_daily_chunk.clear()

            curr += timedelta(days=1)

        # 잔여 청크 삽입
        if sales_chunk:
            await db.execute(insert(Sales), sales_chunk)
        if inv_daily_chunk:
            await db.execute(insert(InventoryDaily), inv_daily_chunk)
        await db.commit()

        # -------------------------------------------------------------
        # 7. 현재 기준 실재고 로트 (inventory_batches)
        # -------------------------------------------------------------
        print("  7. Generating current inventory batches...")
        batch_id_num = 1
        for p_id, name, cat_l, cat_m, cat_s, uom, pack, safety, cost, sale, sup_id, sub_grp, shelf in PRODUCTS_MASTER:
            rem_qty = curr_stock[p_id]
            if rem_qty <= 0:
                rem_qty = pack * 1.5 # 완전 0이면 기본 로트 1개 채움
            
            # 소비기한별 2개 로트로 분할
            q1 = round(rem_qty * 0.4, 1)
            q2 = round(rem_qty * 0.6, 1)
            
            # 일부 품목은 D-2, D-3 임박 로트로 설정 (모바일/웹 알림 테스트용)
            days_offset1 = 2 if p_id in ("p01", "p04", "p05", "p07") else 14
            days_offset2 = 5 if p_id in ("p01", "p04", "p05", "p07") else (shelf or 60)

            db.add(InventoryBatch(
                batch_id=f"BAT-{p_id}-{batch_id_num:03d}",
                item_id=p_id,
                warehouse_id="WH-ASAN",
                expiry_date=hist_end + timedelta(days=days_offset1),
                qty=q1,
                received_date=hist_end - timedelta(days=3)
            ))
            batch_id_num += 1

            db.add(InventoryBatch(
                batch_id=f"BAT-{p_id}-{batch_id_num:03d}",
                item_id=p_id,
                warehouse_id="WH-ASAN",
                expiry_date=hist_end + timedelta(days=days_offset2),
                qty=q2,
                received_date=hist_end - timedelta(days=1)
            ))
            batch_id_num += 1

        # -------------------------------------------------------------
        # 8. B2B 확정 주문 잔량 (open_orders)
        # -------------------------------------------------------------
        print("  8. Inserting open orders (B2B confirmed future demand)...")
        OPEN_ORDERS = [
            ("SO-261026-001", 1, "CUS-0001", "p07", hist_end, hist_end + timedelta(days=2), 30.0, "confirmed"),
            ("SO-261026-002", 1, "CUS-0002", "p02", hist_end, hist_end + timedelta(days=3), 50.0, "confirmed"),
            ("SO-261028-001", 1, "CUS-0004", "p13", hist_end, hist_end + timedelta(days=4), 40.0, "confirmed"),
            ("SO-261028-002", 1, "CUS-0007", "p07", hist_end, hist_end + timedelta(days=5), 60.0, "confirmed"),
            ("SO-261030-001", 1, "CUS-0003", "p10", hist_end, hist_end + timedelta(days=6), 24.0, "confirmed"),
        ]
        for o_id, l_no, c_id, itm, o_d, r_d, q, st in OPEN_ORDERS:
            db.add(OpenOrder(
                order_id=o_id, line_no=l_no, customer_id=c_id, item_id=itm,
                order_date=o_d, requested_delivery_date=r_d, qty=q, status=st
            ))

        await db.commit()

        # -------------------------------------------------------------
        # 9. 현재 기준 14일 AI 수요 예측 (forecast) & 발주 추천 (order_recommendations)
        # -------------------------------------------------------------
        print("  9. Generating AI forecast and replenishment recommendations...")
        rec_counter = 1
        for p_id, name, cat_l, cat_m, cat_s, uom, pack, safety, cost, sale, sup_id, sub_grp, shelf in PRODUCTS_MASTER:
            base_sales = safety * 0.45
            
            # 향후 14일 예측
            demand_sum_lead = 0.0
            lead_days = 1 if sup_id in ("s1", "s2", "s3") else (2 if sup_id == "s4" else 3)

            for i in range(1, 15):
                t_date = hist_end + timedelta(days=i)
                w_day = t_date.weekday()
                mult = 1.45 if w_day in (4, 5, 6) else 0.95
                yhat = round(base_sales * mult, 1)
                p10 = max(0.0, round(yhat * 0.75, 1))
                p90 = round(yhat * 1.35, 1)

                db.add(Forecast(
                    run_date=hist_end,
                    target_date=t_date,
                    item_id=p_id,
                    warehouse_id="WH-ASAN",
                    yhat=yhat,
                    yhat_p10=p10,
                    yhat_p90=p90,
                    model_version="lgbm-v3-prod"
                ))

                if i <= lead_days + 1:
                    demand_sum_lead += yhat

            # 발주 추천 산출
            cur_s = curr_stock[p_id]
            needed = demand_sum_lead + safety
            shortage = needed - cur_s
            if shortage > 0:
                batches_needed = math.ceil(shortage / pack)
                final_qty = max(batches_needed * pack, pack)
                reason = (
                    f"리드타임({lead_days}일) 예상수요 {demand_sum_lead:.1f}{uom} + 안전재고 {safety:.0f}{uom} 대비 "
                    f"현재고 {cur_s:.1f}{uom} 부족. 박스 배수({pack:.0f}{uom}) 올림 적용."
                )

                db.add(OrderRecommendation(
                    rec_id=f"REC-{hist_end.strftime('%y%m%d')}-{rec_counter:04d}",
                    recommend_date=hist_end,
                    item_id=p_id,
                    warehouse_id="WH-ASAN",
                    supplier_id=sup_id,
                    current_stock=cur_s,
                    forecast_demand=demand_sum_lead,
                    safety_stock=safety,
                    recommended_qty=final_qty,
                    status="draft",
                    reason=reason
                ))
                rec_counter += 1

        await db.commit()
        print("[SUCCESS] All demand forecasting datasets successfully generated and inserted into PostgreSQL!")

if __name__ == "__main__":
    asyncio.run(generate_and_insert_dataset())
