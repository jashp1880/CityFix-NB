from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    environment: str = 'production'
    database_url: str = 'sqlite:///./cityfix.db'
    jwt_secret: str = ''
    frontend_origins: str = 'http://localhost:5173'
    supabase_url: str = ''
    supabase_secret_key: str = ''
    supabase_service_role_key: str = ''
    storage_endpoint: str = ''
    storage_region: str = 'auto'
    storage_bucket: str = ''
    storage_access_key: str = ''
    storage_secret_key: str = ''
    gemini_api_key: str = ''
    gemini_model: str = 'gemini-3.5-flash-lite'
    max_upload_bytes: int = 5 * 1024 * 1024

    @property
    def supabase_key(self):
        return self.supabase_secret_key or self.supabase_service_role_key

    @property
    def origins(self):
        return [v.strip().rstrip('/') for v in self.frontend_origins.split(',') if v.strip()]


@lru_cache
def settings():
    return Settings()

