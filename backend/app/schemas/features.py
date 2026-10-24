from datetime import date
from pydantic import BaseModel, ConfigDict

class ForecastPoint(BaseModel):
    target_date: date
    yhat: float
    yhat_p10: float | None = None
    yhat_p90: float | None = None
    model_version: str
    model_config = ConfigDict(from_attributes=True)

class ItemForecastResponse(BaseModel):
    item_id: str
    item_name: str
    warehouse_id: str
    run_date: date
    forecasts: list[ForecastPoint]

class WeatherForecastResponse(BaseModel):
    target_date: date
    region_code: str
    temp_max: float | None = None
    temp_min: float | None = None
    pop: float | None = None
    pcp_mm: float | None = None
    source: str
    model_config = ConfigDict(from_attributes=True)

class PromotionResponse(BaseModel):
    promo_id: str
    item_id: str
    start_date: date
    end_date: date
    promo_type: str
    regular_price: int
    promo_price: int
    discount_rate: float
    model_config = ConfigDict(from_attributes=True)
