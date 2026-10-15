from fastapi import APIRouter, HTTPException, Response, status

from .. import crud, schemas
from ..database import DbSession

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


def _get_or_404(db: DbSession, txn_id: int):
    txn = crud.get_transaction(db, txn_id)
    if txn is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Entry not found")
    return txn


@router.post("", response_model=schemas.TransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(payload: schemas.TransactionCreate, db: DbSession):
    if crud.get_person(db, payload.person_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Salesman not found")
    return crud.create_transaction(db, payload)


@router.get("/today", response_model=list[schemas.TransactionRead])
def list_today_transactions(db: DbSession):
    return crud.get_today_transactions(db)


@router.put("/{txn_id}", response_model=schemas.TransactionRead)
def update_transaction(txn_id: int, payload: schemas.TransactionUpdate, db: DbSession):
    txn = _get_or_404(db, txn_id)
    if crud.get_person(db, payload.person_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Salesman not found")
    return crud.update_transaction(db, txn, payload)


@router.delete("/{txn_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(txn_id: int, db: DbSession):
    crud.delete_transaction(db, _get_or_404(db, txn_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
