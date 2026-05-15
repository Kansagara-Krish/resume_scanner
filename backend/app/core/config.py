from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
import os

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "AI HR Copilot"
    API_V1_STR: str = "/api/v1"
    
    # OpenRouter API
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "meta-llama/llama-3.1-8b-instruct"
    OPENROUTER_API_URL: str = "https://openrouter.ai/api/v1/chat/completions"
    OPENROUTER_TIMEOUT: float = 30.0
    
    # Database
    DATABASE_URL: str
    
    # Optional settings with defaults
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # Path settings
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    
    model_config = SettingsConfigDict(
        env_file=os.path.join(Path(__file__).resolve().parent.parent.parent, ".env"),
        env_file_encoding='utf-8',
        extra='ignore'
    )

settings = Settings()
