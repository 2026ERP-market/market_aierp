from datetime import datetime, date
from sqlalchemy import String, Numeric, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class InventoryDaily(Base):
    __tablename__ = "inventory_daily"

    snapshot_date: Mapped[date] = mapped_column(Date, primary_key=True)
    item_id: Mapped[str] = mapped_column(String(30), ForeignKey("items.item_id"), primary_key=True)
    warehouse_id: Mapped[str] = mapped_column(String(30), ForeignKey("warehouses.warehouse_id"), primary_key=True)
    on_hand_qty: Mapped[float] = mapped_column(Numeric(12, 3), default=0.000)
    available_qty: Mapped[float] = mapped_column(Numeric(12, 3), default=0.000)
    stockout_flag: Mapped[bool] = mapped_column(Boolean, default=False)

class InventoryBatch(Base):
    __tablename__ = "inventory_batches"

    batch_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    item_id: Mapped[str] = mapped_column(String(30), ForeignKey("items.item_id"), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(30), ForeignKey("warehouses.warehouse_id"), nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    qty: Mapped[float] = mapped_column(Numeric(12, 3), default=0.000)
    received_date: Mapped[date] = mapped_column(Date, default=date.today)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    item: Mapped["Item"] = relationship("Item", back_populates="batches")
