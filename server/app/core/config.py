from __future__ import annotations

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


class Settings(BaseSettings):
    APP_NAME: str = "MIC ACE API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    APP_PORT: int = 9030
    API_PREFIX: str = "/api"

    DATABASE_URL: str = "sqlite:///./micace.db"
    SQLALCHEMY_ECHO: bool = False

    JWT_ALGORITHM: str = "HS256"
    JWT_SECRET_KEY: str = "change-me-access-secret"
    JWT_REFRESH_SECRET_KEY: str = "change-me-refresh-secret"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    CORS_ORIGINS: str = "http://localhost:3030,http://127.0.0.1:3030"

    # --- Third-party API keys (comma-separated for key rotation) ---
    SERPAPI_KEYS: str = ""
    TAVILY_KEYS: str = ""

    # --- Redis ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- SimilarWeb traffic scan ---
    SIMILARWEB_EMAIL: str = ""
    SIMILARWEB_PASSWORD: str = ""
    SELENIUM_HUB_URL: str = ""          # e.g. http://localhost:4444/wd/hub
    NOVNC_URL: str = "http://localhost:7900"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def serpapi_keys(self) -> list[str]:
        return [k.strip() for k in self.SERPAPI_KEYS.split(",") if k.strip()]

    @property
    def tavily_keys(self) -> list[str]:
        return [k.strip() for k in self.TAVILY_KEYS.split(",") if k.strip()]


settings = Settings()
