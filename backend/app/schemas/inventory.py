from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict

StockStatus = Literal["normal", "low", "out", "expiring"]

class BatchDTO(BaseModel):
    batch_id: str
    item_id: str
    warehouse_id: str
    expiry_date: date
    qty: float
    days_left: int
    is_urgent: bool  # D-3 이내
    loss_amount: int # 손실 위험액 (qty * cost_price)
    model_config = ConfigDict(from_attributes=True)

class InventoryProductDTO(BaseModel):
    id: str
    name: str
    category: str
    unit: str
    price: int
    cost_price: int
    pack_size: float
    total_qty: float
    available_qty: float
    safety_stock: float
    status: StockStatus
    supplier_id: str | None = None
    supplier_name: str | None = None
    batches: list[BatchDTO] = []
    incoming_qty: float = 0.0

class InventorySummaryResponse(BaseModel):
    products: list[InventoryProductDTO]
    total_stock_value: int
    low_stock_count: int
    out_of_stock_count: int
    expiring_soon_count: int
    updated_at: str

class InventoryAdjustRequest(BaseModel):
    item_id: str
    warehouse_id: str
    batch_id: str | None = None
    adjusted_qty: float
    reason: str
