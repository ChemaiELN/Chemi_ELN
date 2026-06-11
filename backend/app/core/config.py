from typing import List

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Known insecure placeholder values shipped with the repo.
_INSECURE_KEYS = {
    "chemia-eln-secret-key-change-in-production",
    "secret",
    "changeme",
    "your-secret-key",
}


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

    @model_validator(mode="after")
    def _validate_secret_key(self) -> "Settings":
        key = self.SECRET_KEY
        if self.APP_ENV not in ("test", "testing"):
            if key in _INSECURE_KEYS:
                raise ValueError(
                    "SECRET_KEY is set to a known insecure placeholder. "
                    "Generate a strong key with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            if len(key.encode()) < 32:
                raise ValueError(
                    f"SECRET_KEY is only {len(key.encode())} bytes — minimum 32 bytes required. "
                    "Generate with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
        return self

    # File uploads — absolute path or relative to the working directory (backend/)
    UPLOAD_DIR: str = "uploads"
    # Max upload size in bytes (default 50 MB)
    MAX_UPLOAD_BYTES: int = 50 * 1024 * 1024
    # Max JSON request body size in bytes (default 10 MB — guards non-file endpoints)
    MAX_BODY_BYTES: int = 10 * 1024 * 1024

    # CORS — comma-separated string in .env
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3002"

    @property
    def origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
