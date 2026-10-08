# CHECK constraints and triggers from the SQL schema (non-empty code/label,
# sort_order > 0, etc.) are enforced by the database and intentionally not
# mirrored here. Lookup values themselves live in the database tables below,
# not as Python enums or Literal types.

import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class CodeLookupMixin:
    """Shared shape for the text-coded lookup tables: code/label/sort_order."""

    code: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    label: Mapped[str] = mapped_column(sa.Text)
    sort_order: Mapped[int] = mapped_column(sa.Integer)


class Salutation(CodeLookupMixin, Base):
    __tablename__ = "salutations"


class Gender(CodeLookupMixin, Base):
    __tablename__ = "genders"


class ActivityStatus(CodeLookupMixin, Base):
    __tablename__ = "activity_statuses"


class MembershipStatus(CodeLookupMixin, Base):
    __tablename__ = "membership_statuses"


class ContactRelationship(CodeLookupMixin, Base):
    __tablename__ = "contact_relationships"


class CallerType(CodeLookupMixin, Base):
    __tablename__ = "caller_types"


class CashTransactionType(CodeLookupMixin, Base):
    __tablename__ = "cash_transaction_types"


class Currency(CodeLookupMixin, Base):
    __tablename__ = "currencies"


class ClubhouseStatus(CodeLookupMixin, Base):
    __tablename__ = "clubhouse_statuses"


class Country(CodeLookupMixin, Base):
    __tablename__ = "countries"


class Language(CodeLookupMixin, Base):
    __tablename__ = "languages"
