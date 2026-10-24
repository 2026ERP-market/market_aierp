from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.features import ItemForecastResponse
from app.services.forecast_service import ForecastService

router = APIRouter(prefix="/forecast", tags=["Forecast"])

@router.get("/{item_id}", response_model=ItemForecastResponse)
async def get_forecast(
    item_id: str,
    warehouse_id: str = "WH-ASAN",
    db: AsyncSession = Depends(get_db)
):
    """특정 품목의 향후 14일 일별 수요 예측치(yhat, p10, p90) 조회"""
    try:
        return await ForecastService.get_item_forecast(db, item_id, warehouse_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/run-batch")
async def run_batch_forecast(
    warehouse_id: str = "WH-ASAN",
    db: AsyncSession = Depends(get_db)
):
    """전 품목 수요 예측 일괄 배치 수동 실행"""
    count = await ForecastService.run_batch_forecast(db, warehouse_id)
    return {"status": "success", "generated_forecast_points": count}
