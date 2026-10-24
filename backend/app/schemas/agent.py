from typing import Literal
from pydantic import BaseModel

class AgentAction(BaseModel):
    label: str
    target: Literal["inventory", "purchases", "sales"]
    product_id: str | None = None

class AgentCard(BaseModel):
    title: str
    text: str
    action: AgentAction

class AgentChatRequest(BaseModel):
    message: str

class AgentChatResponse(BaseModel):
    id: str
    role: Literal["assistant"] = "assistant"
    content: str
    state: Literal["success", "data_insufficient", "not_found"] = "success"
    cards: list[AgentCard] = []
