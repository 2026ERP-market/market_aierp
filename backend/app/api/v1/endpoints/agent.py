from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.agent import AgentChatRequest, AgentChatResponse
from app.services.agent_service import AgentService

router = APIRouter(prefix="/agent", tags=["AI Agent"])

@router.post("/chat", response_model=AgentChatResponse)
async def chat_with_agent(
    req: AgentChatRequest,
    warehouse_id: str = "WH-ASAN",
    db: AsyncSession = Depends(get_db)
):
    """모바일 AI 대화형 에이전트 챗봇 질의응답 (재고, 발주, 날씨 RAG 질의)"""
    return await AgentService.chat(db, req.message, warehouse_id)
