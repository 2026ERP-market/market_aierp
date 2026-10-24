from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.purchases import PurchaseOrder, PurchaseOrderLine, OrderRecommendation
from app.models.master import Supplier
from app.schemas.purchases import (
    RecommendationResponse, RecommendationActionRequest,
    PurchaseOrderResponse, PurchaseOrderLineDTO, ReceiveOrderRequest
)
from app.services.replenishment_service import ReplenishmentService

router = APIRouter(prefix="/purchases", tags=["Purchases"])

@router.get("/recommend", response_model=list[RecommendationResponse])
async def get_recommendations(
    warehouse_id: str = "WH-ASAN",
    db: AsyncSession = Depends(get_db)
):
    """오늘자 AI 자동 발주 추천 목록 조회 (부족 재고, 예상 수요, 배수 올림 및 사유 포함)"""
    return await ReplenishmentService.get_or_generate_recommendations(db, warehouse_id)

@router.post("/recommend/{rec_id}/action")
async def action_recommendation(
    rec_id: str,
    req: RecommendationActionRequest,
    db: AsyncSession = Depends(get_db)
):
    """추천 발주 승인(approve), 수정(modify), 거절(reject) 액션 처리"""
    try:
        return await ReplenishmentService.update_recommendation_action(
            db, rec_id, req.action, req.modified_qty
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/orders")
async def create_purchase_order(
    supplier_id: str,
    warehouse_id: str = "WH-ASAN",
    db: AsyncSession = Depends(get_db)
):
    """승인된 발주 추천 목록을 기반으로 공급사별 발주서(PO) 최종 발행"""
    try:
        return await ReplenishmentService.create_purchase_order_from_approved(db, supplier_id, warehouse_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/orders", response_model=list[PurchaseOrderResponse])
async def list_purchase_orders(
    status: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    """발주서(PO) 목록 조회"""
    stmt = (
        select(PurchaseOrder, Supplier)
        .join(Supplier, PurchaseOrder.supplier_id == Supplier.supplier_id)
        .order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.created_at.desc())
    )
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)

    res = await db.execute(stmt)
    rows = res.all()

    orders_dto: list[PurchaseOrderResponse] = []
    for po, sup in rows:
        line_stmt = select(PurchaseOrderLine).where(PurchaseOrderLine.po_id == po.po_id).order_by(PurchaseOrderLine.line_no.asc())
        lines_res = await db.execute(line_stmt)
        lines = lines_res.scalars().all()

        line_dtos = [
            PurchaseOrderLineDTO(
                line_no=l.line_no,
                item_id=l.item_id,
                item_name="",
                order_qty=float(l.order_qty),
                received_qty=float(l.received_qty),
                unit_cost=int(l.unit_cost),
                amount=int(float(l.order_qty) * int(l.unit_cost))
            )
            for l in lines
        ]

        orders_dto.append(
            PurchaseOrderResponse(
                po_id=po.po_id,
                supplier_id=sup.supplier_id,
                supplier_name=sup.supplier_name,
                order_date=po.order_date,
                expected_date=po.expected_date,
                received_date=po.received_date,
                total_amount=po.total_amount,
                status=po.status,
                lines=line_dtos,
                created_at=po.created_at
            )
        )
    return orders_dto

@router.post("/orders/{po_id}/receive")
async def receive_purchase_order(
    po_id: str,
    req: ReceiveOrderRequest,
    db: AsyncSession = Depends(get_db)
):
    """발주 상품 입고 확인 및 실재고(로트) 반영"""
    try:
        return await ReplenishmentService.receive_purchase_order(db, po_id, req.received_items)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
