from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.master import Item, SupplyTerm, Supplier
from app.models.inventory import InventoryBatch
from app.models.purchases import PurchaseOrder, PurchaseOrderLine
from app.schemas.inventory import (
    InventorySummaryResponse, InventoryProductDTO, BatchDTO, InventoryAdjustRequest
)

class InventoryService:
    @staticmethod
    async def get_inventory_summary(db: AsyncSession, warehouse_id: str = "WH-ASAN") -> InventorySummaryResponse:
        today = date.today()

        # 1. 품목 목록 및 주 공급업체 정보 조회
        stmt = (
            select(Item, Supplier.supplier_id, Supplier.supplier_name)
            .outerjoin(SupplyTerm, and_(Item.item_id == SupplyTerm.item_id, SupplyTerm.is_primary == True))
            .outerjoin(Supplier, SupplyTerm.supplier_id == Supplier.supplier_id)
            .order_by(Item.category_l, Item.item_name)
        )
        result = await db.execute(stmt)
        item_rows = result.all()

        # 2. 로트별 재고 조회
        batch_stmt = (
            select(InventoryBatch)
            .where(InventoryBatch.warehouse_id == warehouse_id)
            .order_by(InventoryBatch.expiry_date.asc())
        )
        batch_res = await db.execute(batch_stmt)
        all_batches = batch_res.scalars().all()

        # 품목별 로트 매핑
        batches_by_item: dict[str, list[InventoryBatch]] = {}
        for b in all_batches:
            batches_by_item.setdefault(b.item_id, []).append(b)

        # 3. 입고 예정 수량 조회 (purchase_orders: ordered or partial 상태)
        incoming_stmt = (
            select(
                PurchaseOrderLine.item_id,
                func.coalesce(func.sum(PurchaseOrderLine.order_qty - PurchaseOrderLine.received_qty), 0)
            )
            .join(PurchaseOrder, PurchaseOrderLine.po_id == PurchaseOrder.po_id)
            .where(PurchaseOrder.status.in_(["ordered", "partial"]))
            .group_by(PurchaseOrderLine.item_id)
        )
        inc_res = await db.execute(incoming_stmt)
        incoming_by_item = dict(inc_res.all())

        product_dtos: list[InventoryProductDTO] = []
        total_stock_value = 0
        low_count = 0
        out_count = 0
        expiring_count = 0

        for item, sup_id, sup_name in item_rows:
            item_batches = batches_by_item.get(item.item_id, [])
            total_qty = sum(float(b.qty) for b in item_batches)
            cost_price = int(item.cost_price)
            safety_stock = float(item.safety_stock)
            incoming_qty = float(incoming_by_item.get(item.item_id, 0))

            batch_dtos: list[BatchDTO] = []
            has_urgent_batch = False

            for b in item_batches:
                days_left = (b.expiry_date - today).days
                is_urgent = 0 <= days_left <= 3
                if is_urgent:
                    has_urgent_batch = True
                loss_amount = int(float(b.qty) * cost_price)
                
                batch_dtos.append(
                    BatchDTO(
                        batch_id=b.batch_id,
                        item_id=b.item_id,
                        warehouse_id=b.warehouse_id,
                        expiry_date=b.expiry_date,
                        qty=float(b.qty),
                        days_left=days_left,
                        is_urgent=is_urgent,
                        loss_amount=loss_amount
                    )
                )

            # 상태 판별
            if total_qty == 0:
                status = "out"
                out_count += 1
            elif total_qty < safety_stock:
                status = "low"
                low_count += 1
            elif has_urgent_batch:
                status = "expiring"
                expiring_count += 1
            else:
                status = "normal"

            if has_urgent_batch and status != "expiring":
                expiring_count += 1

            total_stock_value += int(total_qty * cost_price)

            product_dtos.append(
                InventoryProductDTO(
                    id=item.item_id,
                    name=item.item_name,
                    category=item.category_l,
                    unit=item.uom,
                    price=int(item.sale_price),
                    cost_price=cost_price,
                    pack_size=float(item.pack_size),
                    total_qty=total_qty,
                    available_qty=total_qty, # 미출고 수주 고려 가능
                    safety_stock=safety_stock,
                    status=status,
                    supplier_id=sup_id,
                    supplier_name=sup_name,
                    batches=batch_dtos,
                    incoming_qty=incoming_qty
                )
            )

        return InventorySummaryResponse(
            products=product_dtos,
            total_stock_value=total_stock_value,
            low_stock_count=low_count,
            out_of_stock_count=out_count,
            expiring_soon_count=expiring_count,
            updated_at=datetime.utcnow().isoformat()
        )

    @staticmethod
    async def adjust_stock(db: AsyncSession, req: InventoryAdjustRequest):
        # 특정 로트 또는 기본 로트 수량 조정
        if req.batch_id:
            batch = await db.get(InventoryBatch, req.batch_id)
            if batch:
                batch.qty = req.adjusted_qty
        else:
            stmt = select(InventoryBatch).where(
                InventoryBatch.item_id == req.item_id,
                InventoryBatch.warehouse_id == req.warehouse_id
            ).order_by(InventoryBatch.expiry_date.asc())
            res = await db.execute(stmt)
            batch = res.scalars().first()
            if batch:
                batch.qty = req.adjusted_qty
        await db.commit()
        return {"status": "success", "adjusted_qty": req.adjusted_qty}
from datetime import datetime
