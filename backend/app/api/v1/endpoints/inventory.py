from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.schemas.inventory import (
    InventorySummaryResponse, InventoryAdjustRequest, BatchDTO
)
from app.models.inventory import InventoryBatch
from app.services.inventory_service import InventoryService
from datetime import date

router = APIRouter(prefix="/inventory", tags=["Inventory"])

@router.get("/current", response_model=InventorySummaryResponse)
async def get_current_inventory(
    warehouse_id: str = "WH-ASAN",
    db: AsyncSession = Depends(get_db)
):
    """실시간 재고 현황 및 품목별 위험도(StockStatus) 조회"""
    return await InventoryService.get_inventory_summary(db, warehouse_id)

@router.get("/batches", response_model=list[BatchDTO])
async def list_batches(
    warehouse_id: str = "WH-ASAN",
    db: AsyncSession = Depends(get_db)
):
    """소비기한/유통기한별 로트(Batch) 목록 조회"""
    today = date.today()
    stmt = (
        select(InventoryBatch)
        .where(InventoryBatch.warehouse_id == warehouse_id)
        .order_by(InventoryBatch.expiry_date.asc())
    )
    res = await db.execute(stmt)
    batches = res.scalars().all()
    
    result = []
    for b in batches:
        days_left = (b.expiry_date - today).days
        result.append(
            BatchDTO(
                batch_id=b.batch_id,
                item_id=b.item_id,
                warehouse_id=b.warehouse_id,
                expiry_date=b.expiry_date,
                qty=float(b.qty),
                days_left=days_left,
                is_urgent=0 <= days_left <= 3,
                loss_amount=0 # 단순 목록용
            )
        )
    return result

@router.post("/adjust")
async def adjust_stock(
    req: InventoryAdjustRequest,
    db: AsyncSession = Depends(get_db)
):
    """재고 실사 및 수량 수동 조정"""
    return await InventoryService.adjust_stock(db, req)
