from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class AutomationPolicyDTO(BaseModel):
    daily_budget_limit: int | None = 5000000
    allowed_categories: list[str] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)

class AutomationSettingsResponse(BaseModel):
    warehouse_id: str
    enabled: bool
    version: int
    updated_at: datetime | None = None
    can_manage: bool = True
    policy: AutomationPolicyDTO
    worker_status: Literal["idle", "running", "paused", "error"] = "idle"
    model_config = ConfigDict(from_attributes=True)

class AutomationSettingsUpdateRequest(BaseModel):
    warehouse_id: str
    enabled: bool
    expected_version: int
    agreed_by: str | None = "STORE_OWNER"
    policy_version: str | None = "v1"

class AutomationRunDTO(BaseModel):
    run_id: str
    recommendation_id: str | None = None
    item_id: str
    item_name: str
    product_id: str
    product_name: str
    status: Literal["created", "skipped", "failed", "dispatched", "ordered"]
    order_id: str | None = None
    original_qty: float
    final_qty: float
    reason: str | None = None
    policy_version: str = "v1"
    executed_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AutomationRunsPageResponse(BaseModel):
    runs: list[AutomationRunDTO]
    next_cursor: str | None = None
