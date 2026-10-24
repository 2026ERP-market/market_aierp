from datetime import datetime, date, time
from sqlalchemy import String, Integer, BigInteger, Numeric, Boolean, Date, Time, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class Warehouse(Base):
    __tablename__ = "warehouses"

    warehouse_id: Mapped[str] = mapped_column(String(30), primary_key=True)
    warehouse_name: Mapped[str] = mapped_column(String(100), nullable=False)
    region_code: Mapped[str] = mapped_column(String(20), nullable=False)
    address: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class Customer(Base):
    __tablename__ = "customers"

    customer_id: Mapped[str] = mapped_column(String(30), primary_key=True)
    customer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    customer_type: Mapped[str] = mapped_column(String(30), nullable=False)
    region_code: Mapped[str | None] = mapped_column(String(20))
    segment: Mapped[str | None] = mapped_column(String(10))
    first_order_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class Supplier(Base):
    __tablename__ = "suppliers"

    supplier_id: Mapped[str] = mapped_column(String(30), primary_key=True)
    supplier_name: Mapped[str] = mapped_column(String(100), nullable=False)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=1)
    cutoff_time: Mapped[time | None] = mapped_column(Time)
    min_order_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    phone: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # 관계
    supply_terms: Mapped[list["SupplyTerm"]] = relationship("SupplyTerm", back_populates="supplier")

class Item(Base):
    __tablename__ = "items"

    item_id: Mapped[str] = mapped_column(String(30), primary_key=True)
    item_name: Mapped[str] = mapped_column(String(150), nullable=False)
    category_l: Mapped[str] = mapped_column(String(50), nullable=False)
    category_m: Mapped[str | None] = mapped_column(String(50))
    category_s: Mapped[str | None] = mapped_column(String(50))
    uom: Mapped[str] = mapped_column(String(20), default="EA")
    pack_size: Mapped[float] = mapped_column(Numeric(12, 3), default=1.000)
    cost_price: Mapped[int] = mapped_column(BigInteger, default=0)
    sale_price: Mapped[int] = mapped_column(BigInteger, default=0)
    shelf_life_days: Mapped[int | None] = mapped_column(Integer)
    launch_date: Mapped[date | None] = mapped_column(Date)
    discontinue_date: Mapped[date | None] = mapped_column(Date)
    substitute_group: Mapped[str | None] = mapped_column(String(50))
    safety_stock: Mapped[float] = mapped_column(Numeric(12, 3), default=0.000)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # 관계
    batches: Mapped[list["InventoryBatch"]] = relationship("InventoryBatch", back_populates="item")
    supply_terms: Mapped[list["SupplyTerm"]] = relationship("SupplyTerm", back_populates="item")

class SupplyTerm(Base):
    __tablename__ = "supply_terms"

    item_id: Mapped[str] = mapped_column(String(30), ForeignKey("items.item_id", ondelete="CASCADE"), primary_key=True)
    supplier_id: Mapped[str] = mapped_column(String(30), ForeignKey("suppliers.supplier_id", ondelete="CASCADE"), primary_key=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=1)
    moq: Mapped[float] = mapped_column(Numeric(12, 3), default=1.000)
    order_multiple: Mapped[float] = mapped_column(Numeric(12, 3), default=1.000)
    unit_cost: Mapped[int] = mapped_column(BigInteger, nullable=False)
    order_days: Mapped[str | None] = mapped_column(String(50), default="MON,TUE,WED,THU,FRI")

    item: Mapped["Item"] = relationship("Item", back_populates="supply_terms")
    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="supply_terms")
