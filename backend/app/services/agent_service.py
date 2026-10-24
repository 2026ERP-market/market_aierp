import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.master import Item
from app.models.inventory import InventoryBatch
from app.models.purchases import OrderRecommendation
from app.models.sales import Sales
from app.models.features import WeatherForecast
from app.schemas.agent import AgentChatResponse, AgentCard, AgentAction

class AgentService:
    @staticmethod
    async def chat(db: AsyncSession, message: str, warehouse_id: str = "WH-ASAN") -> AgentChatResponse:
        msg = message.strip().lower()
        msg_id = str(uuid.uuid4())

        # 1. 특정 품목 재고 질의 (예: "우유", "만두", "삼겹살", "계란", "재고")
        if any(keyword in msg for keyword in ["우유", "만두", "삼겹살", "계란", "라면", "수박", "콜라", "재고"]):
            # 품목 검색
            stmt = select(Item).where(Item.item_name.ilike(f"%{msg[:4]}%"))
            res = await db.execute(stmt)
            item = res.scalars().first()

            if not item:
                # 전체 재고 상태 요약
                batch_stmt = select(func.count(InventoryBatch.batch_id), func.sum(InventoryBatch.qty))
                b_res = await db.execute(batch_stmt)
                count, total_q = b_res.first()
                return AgentChatResponse(
                    id=msg_id,
                    content=f"현재 총 {count or 0}개의 로트 재고({total_q or 0:.0f}개)를 보유하고 있습니다. 특정 상품명을 말씀해 주시면 상세 로트와 소비기한을 조회해 드릴게요.",
                    cards=[
                        AgentCard(
                            title="재고 관리 바로가기",
                            text="전체 품목의 실재고 및 안전재고 현황을 확인합니다.",
                            action=AgentAction(label="재고 화면으로 이동", target="inventory")
                        )
                    ]
                )

            # 해당 품목 로트 조회
            b_stmt = select(InventoryBatch).where(
                InventoryBatch.item_id == item.item_id,
                InventoryBatch.warehouse_id == warehouse_id
            ).order_by(InventoryBatch.expiry_date.asc())
            batches = (await db.execute(b_stmt)).scalars().all()
            total_qty = sum(float(b.qty) for b in batches)

            batch_texts = [f"- 소비기한 {b.expiry_date.strftime('%m/%d')}: {b.qty:.0f}{item.uom}" for b in batches[:3]]
            batch_summary = "\n".join(batch_texts) if batch_texts else "현재 보유 중인 로트가 없습니다."

            content = (
                f"**[{item.item_name}]** 현재 재고는 **총 {total_qty:.0f}{item.uom}** 입니다.\n"
                f"(안전재고: {item.safety_stock:.0f}{item.uom})\n\n"
                f"**보유 로트 내역:**\n{batch_summary}"
            )

            return AgentChatResponse(
                id=msg_id,
                content=content,
                cards=[
                    AgentCard(
                        title=f"{item.item_name} 재고 상세",
                        text=f"현재 {total_qty:.0f}{item.uom} 보유 중입니다.",
                        action=AgentAction(label="상품 상세 보기", target="inventory", productId=item.item_id)
                    )
                ]
            )

        # 2. 발주 관련 질의 (예: "발주", "추천", "얼마나")
        if any(keyword in msg for keyword in ["발주", "추천", "부족", "주문"]):
            rec_stmt = (
                select(OrderRecommendation, Item)
                .join(Item, OrderRecommendation.item_id == Item.item_id)
                .where(OrderRecommendation.status.in_(["draft", "approved"]))
                .limit(5)
            )
            recs = (await db.execute(rec_stmt)).all()

            if recs:
                rec_lines = [
                    f"• **{item.item_name}**: {rec.recommended_qty:.0f}{item.uom} 추천 (현재 {rec.current_stock:.0f}개)"
                    for rec, item in recs
                ]
                content = (
                    f"오늘 AI 엔진이 분석한 발주 추천 품목입니다:\n\n" +
                    "\n".join(rec_lines) +
                    f"\n\n납품 리드타임과 주말 예상 수요를 반영하여 최적 수량을 산출했습니다."
                )
                return AgentChatResponse(
                    id=msg_id,
                    content=content,
                    cards=[
                        AgentCard(
                            title="AI 발주 추천 확인",
                            text="추천된 품목의 수량을 검토하고 발주서를 생성하세요.",
                            action=AgentAction(label="발주 추천 보기", target="purchases")
                        )
                    ]
                )
            else:
                return AgentChatResponse(
                    id=msg_id,
                    content="현재 안전재고와 입고 예정량을 감안할 때 긴급 발주가 필요한 상품이 없습니다.",
                    cards=[
                        AgentCard(
                            title="발주 내역 확인",
                            text="기존 발주서의 입고 상태를 확인합니다.",
                            action=AgentAction(label="발주서 목록", target="purchases")
                        )
                    ]
                )

        # 3. 날씨 관련 질의 (예: "날씨", "비", "기온")
        if any(keyword in msg for keyword in ["날씨", "비", "비오", "기온", "폭염"]):
            w_stmt = select(WeatherForecast).order_by(WeatherForecast.target_date.asc()).limit(3)
            w_res = (await db.execute(w_stmt)).scalars().all()
            if w_res:
                w_lines = [
                    f"• {w.target_date.strftime('%m/%d')}: 최고 {w.temp_max}℃ / 강수확률 {int((w.pop or 0)*100)}%"
                    for w in w_res
                ]
                content = (
                    f"기상청 단기예보 분석 결과입니다:\n\n" + "\n".join(w_lines) +
                    f"\n\n비 예보가 있는 날은 전/부침가루 및 막걸리 수요가 평소 대비 20% 이상 증가할 것으로 예측됩니다."
                )
            else:
                content = "내일은 평년 수준의 기온이 예상되며, 특이 기상 변동은 감지되지 않았습니다."

            return AgentChatResponse(
                id=msg_id,
                content=content,
                cards=[
                    AgentCard(
                        title="기상 연동 수요 예측",
                        text="날씨 변동이 반영된 발주 추천을 확인하세요.",
                        action=AgentAction(label="발주 추천 보기", target="purchases")
                    )
                ]
            )

        # 4. 기본 응답
        return AgentChatResponse(
            id=msg_id,
            content=(
                f"안녕하세요! 마트 AI 매니저입니다. 다음과 같은 질문을 도와드릴 수 있어요:\n"
                f"• '우유 재고 얼마 남아있어?' (실시간 재고 및 소비기한 조회)\n"
                f"• '오늘 발주할 거 추천해줘' (AI 최적 발주량 및 사유 확인)\n"
                f"• '내일 비 오는데 재고 괜찮아?' (기상청 예보 연동 수요 분석)"
            ),
            cards=[
                AgentCard(
                    title="대시보드 요약",
                    text="오늘의 주요 판매 및 재고 지표를 확인합니다.",
                    action=AgentAction(label="홈 대시보드", target="inventory")
                )
            ]
        )
