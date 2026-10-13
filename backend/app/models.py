from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

DENOMINATIONS = (5000, 1000, 500, 100, 50, 20, 10)


class Person(Base):
    __tablename__ = "persons"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Assigned from the id right after insert (SM-0001, SM-0002, ...)
    salesman_code: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    transactions: Mapped[list["CashTransaction"]] = relationship(back_populates="person")


class CashTransaction(Base):
    __tablename__ = "cash_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    person_id: Mapped[int] = mapped_column(
        ForeignKey("persons.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    transaction_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    person: Mapped[Person] = relationship(back_populates="transactions")
    # Note breakdown of the cash handed over; absent when the amount was typed in directly
    denomination: Mapped["TransactionDenomination | None"] = relationship(
        back_populates="transaction", cascade="all, delete-orphan", lazy="selectin"
    )


class TransactionDenomination(Base):
    __tablename__ = "cash_transaction_denominations"

    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("cash_transactions.id", ondelete="CASCADE"), primary_key=True
    )
    note_5000: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    note_1000: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    note_500: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    note_100: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    note_50: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    note_20: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    note_10: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    # Coins are recorded as a rupee amount, not a count
    coins: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    transaction: Mapped[CashTransaction] = relationship(back_populates="denomination")

    def calculate_total(self) -> Decimal:
        notes = sum((getattr(self, f"note_{d}") or 0) * d for d in DENOMINATIONS)
        return Decimal(notes + (self.coins or 0))


class CashDenomination(Base):
    __tablename__ = "cash_denominations"

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_date: Mapped[date] = mapped_column(Date, unique=True, index=True, nullable=False)
    note_5000: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    note_1000: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    note_500: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    note_100: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    note_50: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    note_20: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    note_10: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    # Coins are recorded as a rupee amount, not a count
    coins: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=0, server_default="0", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def calculate_total(self) -> Decimal:
        notes = sum((getattr(self, f"note_{d}") or 0) * d for d in DENOMINATIONS)
        return Decimal(notes + (self.coins or 0))
