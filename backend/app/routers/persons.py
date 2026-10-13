from fastapi import APIRouter, status

from .. import crud, schemas
from ..database import DbSession

router = APIRouter(prefix="/api/persons", tags=["Salesmen"])


@router.post("", response_model=schemas.PersonRead, status_code=status.HTTP_201_CREATED)
def create_person(payload: schemas.PersonCreate, db: DbSession):
    return crud.create_person(db, payload)


@router.get("", response_model=list[schemas.PersonRead])
def list_persons(db: DbSession):
    return crud.get_persons(db)
