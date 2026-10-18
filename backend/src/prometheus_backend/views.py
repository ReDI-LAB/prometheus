import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class ViewBase(DeclarativeBase):
    """Declarative base for read-only database views.

    Kept separate from models.Base so that Base.metadata never contains
    these views: nothing in this codebase calls create_all, but even if it
    did, it could never try to CREATE TABLE a view mapped under ViewBase.
    """


class MemberCurrent(ViewBase):
    """Read-only mapping of the members_current view.

    Application reads of a member's status should go through this view
    instead of the members table: membership_status and activity_status
    here are computed live for the current date in the member's clubhouse
    timezone, while Member.membership_status/Member.activity_status are
    only a write-time cache that can be stale after midnight. This class
    is read-only — nothing should INSERT/UPDATE/DELETE through it.
    """

    __tablename__ = "members_current"

    # member_id is unique in the underlying members table, but the view
    # itself defines no primary key; this is declared only so the ORM
    # mapper has an identity column, not because the database enforces it.
    member_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True)
    clubhouse_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid)
    member_code: Mapped[str] = mapped_column(sa.Text)
    first_name: Mapped[str] = mapped_column(sa.Text)
    last_name: Mapped[str] = mapped_column(sa.Text)
    date_of_birth: Mapped[date] = mapped_column(sa.Date)
    join_date: Mapped[date] = mapped_column(sa.Date)
    # membership_status_on() is STRICT on non-null inputs (join_date and the
    # computed local date are always present), so this is never NULL.
    membership_status: Mapped[str] = mapped_column(sa.Text)
    salutation: Mapped[str | None] = mapped_column(sa.Text)
    gender: Mapped[str | None] = mapped_column(sa.Text)
    phone: Mapped[str | None] = mapped_column(sa.Text)
    email: Mapped[str | None] = mapped_column(sa.Text)
    street_address: Mapped[str | None] = mapped_column(sa.Text)
    postal_code: Mapped[str | None] = mapped_column(sa.Text)
    city: Mapped[str | None] = mapped_column(sa.Text)
    country: Mapped[str | None] = mapped_column(sa.Text)
    # activity_status_on() returns NULL when there is no last_visit_date,
    # i.e. before the member's first attendance entry.
    activity_status: Mapped[str | None] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True))
    # max(attendance.attendance_date) up to status_as_of; NULL if the member
    # has no attendance on or before that date.
    last_visit_date: Mapped[date | None] = mapped_column(sa.Date)
    # The clubhouse-local calendar date the above statuses were computed
    # for, i.e. (statement_timestamp() AT TIME ZONE clubhouse.timezone)::date.
    status_as_of: Mapped[date] = mapped_column(sa.Date)
