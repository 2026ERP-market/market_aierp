from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.dashboard import DashboardSummaryResponse
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    warehouse_id: str = "WH-ASAN",
    db: AsyncSession = Depends(get_db)
):
    """웹 및 모바일 홈 대시보드 종합 지표 요약 조회"""
    return await DashboardService.get_dashboard_summary(db, warehouse_id)
