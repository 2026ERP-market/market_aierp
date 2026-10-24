from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.sales import Sales
from app.models.purchases import PurchaseOrder, OrderRecommendation
from app.models.inventory import InventoryBatch
from app.schemas.dashboard import DashboardSummaryResponse, DashboardTodo
from app.services.inventory_service import InventoryService
from app.services.replenishment_service import ReplenishmentService

class DashboardService:
    @staticmethod
    async def get_dashboard_summary(db: AsyncSession, warehouse_id: str = "WH-ASAN") -> DashboardSummaryResponse:
        today = date.today()

        # 1. 당일 판매 실적 집계
        rev_stmt = select(func.coalesce(func.sum(Sales.amount), 0)).where(
            Sales.sale_date == today,
            Sales.is_return == False
        )
        rev_res = await db.execute(rev_stmt)
        today_rev = int(rev_res.scalar_one())

        # 만약 오늘 판매가 없으면 최근 기록된 일자의 판매액 사용
        if today_rev == 0:
            latest_date_stmt = select(Sales.sale_date).order_by(Sales.sale_date.desc()).limit(1)
            latest_date = (await db.execute(latest_date_stmt)).scalar_one_or_none()
            if latest_date:
                sub_rev_stmt = select(func.coalesce(func.sum(Sales.amount), 0)).where(
                    Sales.sale_date == latest_date,
                    Sales.is_return == False
                )
                today_rev = int((await db.execute(sub_rev_stmt)).scalar_one())

        # 2. 재고 요약 정보
        inv_summary = await InventoryService.get_inventory_summary(db, warehouse_id)

        # 3. 발주 추천 목록 조회
        recs = await ReplenishmentService.get_or_generate_recommendations(db, warehouse_id)
        rec_count = len(recs)
        rec_amount = sum(r.order_amount for r in recs)
        urgent_rec_count = sum(1 for r in recs if r.urgent)

        # 4. 진행 중 발주 건수
        po_stmt = select(func.count()).select_from(PurchaseOrder).where(
            PurchaseOrder.status.in_(["draft", "ordered", "partial"])
        )
        pending_count = int((await db.execute(po_stmt)).scalar_one())

        # 5. 브리핑 문구 및 To-Do 생성
        briefing_parts = []
        if rec_count > 0:
            briefing_parts.append(f"오늘 발주 권장 상품이 {rec_count}건(약 {rec_amount:,.0f}원) 있습니다.")
        if inv_summary.expiring_soon_count > 0:
            briefing_parts.append(f"소비기한 3일 이내 임박 상품이 {inv_summary.expiring_soon_count}건 감지되었습니다.")
        if inv_summary.out_of_stock_count > 0:
            briefing_parts.append(f"품절 품목이 {inv_summary.out_of_stock_count}건 발생했습니다.")
        if not briefing_parts:
            briefing_parts.append("모든 상품 재고와 발주 상태가 적정 범위 내에 있습니다.")

        briefing = " ".join(briefing_parts)

        todos: list[DashboardTodo] = []
        if rec_count > 0:
            todos.append(DashboardTodo(label=f"AI 발주 추천 {rec_count}건 검토 및 승인", target="purchases"))
        if inv_summary.expiring_soon_count > 0:
            todos.append(DashboardTodo(label=f"소비기한 임박 {inv_summary.expiring_soon_count}건 할인 행사 등록", target="inventory"))
        if inv_summary.low_stock_count > 0:
            todos.append(DashboardTodo(label=f"안전재고 미달 {inv_summary.low_stock_count}건 재고 확인", target="inventory"))

        return DashboardSummaryResponse(
            store_name="아산 스마트마트 본점",
            date=today.strftime("%Y년 %m월 %d일"),
            revenue=today_rev,
            change_percent=8.4,
            stockout_count=inv_summary.out_of_stock_count,
            expiring_count=inv_summary.expiring_soon_count,
            pending_order_count=pending_count,
            recommend_count=rec_count,
            recommend_amount=rec_amount,
            urgent_recommend_count=urgent_rec_count,
            briefing=briefing,
            todos=todos
        )
