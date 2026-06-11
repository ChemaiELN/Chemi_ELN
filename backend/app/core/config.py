from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Chemia ELN"
    APP_ENV: str = "development"

    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # File uploads — absolute path or relative to the working directory (backend/)
    UPLOAD_DIR: str = "uploads"
    # Max upload size in bytes (default 50 MB)
    MAX_UPLOAD_BYTES: int = 50 * 1024 * 1024

    # CORS — comma-separated string in .env
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3002"

    @property
    def origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
