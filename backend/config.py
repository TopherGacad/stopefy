import os
from pathlib import Path

# Load .env file if it exists
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


class Settings:
    SECRET_KEY: str = "stopefy-super-secret-key-change-in-production-9f8a7b6c5d4e3f2a1b0c"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    DATABASE_URL: str = "sqlite:///./stopefy.db"
    UPLOAD_DIR: str = "uploads"
    # Audio quality: 128 = good balance of size/quality (~3MB per song)
    # 192 = higher quality (~5MB), 96 = smaller (~2MB)
    AUDIO_BITRATE: str = "128"
    # Gmail SMTP — use an App Password from Google Security settings
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = os.environ.get("SMTP_USER", "")
    SMTP_APP_PASSWORD: str = os.environ.get("SMTP_APP_PASSWORD", "")
    OTP_EXPIRE_MINUTES: int = 10


settings = Settings()
