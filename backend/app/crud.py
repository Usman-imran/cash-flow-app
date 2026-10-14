from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session, joinedload

from . import models, schemas
from .config import APP_TIMEZONE, now_local, today_local

Txn = models.CashTransaction


def day_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    """Half-open [start 00:00, end+1 00:00) range in the app timezone."""
    return (
        datetime.combine(start, time.min, tzinfo=APP_TIMEZONE),
        datetime.combine(end + timedelta(days=1), time.min, tzinfo=APP_TIMEZONE),
    )


# ---------- Persons ----------

def create_person(db: Session, data: schemas.PersonCreate) -> models.Person:
    person = models.Person(name=data.name)
    db.add(person)
    db.flush()  # assigns person.id inside the same transaction
    person.salesman_code = f"SM-{person.id:04d}"
    db.commit()
    db.refresh(person)
    return person


def get_persons(db: Session) -> list[schemas.PersonSummary]:
    count = func.count(Txn.id)
    rows = db.execute(
        select(models.Person, count)
        .outerjoin(Txn, Txn.person_id == models.Person.id)
        .group_by(models.Person.id)
        .order_by(models.Person.id)
    )
    return [_person_summary(person, n) for person, n in rows]


def get_person(db: Session, person_id: int) -> models.Person | None:
    return db.get(models.Person, person_id)


def count_person_transactions(db: Session, person_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Txn).where(Txn.person_id == person_id)) or 0


def _person_summary(person: models.Person, transaction_count: int) -> schemas.PersonSummary:
    return schemas.PersonSummary(
        **schemas.PersonRead.model_validate(person).model_dump(), transaction_count=transaction_count
    )


def update_person(db: Session, person: models.Person, data: schemas.PersonUpdate) -> schemas.PersonSummary:
    person.name = data.name
    db.commit()
    db.refresh(person)
    return _person_summary(person, count_person_transactions(db, person.id))


def delete_person(db: Session, person: models.Person) -> None:
    db.delete(person)
    db.commit()


# ---------- Transactions ----------

def _transactions_query():
    return select(Txn).options(joinedload(Txn.person))


def create_transaction(db: Session, data: schemas.TransactionCreate) -> models.CashTransaction:
    txn_time = data.transaction_time or now_local()
    if txn_time.tzinfo is None:
        txn_time = txn_time.replace(tzinfo=APP_TIMEZONE)

    txn = Txn(
        person_id=data.person_id,
        amount=data.amount,
        transaction_time=txn_time,
        notes=data.notes or None,
    )
    if data.denomination is not None:
        txn.denomination = models.TransactionDenomination(**data.denomination.model_dump())
    db.add(txn)
    db.commit()
    return db.scalars(_transactions_query().where(Txn.id == txn.id)).one()


def get_transactions_between(
    db: Session, start: datetime, end: datetime, limit: int | None = None
) -> list[models.CashTransaction]:
    stmt = (
        _transactions_query()
        .where(Txn.transaction_time >= start, Txn.transaction_time < end)
        .order_by(Txn.transaction_time.desc(), Txn.id.desc())
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    return list(db.scalars(stmt))


def get_today_transactions(db: Session) -> list[models.CashTransaction]:
    today = today_local()
    return get_transactions_between(db, *day_bounds(today, today))


# ---------- Dashboard ----------

def get_today_summary(db: Session, recent_limit: int = 5) -> dict:
    today = today_local()
    start, end = day_bounds(today, today)

    count, total = db.execute(
        select(func.count(Txn.id), func.coalesce(func.sum(Txn.amount), 0)).where(
            Txn.transaction_time >= start, Txn.transaction_time < end
        )
    ).one()

    return {
        "date": today,
        "total_amount": total,
        "transaction_count": count,
        "recent_transactions": get_transactions_between(db, start, end, limit=recent_limit),
    }


# ---------- Denominations ----------

def get_denomination(db: Session, entry_date: date) -> models.CashDenomination | None:
    return db.scalar(
        select(models.CashDenomination).where(models.CashDenomination.entry_date == entry_date)
    )


def upsert_denomination(db: Session, data: schemas.DenominationCreate) -> models.CashDenomination:
    entry_date = data.entry_date or today_local()
    row = get_denomination(db, entry_date)
    if row is None:
        row = models.CashDenomination(entry_date=entry_date)
        db.add(row)

    for d in models.DENOMINATIONS:
        field = f"note_{d}"
        setattr(row, field, getattr(data, field))
    row.coins = data.coins
    row.total_amount = row.calculate_total()

    db.commit()
    db.refresh(row)
    return row


# ---------- Reports ----------

def report_date_wise(db: Session, start_date: date, end_date: date) -> dict:
    start, end = day_bounds(start_date, end_date)
    # Bucket by calendar day in the app timezone, not the DB session timezone
    local_day = func.date(func.timezone(APP_TIMEZONE.key, Txn.transaction_time)).label("day")

    result = db.execute(
        select(
            local_day,
            func.count(Txn.id).label("transaction_count"),
            func.coalesce(func.sum(Txn.amount), 0).label("total_amount"),
        )
        .where(Txn.transaction_time >= start, Txn.transaction_time < end)
        .group_by("day")
        .order_by("day")
    ).all()

    rows = [
        {"date": r.day, "transaction_count": r.transaction_count, "total_amount": r.total_amount}
        for r in result
    ]
    return {
        "start_date": start_date,
        "end_date": end_date,
        "transaction_count": sum(r["transaction_count"] for r in rows),
        "total_amount": sum((Decimal(r["total_amount"]) for r in rows), Decimal(0)),
        "rows": rows,
    }


def report_salesman_wise(
    db: Session, start_date: date | None = None, end_date: date | None = None
) -> dict:
    # Date filters go in the JOIN condition so salesmen with no collections still appear (with 0)
    join_on = [Txn.person_id == models.Person.id]
    if start_date is not None:
        join_on.append(Txn.transaction_time >= day_bounds(start_date, start_date)[0])
    if end_date is not None:
        join_on.append(Txn.transaction_time < day_bounds(end_date, end_date)[1])

    result = db.execute(
        select(
            models.Person.id.label("person_id"),
            models.Person.salesman_code,
            models.Person.name,
            func.count(Txn.id).label("transaction_count"),
            func.coalesce(func.sum(Txn.amount), 0).label("total_amount"),
        )
        .outerjoin(Txn, and_(*join_on))
        .group_by(models.Person.id)
        .order_by(desc("total_amount"), models.Person.name)
    ).all()

    rows = [dict(r._mapping) for r in result]
    return {
        "start_date": start_date,
        "end_date": end_date,
        "transaction_count": sum(r["transaction_count"] for r in rows),
        "total_amount": sum((Decimal(r["total_amount"]) for r in rows), Decimal(0)),
        "rows": rows,
    }
