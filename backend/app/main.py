from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine
from app.api.v1.router import api_router
from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시 DB 연결 핑 확인
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print(" Connected to PostgreSQL successfully.")
    except Exception as e:
        print(f" Database connection failed: {e}")
    yield
    # 종료 시 리소스 정리
    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="ERP 기반 AI 수요 예측 및 자동 발주 시스템 백엔드 API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS 설정 (웹 Vite 개발서버 5173 및 Expo 모바일 8081/웹 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# v1 라우터 등록
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["Health"])
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR
    }

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}
