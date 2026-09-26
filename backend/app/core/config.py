from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "development"
    # Local default SQLite; production: Neon Postgres URL with ?sslmode=require
    # e.g. postgresql+psycopg2://user:pass@ep-xxx.neon.tech/purvadrishti?sslmode=require
    database_url: str = "sqlite:///./purvadrishti.db"
    jwt_secret: str = "change-me-demo-only"
    jwt_algorithm: str = "HS256"
    access_minutes: int = 60
    cors_origins: str = "*"
    # Alerts: dashboard + SSE primary. Firebase FCM optional later.
    firebase_credentials_json: str = ""
    firebase_enabled: bool = False
    # Multi-channel fan-out (PS deliverable d). Dashboard always on;
    # webhook/email/sms attempt only when configured, else logged.
    alert_channels: str = "dashboard,webhook"
    alert_webhook_url: str = ""
    alert_email_to: str = ""
    alert_from_email: str = "alerts@example.com"
    resend_api_key: str = ""
    sms_api_url: str = ""
    sms_api_key: str = ""
    # Auth: false = open demo mode; true = require Bearer JWT (RBAC).
    auth_enabled: bool = False
    # Demo feed: on startup, ensure a thin layer of recent (synthetic)
    # withdrawals exists so history features are alive for demos.
    # Production with live bank feeds sets this false.
    demo_autostage: bool = True
    model_path: str = "app/ml/models/cashout_xgb.json"
    redis_url: str = ""

    # Locked MVP defaults (§53)
    horizon_minutes: int = 60
    top_k: int = 5
    h3_resolution: int = 8
    candidate_radius_m: int = 5000
    max_candidates: int = 50

    class Config:
        env_file = ".env"


settings = Settings()
