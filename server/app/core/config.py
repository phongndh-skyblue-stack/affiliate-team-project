from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVER_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = SERVER_DIR / ".env"

load_dotenv(ENV_FILE, override=True)


class Settings(BaseSettings):
    APP_NAME: str = "MIC ACE API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    APP_PORT: int = 4050
    API_PREFIX: str = "/api"
    PAGE_SIZE: int = 10

    DATABASE_URL: str = "sqlite:///./micace.db"
    SQLALCHEMY_ECHO: bool = False

    JWT_ALGORITHM: str = "HS256"
    JWT_SECRET_KEY: str = "change-me-access-secret"
    JWT_REFRESH_SECRET_KEY: str = "change-me-refresh-secret"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    CORS_ORIGINS: str = "http://localhost:4000,http://127.0.0.1:4000"

    # --- Third-party API keys (comma-separated for key rotation) ---
    SERPAPI_KEYS: str = ""
    TAVILY_KEYS: str = ""
    MINIMAX_API_KEY: str = ""

    # --- Redis ---
    REDIS_URL: str = "redis://127.0.0.1:6379/0"
    REDIS_HOST: str = "127.0.0.1"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    ARQ_REDIS_URL: str = ""
    ARQ_QUEUE_NAME: str = "arq:queue"

    # --- SimilarWeb traffic scan ---
    SIMILARWEB_EMAIL: str = ""
    SIMILARWEB_PASSWORD: str = ""
    SELENIUM_HUB_URL: str = ""          # e.g. http://localhost:4444/wd/hub
    NOVNC_URL: str = "http://localhost:7900"
    SIMILARWEB_COOKIE_CACHE_TTL_SECONDS: int = 6 * 60 * 60
    SIMILARWEB_COOKIE_REFRESH_LOCK_TTL_SECONDS: int = 10 * 60

    # --- Proxy encryption (Fernet symmetric key, base64url-encoded 32 bytes) ---
    # Generate once: from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())
    PROXY_ENCRYPTION_KEY: str = ""
    PROXY_ENCRYPTION_KEY_FALLBACKS: str = ""

    # --- Google Ads (Keyword Planner) ---
    GOOGLE_ADS_DEVELOPER_TOKEN: str = ""  # Google Ads API developer token

    # --- Google OAuth (Mail Delegation + Google Ads client) ---
    GOOGLE_CLIENT_ID: str = ""               # OAuth 2.0 Web client ID for delegation flow
    GOOGLE_CLIENT_SECRET: str = ""           # OAuth client secret
    GOOGLE_OAUTH_REDIRECT_URI: str = "http://localhost:4000/oauth/callback"  # Frontend receives ?code=&state=
    GOOGLE_OAUTH_STATE_EXPIRATION_MINUTES: int = 60  # Link expiry in minutes

    # --- Gmail Sender (Mail Delegation emails) ---
    SEND_MAIL_CLIENT_ID: str = ""            # OAuth client ID for sender mailbox
    SEND_MAIL_CLIENT_SECRET: str = ""        # OAuth client secret for sender mailbox
    SEND_MAIL_REFRESH_TOKEN: str = ""        # Refresh token of the sending Gmail account
    SEND_MAIL_FROM: str = ""                 # Display from-address (e.g. noreply@company.com)

    # --- Telegram Bot ---
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_BOT_USERNAME: str = ""
    TELEGRAM_VERIFICATION_TTL_SECONDS: int = 600




    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
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

    @property
    def proxy_encryption_key_fallbacks(self) -> list[str]:
        return [k.strip() for k in self.PROXY_ENCRYPTION_KEY_FALLBACKS.split(",") if k.strip()]

    @property
    def arq_redis_dsn(self) -> str:
        return self.ARQ_REDIS_URL or self.REDIS_URL


settings = Settings()
