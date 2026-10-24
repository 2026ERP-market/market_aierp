from datetime import datetime, date
from sqlalchemy import String, Integer, BigInteger, Numeric, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class Sales(Base):
    __tablename__ = "sales"

    sale_date: Mapped[date] = mapped_column(Date, primary_key=True)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(String(50), nullable=False)
    item_id: Mapped[str] = mapped_column(String(30), ForeignKey("items.item_id"), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(30), ForeignKey("warehouses.warehouse_id"), nullable=False)
    customer_id: Mapped[str | None] = mapped_column(String(30), ForeignKey("customers.customer_id"))
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    qty: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    unit_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    is_return: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class OpenOrder(Base):
    __tablename__ = "open_orders"

    order_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    line_no: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    customer_id: Mapped[str] = mapped_column(String(30), ForeignKey("customers.customer_id"), nullable=False)
    item_id: Mapped[str] = mapped_column(String(30), ForeignKey("items.item_id"), nullable=False)
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    requested_delivery_date: Mapped[date] = mapped_column(Date, nullable=False)
    qty: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="confirmed")
