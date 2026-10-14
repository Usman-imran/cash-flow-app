import os
from datetime import date, datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()


def _sqlalchemy_url(url: str) -> str:
    """Accept plain postgres:// URLs (as Supabase shows them) and use the psycopg 3 driver."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = _sqlalchemy_url(
    os.getenv("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5433/cash_flow")
)
APP_TIMEZONE = ZoneInfo(os.getenv("APP_TIMEZONE", "Asia/Karachi"))
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]


def now_local() -> datetime:
    return datetime.now(APP_TIMEZONE)


def today_local() -> date:
    return now_local().date()
