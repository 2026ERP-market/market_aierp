from datetime import date
from pydantic import BaseModel, ConfigDict

class SalesCreate(BaseModel):
    sale_date: date
    order_id: str
    item_id: str
    warehouse_id: str
    customer_id: str | None = None
    channel: str = "offline"  # offline, online, b2b
    qty: float
    unit_price: int
    amount: int | None = None
    is_return: bool = False

class SalesTrendPoint(BaseModel):
    date: str
    revenue: int
    kind: str = "actual"  # actual or forecast

class CategoryShare(BaseModel):
    name: str
    revenue: int

class ProductRankingItem(BaseModel):
    product_id: str
    name: str
    category: str
    quantity: float
    revenue: int

class SalesSummaryResponse(BaseModel):
    start_date: str
    end_date: str
    total_revenue: int
    total_qty: float
    order_count: int
    trend: list[SalesTrendPoint]
    categories: list[CategoryShare]
    ranking: list[ProductRankingItem]
