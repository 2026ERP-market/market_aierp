from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

OrderStatus = Literal["draft", "ordered", "partial", "received", "cancelled"]

class RecommendationResponse(BaseModel):
    rec_id: str
    recommend_date: date
    item_id: str
    item_name: str
    category: str
    warehouse_id: str
    supplier_id: str
    supplier_name: str
    current_stock: float
    forecast_demand: float
    safety_stock: float
    recommended_qty: float
    order_amount: int
    pack_size: float
    lead_time_days: int
    urgent: bool
    status: str
    reason: str | None = None
    model_config = ConfigDict(from_attributes=True)

class RecommendationActionRequest(BaseModel):
    action: Literal["approve", "reject", "modify"]
    modified_qty: float | None = None

class DirectOrderRequest(BaseModel):
    recommendation_id: str
    item_id: str
    ai_recommended_qty: float | int
    final_qty: int = Field(gt=0)
    idempotency_key: str | None = None

class PurchaseOrderLineDTO(BaseModel):
    line_no: int
    item_id: str
    item_name: str
    order_qty: float
    received_qty: float
    unit_cost: int
    amount: int
    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderCreateRequest(BaseModel):
    supplier_id: str
    warehouse_id: str = "WH-ASAN"
    expected_days: int | None = None
    items: list[dict]  # [{"item_id": "ITM-00123", "order_qty": 24, "unit_cost": 3000}]

class PurchaseOrderResponse(BaseModel):
    po_id: str
    supplier_id: str
    supplier_name: str
    order_date: date
    expected_date: date
    received_date: date | None = None
    total_amount: int
    status: OrderStatus
    lines: list[PurchaseOrderLineDTO]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ReceiveOrderRequest(BaseModel):
    received_items: list[dict] # [{"line_no": 1, "received_qty": 24, "expiry_date": "2026-11-30"}]
