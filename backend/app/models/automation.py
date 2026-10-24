from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, Boolean, Numeric, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class StoreAutomationSetting(Base):
    __tablename__ = "store_automation_settings"

    warehouse_id: Mapped[str] = mapped_column(String(30), ForeignKey("warehouses.warehouse_id"), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    can_manage: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    daily_budget_limit: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    allowed_categories: Mapped[str | None] = mapped_column(Text, nullable=True)
    agreed_by: Mapped[str | None] = mapped_column(String(50), nullable=True)
    agreed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    policy_version: Mapped[str] = mapped_column(String(20), default="v1", nullable=False)
    worker_status: Mapped[str] = mapped_column(String(20), default="idle", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class AutomationRunLog(Base):
    __tablename__ = "automation_run_logs"

    run_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    warehouse_id: Mapped[str] = mapped_column(String(30), ForeignKey("warehouses.warehouse_id"), nullable=False)
    recommendation_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    item_id: Mapped[str] = mapped_column(String(30), ForeignKey("items.item_id"), nullable=False)
    item_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False) # 'created' | 'skipped' | 'failed'
    original_qty: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    final_qty: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    policy_version: Mapped[str] = mapped_column(String(20), default="v1", nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
