from datetime import date

from fastapi import APIRouter, HTTPException, Query, status

from .. import crud, schemas
from ..database import DbSession

router = APIRouter(prefix="/api/reports", tags=["Reports"])


def _check_range(start_date: date | None, end_date: date | None) -> None:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="start_date must be on or before end_date"
        )


@router.get("/date-wise", response_model=schemas.DateWiseReport)
def date_wise(
    db: DbSession,
    start_date: date = Query(..., description="YYYY-MM-DD, inclusive"),
    end_date: date = Query(..., description="YYYY-MM-DD, inclusive"),
):
    _check_range(start_date, end_date)
    return crud.report_date_wise(db, start_date, end_date)


@router.get("/salesman-wise", response_model=schemas.SalesmanWiseReport)
def salesman_wise(
    db: DbSession,
    start_date: date | None = Query(None, description="YYYY-MM-DD, inclusive"),
    end_date: date | None = Query(None, description="YYYY-MM-DD, inclusive"),
):
    _check_range(start_date, end_date)
    return crud.report_salesman_wise(db, start_date, end_date)
