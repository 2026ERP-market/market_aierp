from pydantic import BaseModel

class DashboardTodo(BaseModel):
    label: str
    target: str  # inventory, purchases, agent

class DashboardSummaryResponse(BaseModel):
    store_name: str
    date: str
    revenue: int
    change_percent: float | None = None
    stockout_count: int
    expiring_count: int
    pending_order_count: int
    recommend_count: int
    recommend_amount: int
    urgent_recommend_count: int
    briefing: str
    todos: list[DashboardTodo]
