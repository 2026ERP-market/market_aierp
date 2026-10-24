from datetime import date, datetime, time
from pydantic import BaseModel, ConfigDict

class ItemBase(BaseModel):
    item_id: str
    item_name: str
    category_l: str
    category_m: str | None = None
    category_s: str | None = None
    uom: str = "EA"
    pack_size: float = 1.000
    cost_price: int = 0
    sale_price: int = 0
    shelf_life_days: int | None = None
    launch_date: date | None = None
    discontinue_date: date | None = None
    substitute_group: str | None = None
    safety_stock: float = 0.000

class ItemCreate(ItemBase):
    pass

class ItemResponse(ItemBase):
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ItemUpdate(BaseModel):
    """품목 수정 (보낸 필드만 반영)"""
    item_name: str | None = None
    category_l: str | None = None
    uom: str | None = None
    sale_price: int | None = None
    cost_price: int | None = None
    safety_stock: float | None = None

class SupplierBase(BaseModel):
    supplier_id: str
    supplier_name: str
    lead_time_days: int = 1
    cutoff_time: time | None = None
    min_order_amount: int = 0
    phone: str | None = None
    is_active: bool = True

class SupplierCreate(SupplierBase):
    pass

class SupplierResponse(SupplierBase):
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class WarehouseResponse(BaseModel):
    warehouse_id: str
    warehouse_name: str
    region_code: str
    address: str | None = None
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)

class CustomerResponse(BaseModel):
    customer_id: str
    customer_name: str
    customer_type: str
    region_code: str | None = None
    segment: str | None = None
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)
