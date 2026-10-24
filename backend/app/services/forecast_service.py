import math
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from app.models.master import Item
from app.models.features import Forecast, WeatherForecast
from app.models.sales import Sales
from app.models.inventory import InventoryDaily
from app.schemas.features import ItemForecastResponse, ForecastPoint

class ForecastService:
    @staticmethod
    async def get_item_forecast(db: AsyncSession, item_id: str, warehouse_id: str = "WH-ASAN") -> ItemForecastResponse:
        item = await db.get(Item, item_id)
        if not item:
            raise ValueError(f"Item not found: {item_id}")

        today = date.today()
        stmt = (
            select(Forecast)
            .where(
                Forecast.item_id == item_id,
                Forecast.warehouse_id == warehouse_id,
                Forecast.target_date >= today
            )
            .order_by(Forecast.target_date.asc())
            .limit(14)
        )
        res = await db.execute(stmt)
        forecasts = res.scalars().all()

        points = [
            ForecastPoint(
                target_date=f.target_date,
                yhat=float(f.yhat),
                yhat_p10=float(f.yhat_p10) if f.yhat_p10 is not None else None,
                yhat_p90=float(f.yhat_p90) if f.yhat_p90 is not None else None,
                model_version=f.model_version
            )
            for f in forecasts
        ]

        # 만약 저장된 예측 데이터가 없으면 즉시 동적 추론 생성
        if not points:
            points = await ForecastService._generate_baseline_forecast(db, item, warehouse_id, today)

        return ItemForecastResponse(
            item_id=item.item_id,
            item_name=item.item_name,
            warehouse_id=warehouse_id,
            run_date=today,
            forecasts=points
        )

    @staticmethod
    async def _generate_baseline_forecast(db: AsyncSession, item: Item, warehouse_id: str, today: date) -> list[ForecastPoint]:
        """과거 판매 이력 기반 롤링 이동평균 및 요일별 계절성 + 신뢰구간 밴드 산출"""
        # 1. 최근 28일 판매 데이터 조회
        start_date = today - timedelta(days=28)
        sales_stmt = select(Sales).where(
            Sales.item_id == item.item_id,
            Sales.warehouse_id == warehouse_id,
            Sales.sale_date >= start_date,
            Sales.is_return == False
        )
        res = await db.execute(sales_stmt)
        sales_list = res.scalars().all()

        # 일평균 기본 판매량 산출
        if sales_list:
            total_qty = sum(float(s.qty) for s in sales_list)
            base_sales = max(1.0, total_qty / 28.0)
        else:
            # 판매 이력이 없으면 품목의 안전재고 또는 기본 5개 가정
            base_sales = max(2.0, float(item.safety_stock) * 0.3)

        points: list[ForecastPoint] = []
        for i in range(1, 15):
            t_date = today + timedelta(days=i)
            weekday = t_date.weekday()
            # 주말(금/토/일) 소비 가중치 부여
            weekend_boost = 1.35 if weekday in (4, 5, 6) else 0.95
            
            # 예측치 yhat 계산
            yhat = round(base_sales * weekend_boost, 1)
            p10 = max(0.0, round(yhat * 0.7, 1))
            p90 = round(yhat * 1.4, 1)

            points.append(
                ForecastPoint(
                    target_date=t_date,
                    yhat=yhat,
                    yhat_p10=p10,
                    yhat_p90=p90,
                    model_version="lgbm-v3-baseline"
                )
            )

        return points

    @staticmethod
    async def run_batch_forecast(db: AsyncSession, warehouse_id: str = "WH-ASAN") -> int:
        """전체 품목에 대한 향후 14일 일괄 예측 수행 및 forecast 테이블 저장"""
        today = date.today()
        items_res = await db.execute(select(Item))
        items = items_res.scalars().all()

        count = 0
        for item in items:
            points = await ForecastService._generate_baseline_forecast(db, item, warehouse_id, today)
            for pt in points:
                # 멱등성 보장 (기존 레코드 존재 시 갱신)
                existing = await db.execute(
                    select(Forecast).where(
                        Forecast.run_date == today,
                        Forecast.target_date == pt.target_date,
                        Forecast.item_id == item.item_id,
                        Forecast.warehouse_id == warehouse_id
                    )
                )
                f_record = existing.scalars().first()
                if f_record:
                    f_record.yhat = pt.yhat
                    f_record.yhat_p10 = pt.yhat_p10
                    f_record.yhat_p90 = pt.yhat_p90
                    f_record.model_version = pt.model_version
                else:
                    new_f = Forecast(
                        run_date=today,
                        target_date=pt.target_date,
                        item_id=item.item_id,
                        warehouse_id=warehouse_id,
                        yhat=pt.yhat,
                        yhat_p10=pt.yhat_p10,
                        yhat_p90=pt.yhat_p90,
                        model_version=pt.model_version
                    )
                    db.add(new_f)
                count += 1

        await db.commit()
        return count
