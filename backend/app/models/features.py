from datetime import datetime, date
from sqlalchemy import String, Integer, BigInteger, Numeric, Boolean, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class Promotion(Base):
    __tablename__ = "promotions"

    promo_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    item_id: Mapped[str] = mapped_column(String(30), ForeignKey("items.item_id"), nullable=False)
    warehouse_id: Mapped[str | None] = mapped_column(String(30), ForeignKey("warehouses.warehouse_id"))
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    promo_type: Mapped[str] = mapped_column(String(30), nullable=False)
    regular_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    promo_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    discount_rate: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)

class Calendar(Base):
    __tablename__ = "calendar"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    week_of_year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    is_holiday: Mapped[bool] = mapped_column(Boolean, default=False)
    holiday_name: Mapped[str | None] = mapped_column(String(50))
    days_to_seollal: Mapped[int | None] = mapped_column(Integer)
    days_to_chuseok: Mapped[int | None] = mapped_column(Integer)
    is_payday: Mapped[bool] = mapped_column(Boolean, default=False)
    season: Mapped[str] = mapped_column(String(20), nullable=False)

class Weather(Base):
    __tablename__ = "weather"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    region_code: Mapped[str] = mapped_column(String(20), primary_key=True)
    temp_avg: Mapped[float | None] = mapped_column(Numeric(4, 1))
    temp_min: Mapped[float | None] = mapped_column(Numeric(4, 1))
    temp_max: Mapped[float | None] = mapped_column(Numeric(4, 1))
    precipitation_mm: Mapped[float] = mapped_column(Numeric(6, 1), default=0.0)
    is_rain: Mapped[bool] = mapped_column(Boolean, default=False)

class WeatherForecast(Base):
    __tablename__ = "weather_forecast"

    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    target_date: Mapped[date] = mapped_column(Date, primary_key=True)
    region_code: Mapped[str] = mapped_column(String(20), primary_key=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    temp_max: Mapped[float | None] = mapped_column(Numeric(4, 1))
    temp_min: Mapped[float | None] = mapped_column(Numeric(4, 1))
    pop: Mapped[float | None] = mapped_column(Numeric(5, 4))
    pcp_mm: Mapped[float | None] = mapped_column(Numeric(6, 1))

class Event(Base):
    __tablename__ = "events"

    event_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    item_id: Mapped[str | None] = mapped_column(String(30), ForeignKey("items.item_id"))
    warehouse_id: Mapped[str | None] = mapped_column(String(30), ForeignKey("warehouses.warehouse_id"))
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)

class MarketIndex(Base):
    __tablename__ = "market_index"

    month: Mapped[str] = mapped_column(String(7), primary_key=True)
    index_name: Mapped[str] = mapped_column(String(30), primary_key=True)
    value: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)

class Forecast(Base):
    __tablename__ = "forecast"

    forecast_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    run_date: Mapped[date] = mapped_column(Date, nullable=False)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    item_id: Mapped[str] = mapped_column(String(30), ForeignKey("items.item_id"), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(30), ForeignKey("warehouses.warehouse_id"), nullable=False)
    yhat: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    yhat_p10: Mapped[float | None] = mapped_column(Numeric(12, 3))
    yhat_p90: Mapped[float | None] = mapped_column(Numeric(12, 3))
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
