from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.automation import (
    AutomationSettingsResponse, AutomationSettingsUpdateRequest,
    AutomationRunsPageResponse, AutomationRunDTO
)
from app.services.automation_service import AutomationService

router = APIRouter(prefix="/automation", tags=["Automation"])

@router.get("/settings", response_model=AutomationSettingsResponse)
async def get_automation_settings(
    warehouse_id: str = "WH-ASAN",
    db: AsyncSession = Depends(get_db)
):
    """매장별 AI 자동 발주 설정 조회"""
    return await AutomationService.get_settings(db, warehouse_id)

@router.put("/settings", response_model=AutomationSettingsResponse)
async def update_automation_settings(
    req: AutomationSettingsUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """매장별 AI 자동 발주 설정 저장 (ON/OFF 토글 및 버전 충돌 검증)"""
    try:
        return await AutomationService.update_settings(db, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

@router.get("/runs", response_model=AutomationRunsPageResponse)
async def list_automation_runs(
    warehouse_id: str = "WH-ASAN",
    limit: int = 50,
    cursor: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    """자동 발주 감사 로그 및 실행 기록 조회"""
    return await AutomationService.list_runs(db, warehouse_id, limit, cursor)

@router.post("/trigger", response_model=list[AutomationRunDTO])
async def trigger_automation_run(
    warehouse_id: str = "WH-ASAN",
    db: AsyncSession = Depends(get_db)
):
    """서버 작업자: 자동 발주 즉시 실행 트리거 (ON 매장에 한함)"""
    return await AutomationService.execute_automated_orders(db, warehouse_id)
