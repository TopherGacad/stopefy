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


settings = Settings()
