"""Runtime settings, read from environment variables. No secrets are stored in code."""
import os
from functools import lru_cache
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "app" / "data"


class Settings:
    def __init__(self) -> None:
        self.app_env = os.getenv("APP_ENV", "demo")
        self.cors_origins = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
        self.max_upload_mb = float(os.getenv("MAX_UPLOAD_MB", "10"))
        self.upload_dir = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads"))
        self.scenario_date = os.getenv("SCENARIO_DATE", "2026-10-17")
        # Google Cloud configuration (all optional; empty means demo fallback)
        self.gcp_project = os.getenv("GOOGLE_CLOUD_PROJECT", "")
        self.gcp_region = os.getenv("GOOGLE_CLOUD_REGION", "asia-south1")
        self.gemini_enabled = os.getenv("GEMINI_ENABLED", "false").lower() == "true"
        self.gemini_model = os.getenv("VERTEX_GEMINI_MODEL", "gemini-2.5-flash")
        self.bigquery_dataset = os.getenv("BIGQUERY_DATASET", "claimwise")
        self.gcs_bucket = os.getenv("GCS_BUCKET", "")
        self.document_ai_processor = os.getenv("DOCUMENT_AI_PROCESSOR_ID", "")
        self.document_ai_location = os.getenv("DOCUMENT_AI_LOCATION", "us")
        self.search_datastore = os.getenv("VERTEX_SEARCH_DATASTORE_ID", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()
