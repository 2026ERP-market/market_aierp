import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Mart AI ERP Backend"
    API_V1_STR: str = "/api/v1"
    
    # PostgreSQL Database URL
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "erp_user")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "erp_password123!")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "market_erp")
    
    TIMEZONE: str = "Asia/Seoul"

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def SYNC_DATABASE_URL(self) -> str:
        return f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # 외부 API 키 (선택 사항)
    OPENAI_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    KMA_API_KEY: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
