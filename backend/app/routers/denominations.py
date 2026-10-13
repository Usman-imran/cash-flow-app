from datetime import date

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..config import today_local
from ..database import DbSession

router = APIRouter(prefix="/api/denominations", tags=["Denominations"])


@router.post("", response_model=schemas.DenominationRead)
def upsert_denomination(payload: schemas.DenominationCreate, db: DbSession):
    return crud.upsert_denomination(db, payload)


def _get_or_404(db: Session, entry_date: date):
    row = crud.get_denomination(db, entry_date)
    if row is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=f"No denomination entry for {entry_date}"
        )
    return row


@router.get("", response_model=schemas.DenominationRead)
def get_today_denomination(db: DbSession):
    return _get_or_404(db, today_local())


@router.get("/{entry_date}", response_model=schemas.DenominationRead)
def get_denomination(entry_date: date, db: DbSession):
    return _get_or_404(db, entry_date)
