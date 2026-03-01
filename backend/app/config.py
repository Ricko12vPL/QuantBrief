from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Mistral AI
    mistral_api_key: str = ""

    # ElevenLabs
    elevenlabs_api_key: str = ""

    # Data Sources
    alpha_vantage_api_key: str = ""
    finnhub_api_key: str = ""
    fred_api_key: str = ""

    # SEC EDGAR
    sec_user_agent: str = "QuantBrief kacper@quantbrief.ai"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # W&B
    wandb_api_key: str = ""
    wandb_project: str = "quantbrief"

    # Database
    database_url: str = "postgresql+asyncpg://quantbrief:quantbrief@localhost:5432/quantbrief"

    # JWT
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 7

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Database pool
    db_pool_size: int = 5

    # App
    app_name: str = "QuantBrief"
    debug: bool = False
    audio_dir: str = "static/audio"

    # Models
    model_screening: str = "ministral-3b-latest"
    model_analysis: str = "mistral-large-latest"
    model_reasoning: str = "magistral-medium-latest"
    model_synthesis: str = "mistral-large-latest"
    model_transcription: str = "mistral-small-latest"  # Override to voxtral in .env

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
