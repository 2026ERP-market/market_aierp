import json
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.automation import StoreAutomationSetting, AutomationRunLog
from app.models.purchases import PurchaseOrder, PurchaseOrderLine, OrderRecommendation
from app.models.master import Item, Supplier
from app.schemas.automation import (
    AutomationSettingsResponse, AutomationSettingsUpdateRequest,
    AutomationPolicyDTO, AutomationRunDTO, AutomationRunsPageResponse
)
from app.services.replenishment_service import ReplenishmentService

class AutomationService:
    @staticmethod
    def _to_run_dto(r: AutomationRunLog) -> AutomationRunDTO:
        return AutomationRunDTO(
            run_id=r.run_id,
            recommendation_id=r.recommendation_id,
            item_id=r.item_id,
            item_name=r.item_name,
            product_id=r.item_id,
            product_name=r.item_name,
            status=r.status,
            order_id=r.order_id,
            original_qty=float(r.original_qty),
            final_qty=float(r.final_qty),
            reason=r.reason,
            policy_version=r.policy_version,
            executed_at=r.executed_at
        )

    @staticmethod
    async def get_settings(db: AsyncSession, warehouse_id: str = "WH-ASAN") -> AutomationSettingsResponse:
        stmt = select(StoreAutomationSetting).where(StoreAutomationSetting.warehouse_id == warehouse_id)
        res = await db.execute(stmt)
        setting = res.scalar_one_or_none()

        if not setting:
            setting = StoreAutomationSetting(
                warehouse_id=warehouse_id,
                enabled=False,
                version=1,
                can_manage=True,
                daily_budget_limit=5000000,
                allowed_categories="[]",
                policy_version="v1",
                worker_status="idle",
                updated_at=datetime.utcnow()
            )
            db.add(setting)
            await db.commit()
            await db.refresh(setting)

        allowed_cats = []
        if setting.allowed_categories:
            try:
                allowed_cats = json.loads(setting.allowed_categories)
            except Exception:
                allowed_cats = [c.strip() for c in setting.allowed_categories.split(",") if c.strip()]

        return AutomationSettingsResponse(
            warehouse_id=setting.warehouse_id,
            enabled=setting.enabled,
            version=setting.version,
            updated_at=setting.updated_at,
            can_manage=setting.can_manage,
            policy=AutomationPolicyDTO(
                daily_budget_limit=setting.daily_budget_limit,
                allowed_categories=allowed_cats
            ),
            worker_status=setting.worker_status
        )

    @staticmethod
    async def update_settings(db: AsyncSession, req: AutomationSettingsUpdateRequest) -> AutomationSettingsResponse:
        stmt = select(StoreAutomationSetting).where(StoreAutomationSetting.warehouse_id == req.warehouse_id)
        res = await db.execute(stmt)
        setting = res.scalar_one_or_none()

        if not setting:
            setting = StoreAutomationSetting(
                warehouse_id=req.warehouse_id,
                enabled=False,
                version=1,
                can_manage=True,
                daily_budget_limit=5000000,
                allowed_categories="[]",
                policy_version="v1",
                worker_status="idle",
                updated_at=datetime.utcnow()
            )
            db.add(setting)
            await db.commit()
            await db.refresh(setting)

        if setting.version != req.expected_version:
            raise ValueError("설정 버전 충돌이 발생했습니다. 최신 설정을 다시 불러와 주세요.")

        was_enabled = setting.enabled
        setting.enabled = req.enabled
        setting.version += 1
        setting.updated_at = datetime.utcnow()
        if req.enabled:
            setting.agreed_by = req.agreed_by or "STORE_OWNER"
            setting.agreed_at = datetime.utcnow()
            setting.policy_version = req.policy_version or "v1"

        await db.commit()
        await db.refresh(setting)

        # OFF -> ON 변경 시 즉시 미처리 추천 건 자동 발주 실행
        if req.enabled and not was_enabled:
            await AutomationService.execute_automated_orders(db, req.warehouse_id)

        return await AutomationService.get_settings(db, req.warehouse_id)

    @staticmethod
    async def list_runs(
        db: AsyncSession,
        warehouse_id: str = "WH-ASAN",
        limit: int = 50,
        cursor: str | None = None
    ) -> AutomationRunsPageResponse:
        stmt = (
            select(AutomationRunLog)
            .where(AutomationRunLog.warehouse_id == warehouse_id)
            .order_by(AutomationRunLog.executed_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        rows = res.scalars().all()

        dtos = [AutomationService._to_run_dto(r) for r in rows]
        return AutomationRunsPageResponse(runs=dtos, next_cursor=None)

    @staticmethod
    async def execute_automated_orders(db: AsyncSession, warehouse_id: str = "WH-ASAN") -> list[AutomationRunDTO]:
        stmt = select(StoreAutomationSetting).where(StoreAutomationSetting.warehouse_id == warehouse_id)
        res = await db.execute(stmt)
        setting = res.scalar_one_or_none()

        if not setting or not setting.enabled:
            return []

        setting.worker_status = "running"
        await db.commit()

        today = date.today()
        # 오늘자 추천 확보 (없으면 생성)
        await ReplenishmentService.get_or_generate_recommendations(db, warehouse_id)

        # 오늘자 자동 발주 누적액 계산
        spent_stmt = (
            select(func.coalesce(func.sum(PurchaseOrder.total_amount), 0))
            .where(
                PurchaseOrder.warehouse_id == warehouse_id,
                PurchaseOrder.order_date == today,
                PurchaseOrder.source == "automation"
            )
        )
        spent_res = await db.execute(spent_stmt)
        spent_today = float(spent_res.scalar() or 0)
        daily_budget_limit = float(setting.daily_budget_limit or 5000000)

        # 기존 미입고 발주 품목 확인 (중복 발주 방지)
        open_po_stmt = (
            select(PurchaseOrderLine.item_id)
            .join(PurchaseOrder, PurchaseOrderLine.po_id == PurchaseOrder.po_id)
            .where(
                PurchaseOrder.warehouse_id == warehouse_id,
                PurchaseOrder.status.in_(["ordered", "partial"])
            )
        )
        open_pos_res = await db.execute(open_po_stmt)
        open_po_items = set(open_pos_res.scalars().all())

        # 오늘자 draft 상태의 추천건 조회
        rec_stmt = (
            select(OrderRecommendation, Item, Supplier)
            .join(Item, OrderRecommendation.item_id == Item.item_id)
            .join(Supplier, OrderRecommendation.supplier_id == Supplier.supplier_id)
            .where(
                OrderRecommendation.warehouse_id == warehouse_id,
                OrderRecommendation.recommend_date == today,
                OrderRecommendation.status == "draft"
            )
            .order_by(OrderRecommendation.created_at.asc())
        )
        rec_res = await db.execute(rec_stmt)
        candidates = rec_res.all()

        run_results: list[AutomationRunDTO] = []
        counter = 1

        for rec, item, supplier in candidates:
            run_id = f"ARUN-{datetime.utcnow().strftime('%y%m%d%H%M%S')}-{counter:03d}"
            counter += 1

            qty = float(rec.recommended_qty)
            cost = int(item.cost_price or item.price or 0)

            # 1. 수량 검증: 양의 정수
            if qty <= 0 or not qty.is_integer():
                log = AutomationRunLog(
                    run_id=run_id,
                    warehouse_id=warehouse_id,
                    recommendation_id=rec.rec_id,
                    item_id=item.item_id,
                    item_name=item.item_name,
                    status="skipped",
                    original_qty=qty,
                    final_qty=qty,
                    reason=f"수량 오류: 양의 정수 필요 (수량: {qty})",
                    order_id=None,
                    policy_version="v1",
                    executed_at=datetime.utcnow()
                )
                db.add(log)
                run_results.append(AutomationService._to_run_dto(log))
                continue

            final_qty_int = int(qty)

            # 2. 매입단가 검증
            if cost <= 0:
                log = AutomationRunLog(
                    run_id=run_id,
                    warehouse_id=warehouse_id,
                    recommendation_id=rec.rec_id,
                    item_id=item.item_id,
                    item_name=item.item_name,
                    status="skipped",
                    original_qty=qty,
                    final_qty=qty,
                    reason="매입단가 미제공 또는 유효하지 않음 (단가 확인 필요)",
                    order_id=None,
                    policy_version="v1",
                    executed_at=datetime.utcnow()
                )
                db.add(log)
                run_results.append(AutomationService._to_run_dto(log))
                continue

            # 3. 공급업체명 검증
            if not supplier or not supplier.supplier_name.strip():
                log = AutomationRunLog(
                    run_id=run_id,
                    warehouse_id=warehouse_id,
                    recommendation_id=rec.rec_id,
                    item_id=item.item_id,
                    item_name=item.item_name,
                    status="skipped",
                    original_qty=qty,
                    final_qty=qty,
                    reason="공급업체 마스터 정보 불완전",
                    order_id=None,
                    policy_version="v1",
                    executed_at=datetime.utcnow()
                )
                db.add(log)
                run_results.append(AutomationService._to_run_dto(log))
                continue

            # 4. 기존 미입고 발주 건 확인 (중복 발주 방지)
            if item.item_id in open_po_items:
                log = AutomationRunLog(
                    run_id=run_id,
                    warehouse_id=warehouse_id,
                    recommendation_id=rec.rec_id,
                    item_id=item.item_id,
                    item_name=item.item_name,
                    status="skipped",
                    original_qty=qty,
                    final_qty=qty,
                    reason="기존 미입고 발주 건 존재 (중복 발주 방지)",
                    order_id=None,
                    policy_version="v1",
                    executed_at=datetime.utcnow()
                )
                db.add(log)
                run_results.append(AutomationService._to_run_dto(log))
                continue

            # 5. 일일 누적 예산 한도 검증
            line_amount = final_qty_int * cost
            if spent_today + line_amount > daily_budget_limit:
                log = AutomationRunLog(
                    run_id=run_id,
                    warehouse_id=warehouse_id,
                    recommendation_id=rec.rec_id,
                    item_id=item.item_id,
                    item_name=item.item_name,
                    status="skipped",
                    original_qty=qty,
                    final_qty=qty,
                    reason=f"일일 자동 발주 예산 한도 초과 (한도: {int(daily_budget_limit):,}원, 현재: {int(spent_today):,}원, 요청: {line_amount:,}원)",
                    order_id=None,
                    policy_version="v1",
                    executed_at=datetime.utcnow()
                )
                db.add(log)
                run_results.append(AutomationService._to_run_dto(log))
                continue

            # 6. 과잉 재고 위험 검증
            if float(rec.current_stock) > float(rec.safety_stock) * 2.5:
                log = AutomationRunLog(
                    run_id=run_id,
                    warehouse_id=warehouse_id,
                    recommendation_id=rec.rec_id,
                    item_id=item.item_id,
                    item_name=item.item_name,
                    status="skipped",
                    original_qty=qty,
                    final_qty=qty,
                    reason="과잉 재고 위험 품목 (수동 검토 필요)",
                    order_id=None,
                    policy_version="v1",
                    executed_at=datetime.utcnow()
                )
                db.add(log)
                run_results.append(AutomationService._to_run_dto(log))
                continue

            # 모든 정책 검증 통과 -> 발주서 발행
            try:
                lead_time = supplier.lead_time_days if supplier else 2
                expected_date = today + timedelta(days=lead_time)
                po_id = f"PO-{today.strftime('%y%m%d')}-{supplier.supplier_id[-4:]}-{datetime.now().strftime('%H%M%S')}-{counter:02d}"

                po = PurchaseOrder(
                    po_id=po_id,
                    warehouse_id=warehouse_id,
                    supplier_id=supplier.supplier_id,
                    order_date=today,
                    expected_date=expected_date,
                    total_amount=line_amount,
                    status="ordered",
                    source="automation",
                    automation_run_id=run_id,
                    rec_id=rec.rec_id,
                    rec_model_version="dow-seasonal-v1",
                    created_at=datetime.utcnow()
                )
                db.add(po)

                line = PurchaseOrderLine(
                    po_id=po_id,
                    line_no=1,
                    item_id=item.item_id,
                    order_qty=float(final_qty_int),
                    received_qty=0.0,
                    unit_cost=cost
                )
                db.add(line)

                rec.status = "ordered"
                open_po_items.add(item.item_id)
                spent_today += line_amount

                log = AutomationRunLog(
                    run_id=run_id,
                    warehouse_id=warehouse_id,
                    recommendation_id=rec.rec_id,
                    item_id=item.item_id,
                    item_name=item.item_name,
                    status="created",
                    original_qty=qty,
                    final_qty=float(final_qty_int),
                    reason="AI 추천 기반 자동 발주 완료 (정책 검증 통과)",
                    order_id=po_id,
                    policy_version="v1",
                    executed_at=datetime.utcnow()
                )
                db.add(log)
                run_results.append(AutomationService._to_run_dto(log))

            except Exception as e:
                log = AutomationRunLog(
                    run_id=run_id,
                    warehouse_id=warehouse_id,
                    recommendation_id=rec.rec_id,
                    item_id=item.item_id,
                    item_name=item.item_name,
                    status="failed",
                    original_qty=qty,
                    final_qty=qty,
                    reason=f"발주 처리 중 시스템 오류: {str(e)}",
                    order_id=None,
                    policy_version="v1",
                    executed_at=datetime.utcnow()
                )
                db.add(log)
                run_results.append(AutomationService._to_run_dto(log))

        setting.worker_status = "idle"
        await db.commit()
        return run_results
