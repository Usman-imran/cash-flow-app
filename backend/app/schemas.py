from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, model_validator

from .models import DENOMINATIONS

# Kept as Decimal internally, emitted as a JSON number (Pydantic's default is a string)
Money = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Persons ----------

class PersonCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)


class PersonBrief(ORMModel):
    id: int
    salesman_code: str | None
    name: str


class PersonUpdate(PersonCreate):
    pass


class PersonRead(PersonBrief):
    created_at: datetime


class PersonSummary(PersonRead):
    transaction_count: int = 0


# ---------- Transactions ----------

class NoteCounts(BaseModel):
    note_5000: int = Field(default=0, ge=0)
    note_1000: int = Field(default=0, ge=0)
    note_500: int = Field(default=0, ge=0)
    note_100: int = Field(default=0, ge=0)
    note_50: int = Field(default=0, ge=0)
    note_20: int = Field(default=0, ge=0)
    note_10: int = Field(default=0, ge=0)
    coins: int = Field(default=0, ge=0)  # rupee amount, not a count

    def total(self) -> Decimal:
        return Decimal(sum(getattr(self, f"note_{d}") * d for d in DENOMINATIONS) + self.coins)


class NoteCountsRead(ORMModel):
    note_5000: int
    note_1000: int
    note_500: int
    note_100: int
    note_50: int
    note_20: int
    note_10: int
    coins: int


class TransactionCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    person_id: int = Field(gt=0)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    transaction_time: datetime | None = None  # defaults to now
    notes: str | None = Field(default=None, max_length=1000)
    # Optional note breakdown; when given it must add up to `amount`
    denomination: NoteCounts | None = None

    @model_validator(mode="after")
    def denomination_matches_amount(self):
        if self.denomination is not None and self.denomination.total() != self.amount:
            raise ValueError("Note counts must add up to the amount")
        return self


class TransactionUpdate(TransactionCreate):
    pass


class TransactionRead(ORMModel):
    id: int
    person_id: int
    amount: Money
    transaction_time: datetime
    notes: str | None
    created_at: datetime
    person: PersonBrief
    denomination: NoteCountsRead | None = None


# ---------- Dashboard ----------

class TodaySummary(BaseModel):
    date: date
    total_amount: Money
    transaction_count: int
    recent_transactions: list[TransactionRead]


# ---------- Denominations ----------

class DenominationCreate(BaseModel):
    entry_date: date | None = None  # defaults to today
    note_5000: int = Field(default=0, ge=0)
    note_1000: int = Field(default=0, ge=0)
    note_500: int = Field(default=0, ge=0)
    note_100: int = Field(default=0, ge=0)
    note_50: int = Field(default=0, ge=0)
    note_20: int = Field(default=0, ge=0)
    note_10: int = Field(default=0, ge=0)
    coins: int = Field(default=0, ge=0)  # rupee amount, not a count


class DenominationRead(ORMModel):
    id: int
    entry_date: date
    note_5000: int
    note_1000: int
    note_500: int
    note_100: int
    note_50: int
    note_20: int
    note_10: int
    coins: int
    total_amount: Money
    created_at: datetime


# ---------- Reports ----------

class DateWiseRow(BaseModel):
    date: date
    transaction_count: int
    total_amount: Money


class DateWiseReport(BaseModel):
    start_date: date
    end_date: date
    transaction_count: int
    total_amount: Money
    rows: list[DateWiseRow]


class SalesmanWiseRow(BaseModel):
    person_id: int
    salesman_code: str | None
    name: str
    transaction_count: int
    total_amount: Money


class SalesmanWiseReport(BaseModel):
    start_date: date | None
    end_date: date | None
    transaction_count: int
    total_amount: Money
    rows: list[SalesmanWiseRow]
