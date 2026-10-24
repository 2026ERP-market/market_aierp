import math
from datetime import date, timedelta, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.models.master import Item, SupplyTerm, Supplier
from app.models.inventory import InventoryBatch
from app.models.purchases import PurchaseOrder, PurchaseOrderLine, OrderRecommendation
from app.schemas.purchases import (
    RecommendationResponse, PurchaseOrderResponse, PurchaseOrderLineDTO, OrderStatus
)
from app.services.forecast_service import ForecastService

# 안전재고 산출 파라미터.
# 리드타임 수요는 포아송에 가까워(검증: 잔차 CV 0.143 ≈ 1/√평균) 분산 ≈ 평균.
# 따라서 리드타임 L일 수요의 표준편차 σ_LT ≈ √(리드타임 예측수요).
# 안전재고 = z · σ_LT  (서비스수준 95% → z=1.65, 품절 허용 5%).
SERVICE_LEVEL = 0.95
SERVICE_Z = 1.65


class ReplenishmentService:
    @staticmethod
    async def get_or_generate_recommendations(db: AsyncSession, warehouse_id: str = "WH-ASAN") -> list[RecommendationResponse]:
        today = date.today()

        # 1. 오늘 날짜로 이미 생성된 추천이 있는지 확인
        rec_stmt = (
            select(OrderRecommendation, Item, Supplier)
            .join(Item, OrderRecommendation.item_id == Item.item_id)
            .join(Supplier, OrderRecommendation.supplier_id == Supplier.supplier_id)
            .where(
                OrderRecommendation.recommend_date == today,
                OrderRecommendation.warehouse_id == warehouse_id
            )
            .order_by(OrderRecommendation.created_at.desc())
        )
        rec_res = await db.execute(rec_stmt)
        existing_recs = rec_res.all()

        if existing_recs:
            return [
                ReplenishmentService._to_rec_dto(rec, item, sup)
                for rec, item, sup in existing_recs
            ]

        # 2. 없으면 자동 발주 계산 알고리즘 실행
        return await ReplenishmentService.calculate_and_save_recommendations(db, warehouse_id, today)

    @staticmethod
    async def calculate_and_save_recommendations(db: AsyncSession, warehouse_id: str, today: date) -> list[RecommendationResponse]:
        # 품목 + 주 공급업체 계약조건 조회
        stmt = (
            select(Item, SupplyTerm, Supplier)
            .join(SupplyTerm, and_(Item.item_id == SupplyTerm.item_id, SupplyTerm.is_primary == True))
            .join(Supplier, SupplyTerm.supplier_id == Supplier.supplier_id)
        )
        res = await db.execute(stmt)
        rows = res.all()

        # 현재 재고 집계
        batch_stmt = (
            select(InventoryBatch.item_id, func.coalesce(func.sum(InventoryBatch.qty), 0))
            .where(InventoryBatch.warehouse_id == warehouse_id)
            .group_by(InventoryBatch.item_id)
        )
        batch_res = await db.execute(batch_stmt)
        stock_by_item = dict(batch_res.all())

        # 입고 예정 수량 집계
        incoming_stmt = (
            select(PurchaseOrderLine.item_id, func.coalesce(func.sum(PurchaseOrderLine.order_qty - PurchaseOrderLine.received_qty), 0))
            .join(PurchaseOrder, PurchaseOrderLine.po_id == PurchaseOrder.po_id)
            .where(PurchaseOrder.status.in_(["ordered", "partial"]))
            .group_by(PurchaseOrderLine.item_id)
        )
        inc_res = await db.execute(incoming_stmt)
        incoming_by_item = dict(inc_res.all())

        recommendations: list[RecommendationResponse] = []
        rec_counter = 1

        for item, term, supplier in rows:
            lead_time = max(1, int(term.lead_time_days))
            review_period = 2 # 발주 주기 (통상 2일)
            days_to_cover = lead_time + review_period

            # 해당 기간 수요 예측치 합산
            forecast_data = await ForecastService.get_item_forecast(db, item.item_id, warehouse_id)
            points = forecast_data.forecasts[:days_to_cover]
            demand_sum = sum(p.yhat for p in points)
            # 안전재고를 고정상수가 아니라 서비스수준 기반으로 산출.
            # 리드타임 동안의 예측수요에 포아송 분산을 적용: σ_LT = √(리드타임 수요).
            lead_demand = sum(p.yhat for p in forecast_data.forecasts[:lead_time])
            safety_stock = round(SERVICE_Z * math.sqrt(max(lead_demand, 1.0)), 1)
            current_stock = float(stock_by_item.get(item.item_id, 0.0))
            incoming_stock = float(incoming_by_item.get(item.item_id, 0.0))

            needed = demand_sum + safety_stock
            shortage = needed - (current_stock + incoming_stock)

            if shortage > 0:
                # 발주 배수(order_multiple) 올림 및 MOQ 반영
                multiple = max(1.0, float(term.order_multiple))
                moq = float(term.moq)
                batches_needed = math.ceil(shortage / multiple)
                calc_qty = batches_needed * multiple
                final_qty = max(calc_qty, moq)

                is_urgent = (current_stock <= safety_stock * 0.5)

                # 사유 생성
                reason = (
                    f"리드타임({lead_time}일)+발주주기 예상수요 {demand_sum:.1f}개 및 "
                    f"안전재고 {safety_stock:.1f}개(서비스수준 {int(SERVICE_LEVEL*100)}%) 대비 "
                    f"가용재고 {current_stock:.1f}개 부족. 최소 발주배수({multiple:.0f}개) 올림 적용."
                )

                rec_id = f"REC-{today.strftime('%y%m%d')}-{rec_counter:04d}"
                rec_counter += 1

                rec_entity = OrderRecommendation(
                    rec_id=rec_id,
                    recommend_date=today,
                    item_id=item.item_id,
                    warehouse_id=warehouse_id,
                    supplier_id=supplier.supplier_id,
                    current_stock=current_stock,
                    forecast_demand=demand_sum,
                    safety_stock=safety_stock,
                    recommended_qty=final_qty,
                    status="draft",
                    reason=reason
                )
                db.add(rec_entity)

                recommendations.append(
                    ReplenishmentService._to_rec_dto(rec_entity, item, supplier)
                )

        await db.commit()
        return recommendations

    @staticmethod
    def _to_rec_dto(rec: OrderRecommendation, item: Item, sup: Supplier) -> RecommendationResponse:
        pack_size = float(item.pack_size)
        qty = float(rec.recommended_qty)
        order_amount = int(qty * float(item.cost_price))
        is_urgent = float(rec.current_stock) <= float(rec.safety_stock) * 0.5
        return RecommendationResponse(
            rec_id=rec.rec_id,
            recommend_date=rec.recommend_date,
            item_id=item.item_id,
            item_name=item.item_name,
            category=item.category_l,
            warehouse_id=rec.warehouse_id,
            supplier_id=sup.supplier_id,
            supplier_name=sup.supplier_name,
            current_stock=float(rec.current_stock),
            forecast_demand=float(rec.forecast_demand),
            safety_stock=float(rec.safety_stock),
            recommended_qty=qty,
            order_amount=order_amount,
            pack_size=pack_size,
            lead_time_days=int(sup.lead_time_days),
            urgent=is_urgent,
            status=rec.status,
            reason=rec.reason
        )

    @staticmethod
    async def update_recommendation_action(db: AsyncSession, rec_id: str, action: str, modified_qty: float | None = None):
        rec = await db.get(OrderRecommendation, rec_id)
        if not rec:
            raise ValueError("Recommendation not found")

        if action == "approve":
            rec.status = "approved"
            if modified_qty is not None:
                rec.recommended_qty = modified_qty
        elif action == "reject":
            rec.status = "rejected"
        elif action == "modify" and modified_qty is not None:
            rec.recommended_qty = modified_qty

        await db.commit()
        return {"status": "success", "rec_id": rec_id, "new_status": rec.status, "qty": float(rec.recommended_qty)}

    @staticmethod
    async def create_purchase_order_from_approved(db: AsyncSession, supplier_id: str, warehouse_id: str = "WH-ASAN") -> PurchaseOrderResponse:
        today = date.today()
        # 해당 공급업체의 approved 추천건 조회
        stmt = (
            select(OrderRecommendation, Item)
            .join(Item, OrderRecommendation.item_id == Item.item_id)
            .where(
                OrderRecommendation.supplier_id == supplier_id,
                OrderRecommendation.status == "approved"
            )
        )
        res = await db.execute(stmt)
        rows = res.all()

        if not rows:
            raise ValueError(f"No approved recommendations for supplier: {supplier_id}")

        supplier = await db.get(Supplier, supplier_id)
        lead_time = supplier.lead_time_days if supplier else 2
        expected_date = today + timedelta(days=lead_time)

        # PO ID 생성 (같은 공급사·당일 반복 발행 시 충돌하지 않도록 시각 suffix 포함)
        po_id = f"PO-{today.strftime('%y%m%d')}-{supplier_id[-4:]}-{datetime.now().strftime('%H%M%S')}"
        po = PurchaseOrder(
            po_id=po_id,
            supplier_id=supplier_id,
            order_date=today,
            expected_date=expected_date,
            total_amount=0,
            status="ordered"
        )
        db.add(po)

        total_amount = 0
        lines_dto: list[PurchaseOrderLineDTO] = []
        for line_no, (rec, item) in enumerate(rows, start=1):
            qty = float(rec.recommended_qty)
            cost = int(item.cost_price)
            line_amount = int(qty * cost)
            total_amount += line_amount

            line = PurchaseOrderLine(
                po_id=po_id,
                line_no=line_no,
                item_id=item.item_id,
                order_qty=qty,
                received_qty=0.0,
                unit_cost=cost
            )
            db.add(line)
            rec.status = "ordered"

            lines_dto.append(
                PurchaseOrderLineDTO(
                    line_no=line_no,
                    item_id=item.item_id,
                    item_name=item.item_name,
                    order_qty=qty,
                    received_qty=0.0,
                    unit_cost=cost,
                    amount=line_amount
                )
            )

        po.total_amount = total_amount
        await db.commit()

        return PurchaseOrderResponse(
            po_id=po.po_id,
            supplier_id=supplier.supplier_id,
            supplier_name=supplier.supplier_name,
            order_date=po.order_date,
            expected_date=po.expected_date,
            received_date=None,
            total_amount=po.total_amount,
            status="ordered",
            lines=lines_dto,
            created_at=po.created_at
        )

    @staticmethod
    async def receive_purchase_order(db: AsyncSession, po_id: str, received_items: list[dict]):
        po = await db.get(PurchaseOrder, po_id)
        if not po:
            raise ValueError("Purchase Order not found")

        today = date.today()
        po.received_date = today
        po.status = "received"

        for item_data in received_items:
            line_no = item_data.get("line_no")
            recv_qty = float(item_data.get("received_qty", 0.0))
            expiry_str = item_data.get("expiry_date")

            line = await db.get(PurchaseOrderLine, (po_id, line_no))
            if line:
                line.received_qty = recv_qty
                
                # 로트 재고로 반영 (새로운 batch 생성)
                item = await db.get(Item, line.item_id)
                expiry_date = (
                    datetime.strptime(expiry_str, "%Y-%m-%d").date()
                    if expiry_str
                    else today + timedelta(days=item.shelf_life_days or 30)
                )

                batch_id = f"BAT-{today.strftime('%y%m%d')}-{line.item_id[-5:]}"
                batch = InventoryBatch(
                    batch_id=batch_id,
                    item_id=line.item_id,
                    warehouse_id="WH-ASAN",
                    expiry_date=expiry_date,
                    qty=recv_qty,
                    received_date=today
                )
                db.add(batch)

        await db.commit()
        return {"status": "success", "po_id": po_id, "new_status": "received"}
