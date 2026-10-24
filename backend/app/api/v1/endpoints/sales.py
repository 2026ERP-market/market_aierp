from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.sales import SalesCreate, SalesSummaryResponse
from app.services.sales_service import SalesService

router = APIRouter(prefix="/sales", tags=["Sales"])

@router.post("", status_code=201)
async def record_sale(
    sale_in: SalesCreate,
    db: AsyncSession = Depends(get_db)
):
    """판매(출고) 트랜잭션 기록 및 선입선출(FIFO) 재고 자동 차감"""
    try:
        sale = await SalesService.record_sale(db, sale_in)
        return {"status": "success", "order_id": sale.order_id, "amount": sale.amount}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/summary", response_model=SalesSummaryResponse)
async def get_sales_summary(
    days: int = 14,
    db: AsyncSession = Depends(get_db)
):
    """판매 실적 통계, 일별 매출 트렌드, 카테고리 비중 및 베스트셀러 랭킹 조회"""
    return await SalesService.get_sales_summary(db, days)
