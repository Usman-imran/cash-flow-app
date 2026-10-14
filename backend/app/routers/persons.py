from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError

from .. import crud, schemas
from ..database import DbSession

router = APIRouter(prefix="/api/persons", tags=["Salesmen"])


def _get_or_404(db: DbSession, person_id: int):
    person = crud.get_person(db, person_id)
    if person is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salesman not found")
    return person


def _in_use(count: int) -> HTTPException:
    entries = "1 cash entry" if count == 1 else f"{count} cash entries"
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"This salesman has {entries} recorded and can't be removed.",
    )


@router.post("", response_model=schemas.PersonRead, status_code=status.HTTP_201_CREATED)
def create_person(payload: schemas.PersonCreate, db: DbSession):
    return crud.create_person(db, payload)


@router.get("", response_model=list[schemas.PersonSummary])
def list_persons(db: DbSession):
    return crud.get_persons(db)


@router.put("/{person_id}", response_model=schemas.PersonSummary)
def update_person(person_id: int, payload: schemas.PersonUpdate, db: DbSession):
    return crud.update_person(db, _get_or_404(db, person_id), payload)


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_person(person_id: int, db: DbSession):
    person = _get_or_404(db, person_id)
    # Cash entries reference the salesman; keep the history intact
    count = crud.count_person_transactions(db, person_id)
    if count:
        raise _in_use(count)
    try:
        crud.delete_person(db, person)
    except IntegrityError:
        # An entry was recorded between the check and the delete
        db.rollback()
        raise _in_use(crud.count_person_transactions(db, person_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
