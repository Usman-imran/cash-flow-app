from fastapi import APIRouter

from .. import crud, schemas
from ..database import DbSession

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/today-total", response_model=schemas.TodaySummary)
def today_total(db: DbSession):
    return crud.get_today_summary(db)
