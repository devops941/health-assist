"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings(BaseSettings):
    database_url: str = Field(default="", alias="DATABASE_URL")

    jwt_secret: str = Field(default="dev-secret-change-me", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=1440, alias="ACCESS_TOKEN_EXPIRE_MINUTES")

    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    groq_model: str = Field(default="openai/gpt-oss-120b", alias="GROQ_MODEL")
    groq_fallback_models: str = Field(
        default="qwen/qwen3.8-27b,openai/gpt-oss-20b,allam-2-7b",
        alias="GROQ_FALLBACK_MODELS",
    )

    frontend_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000", alias="FRONTEND_ORIGINS"
    )
    backend_host: str = Field(default="0.0.0.0", alias="BACKEND_HOST")
    backend_port: int = Field(default=8000, alias="BACKEND_PORT")

    admin_email: str = Field(default="admin@healthassistant.ai", alias="ADMIN_EMAIL")
    admin_password: str = Field(default="Admin@12345", alias="ADMIN_PASSWORD")

    model_config = {"env_file": str(BASE_DIR / ".env"), "extra": "ignore", "populate_by_name": True}

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]

    @property
    def fallback_models(self) -> list[str]:
        return [m.strip() for m in self.groq_fallback_models.split(",") if m.strip()]

    @property
    def model_chain(self) -> list[str]:
        """Primary model first, then fallbacks, de-duplicated."""
        chain = [self.groq_model, *self.fallback_models]
        seen: list[str] = []
        for m in chain:
            if m and m not in seen:
                seen.append(m)
        return seen


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
