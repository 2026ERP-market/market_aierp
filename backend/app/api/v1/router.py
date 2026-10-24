from fastapi import APIRouter
from app.api.v1.endpoints import (
    dashboard, items, inventory, sales, forecasts, purchases, external, agent
)

api_router = APIRouter()

api_router.include_router(dashboard.router)
api_router.include_router(items.router)
api_router.include_router(inventory.router)
api_router.include_router(sales.router)
api_router.include_router(forecasts.router)
api_router.include_router(purchases.router)
api_router.include_router(external.router)
api_router.include_router(agent.router)
