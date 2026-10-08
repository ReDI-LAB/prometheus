# CHECK constraints and triggers from the SQL schema (non-empty code/label,
# sort_order > 0, etc.) are enforced by the database and intentionally not
# mirrored here. Lookup values themselves live in the database tables below,
# not as Python enums or Literal types.

import uuid
from datetime import date, datetime

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


class CallTopic(Base):
    """The one lookup table with an integer code, so it does not use CodeLookupMixin."""

    __tablename__ = "call_topics"

    code: Mapped[int] = mapped_column(sa.Integer, primary_key=True)
    label: Mapped[str] = mapped_column(sa.Text)
    sort_order: Mapped[int] = mapped_column(sa.Integer)


class Clubhouse(Base):
    __tablename__ = "clubhouses"

    clubhouse_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(sa.Text, unique=True)
    street_address: Mapped[str | None] = mapped_column(sa.Text)
    postal_code: Mapped[str | None] = mapped_column(sa.Text)
    city: Mapped[str | None] = mapped_column(sa.Text)
    country: Mapped[str | None] = mapped_column(
        sa.ForeignKey("countries.code", ondelete="RESTRICT", onupdate="NO ACTION"), index=True
    )
    timezone: Mapped[str] = mapped_column(sa.Text)
    primary_language: Mapped[str | None] = mapped_column(
        sa.ForeignKey("languages.code", ondelete="RESTRICT", onupdate="NO ACTION"), index=True
    )
    clubhouse_status: Mapped[str] = mapped_column(
        sa.ForeignKey("clubhouse_statuses.code", ondelete="RESTRICT", onupdate="NO ACTION"),
        server_default="active",
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    # Overwritten by touch_updated_at() (the z_touch_clubhouses trigger) with
    # clock_timestamp() on every UPDATE, so it is maintained by the database,
    # not the app.
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        server_onupdate=sa.FetchedValue(),
    )


class Staff(Base):
    __tablename__ = "staff"

    staff_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    # The a_prepare_staff trigger generates this value on INSERT and rejects
    # any attempt to change it afterwards; it is not meant to be client-set.
    staff_code: Mapped[str] = mapped_column(sa.Text, unique=True)
    first_name: Mapped[str] = mapped_column(sa.Text)
    last_name: Mapped[str] = mapped_column(sa.Text)
    role: Mapped[str] = mapped_column(sa.Text)
    email: Mapped[str | None] = mapped_column(sa.Text, unique=True)
    active: Mapped[bool] = mapped_column(sa.Boolean, server_default=sa.text("true"))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    # Overwritten by touch_updated_at() (the z_touch_staff trigger) with
    # clock_timestamp() on every UPDATE, same as Clubhouse.updated_at.
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        server_onupdate=sa.FetchedValue(),
    )


class StaffClubhouse(Base):
    __tablename__ = "staff_clubhouses"
    __table_args__ = (
        sa.PrimaryKeyConstraint("staff_id", "clubhouse_id", name="pk_staff_clubhouses"),
        # A partial unique index (uq_staff_primary_clubhouse) enforces at most
        # one is_primary row per staff_id at the database level; not mirrored
        # as a declarative constraint here.
    )

    staff_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("staff.staff_id", ondelete="CASCADE", onupdate="NO ACTION")
    )
    clubhouse_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("clubhouses.clubhouse_id", ondelete="CASCADE", onupdate="NO ACTION"),
        index=True,
    )
    is_primary: Mapped[bool] = mapped_column(sa.Boolean, server_default=sa.text("false"))
    assigned_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )


class Member(Base):
    """One row per clubhouse member.

    Application reads should eventually go through the members_current view
    instead of this table directly: membership_status and activity_status
    below are a cache that is only refreshed on write (or by the optional
    refresh_member_status_cache() procedure), so they can be stale relative
    to the current local date. The view itself is not mapped in this step.
    """

    __tablename__ = "members"
    # Several columns are entirely computed/generated by triggers and must
    # never be sent by the app on INSERT; eager_defaults lets SQLAlchemy
    # fetch them back via RETURNING right after INSERT/UPDATE instead of
    # requiring a manual refresh() call.
    __mapper_args__ = {"eager_defaults": True}

    member_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    clubhouse_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("clubhouses.clubhouse_id", ondelete="RESTRICT", onupdate="NO ACTION"),
        index=True,
    )
    # Generated once by prepare_person() (the a_prepare_members trigger),
    # which rejects the INSERT if member_code is supplied; also immutable
    # afterward, since the same trigger blocks changing it on UPDATE.
    member_code: Mapped[str] = mapped_column(sa.Text, unique=True, server_default=sa.FetchedValue())
    first_name: Mapped[str] = mapped_column(sa.Text)
    last_name: Mapped[str] = mapped_column(sa.Text)
    date_of_birth: Mapped[date] = mapped_column(sa.Date)
    join_date: Mapped[date] = mapped_column(sa.Date)
    # Recomputed on every INSERT/UPDATE by refresh_member_on_write() (the
    # b_refresh_member trigger) from join_date; any client-supplied value is
    # ignored on INSERT and rejected on UPDATE unless it matches.
    membership_status: Mapped[str] = mapped_column(
        sa.ForeignKey("membership_statuses.code", ondelete="RESTRICT", onupdate="NO ACTION"),
        server_default=sa.FetchedValue(),
        index=True,
    )
    salutation: Mapped[str | None] = mapped_column(
        sa.ForeignKey("salutations.code", ondelete="RESTRICT", onupdate="NO ACTION"), index=True
    )
    gender: Mapped[str | None] = mapped_column(
        sa.ForeignKey("genders.code", ondelete="RESTRICT", onupdate="NO ACTION"), index=True
    )
    phone: Mapped[str | None] = mapped_column(sa.Text)
    email: Mapped[str | None] = mapped_column(sa.Text)
    street_address: Mapped[str | None] = mapped_column(sa.Text)
    postal_code: Mapped[str | None] = mapped_column(sa.Text)
    city: Mapped[str | None] = mapped_column(sa.Text)
    country: Mapped[str | None] = mapped_column(
        sa.ForeignKey("countries.code", ondelete="RESTRICT", onupdate="NO ACTION"), index=True
    )
    # Same refresh_member_on_write() trigger as membership_status; NULL until
    # the member's first attendance entry.
    activity_status: Mapped[str | None] = mapped_column(
        sa.ForeignKey("activity_statuses.code", ondelete="RESTRICT", onupdate="NO ACTION"),
        server_default=sa.FetchedValue(),
        index=True,
    )
    # Reset to its prior value on every UPDATE by touch_updated_at() (the
    # z_touch_members trigger), so it is effectively immutable after creation.
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    # Overwritten by touch_updated_at() on every direct UPDATE, and also by
    # refresh_attendance_members() whenever this member's attendance rows
    # change, so it can change without the app ever issuing an UPDATE here.
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        server_onupdate=sa.FetchedValue(),
    )
