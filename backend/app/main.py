from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (registers tables on Base.metadata)
from .config import CORS_ORIGINS
from .database import Base, engine
from .routers import dashboard, denominations, persons, reports, transactions


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Creates missing tables on startup; switch to Alembic once the schema starts evolving
    Base.metadata.create_all(bind=engine)
    # create_all doesn't add columns to existing tables
    with engine.begin() as conn:
        for table in ("cash_denominations", "cash_transaction_denominations"):
            conn.execute(
                text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0")
            )
    yield


app = FastAPI(title="Cash Flow API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(persons.router)
app.include_router(transactions.router)
app.include_router(dashboard.router)
app.include_router(denominations.router)
app.include_router(reports.router)


@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok"}
