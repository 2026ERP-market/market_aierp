from datetime import datetime, date
from sqlalchemy import String, Integer, BigInteger, Numeric, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    po_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    supplier_id: Mapped[str] = mapped_column(String(30), ForeignKey("suppliers.supplier_id"), nullable=False)
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_date: Mapped[date] = mapped_column(Date, nullable=False)
    received_date: Mapped[date | None] = mapped_column(Date)
    total_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    lines: Mapped[list["PurchaseOrderLine"]] = relationship("PurchaseOrderLine", back_populates="order", cascade="all, delete-orphan")

class PurchaseOrderLine(Base):
    __tablename__ = "purchase_order_lines"

    po_id: Mapped[str] = mapped_column(String(50), ForeignKey("purchase_orders.po_id", ondelete="CASCADE"), primary_key=True)
    line_no: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[str] = mapped_column(String(30), ForeignKey("items.item_id"), nullable=False)
    order_qty: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    received_qty: Mapped[float] = mapped_column(Numeric(12, 3), default=0.000)
    unit_cost: Mapped[int] = mapped_column(BigInteger, nullable=False)

    order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="lines")

class OrderRecommendation(Base):
    __tablename__ = "order_recommendations"

    rec_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    recommend_date: Mapped[date] = mapped_column(Date, nullable=False)
    item_id: Mapped[str] = mapped_column(String(30), ForeignKey("items.item_id"), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(30), ForeignKey("warehouses.warehouse_id"), nullable=False)
    supplier_id: Mapped[str] = mapped_column(String(30), ForeignKey("suppliers.supplier_id"), nullable=False)
    current_stock: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    forecast_demand: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    safety_stock: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    recommended_qty: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
