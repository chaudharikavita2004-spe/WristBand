import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-not-secret")
    DATA_BACKEND = os.getenv("DATA_BACKEND", "memory")
    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5500").split(",") if o.strip()]
    SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    EVIDENCE_BUCKET = os.getenv("EVIDENCE_BUCKET", "evidence")
    MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB evidence limit
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")
    # Only used by the memory backend: {token: {"id":..., "email":...}}
    TEST_TOKENS: dict = {}
