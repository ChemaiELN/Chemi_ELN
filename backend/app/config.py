from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_BYTES: int = 52_428_800   # 50 MB
    MAX_BODY_BYTES: int = 10_485_760     # 10 MB

    model_config = {"env_file": ".env"}


settings = Settings()
