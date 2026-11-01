"""Runtime configuration, read from environment variables (see .env.example)."""
from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    environment: Literal["development", "test", "production"] = "development"
    ai_service_token: str = ""

    # Persistence for the retrieval index. Empty MONGO_URI -> in-memory (lost on restart).
    mongo_uri: str = ""
    mongo_db: str = "adaptlearn"

    # Generation provider. "offline" needs no key and is fully deterministic.
    llm_provider: Literal["offline", "openai", "azure"] = "offline"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    azure_openai_endpoint: str = ""
    azure_openai_deployment: str = ""
    azure_openai_api_version: str = "2024-06-01"
    llm_timeout_seconds: float = Field(default=20.0, gt=0)

    # Retrieval behaviour.
    top_k: int = Field(default=4, ge=1, le=10)
    min_retrieval_score: float = Field(default=0.12, ge=0, le=1)

    @model_validator(mode="after")
    def _require_secrets_outside_dev(self) -> "Settings":
        if self.environment == "production":
            if len(self.ai_service_token) < 24:
                raise ValueError("AI_SERVICE_TOKEN must be set (24+ chars) in production")
        if self.llm_provider == "openai" and not self.llm_api_key:
            raise ValueError("LLM_PROVIDER=openai requires LLM_API_KEY")
        if self.llm_provider == "azure" and not (
            self.llm_api_key and self.azure_openai_endpoint and self.azure_openai_deployment
        ):
            raise ValueError("LLM_PROVIDER=azure requires LLM_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
