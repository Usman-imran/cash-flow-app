from fastapi import APIRouter, HTTPException, status

from .. import crud, schemas
from ..database import DbSession

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


@router.post("", response_model=schemas.TransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(payload: schemas.TransactionCreate, db: DbSession):
    if crud.get_person(db, payload.person_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Salesman not found")
    return crud.create_transaction(db, payload)


@router.get("/today", response_model=list[schemas.TransactionRead])
def list_today_transactions(db: DbSession):
    return crud.get_today_transactions(db)
