from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.features import WeatherForecast, Promotion
from app.schemas.features import WeatherForecastResponse, PromotionResponse
from datetime import date

router = APIRouter(prefix="/external", tags=["External Features"])

@router.get("/weather/forecast", response_model=list[WeatherForecastResponse])
async def get_weather_forecast(
    region_code: str = "232",
    db: AsyncSession = Depends(get_db)
):
    """기상청 단기예보 조회"""
    today = date.today()
    stmt = (
        select(WeatherForecast)
        .where(WeatherForecast.region_code == region_code, WeatherForecast.target_date >= today)
        .order_by(WeatherForecast.target_date.asc())
        .limit(7)
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/promotions", response_model=list[PromotionResponse])
async def list_active_promotions(
    db: AsyncSession = Depends(get_db)
):
    """현재 진행 중 또는 예정된 가격 프로모션 조회"""
    today = date.today()
    stmt = (
        select(Promotion)
        .where(Promotion.end_date >= today)
        .order_by(Promotion.start_date.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()
