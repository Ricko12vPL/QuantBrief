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
