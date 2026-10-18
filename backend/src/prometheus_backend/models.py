# CHECK constraints and triggers from the SQL schema (non-empty code/label,
# sort_order > 0, etc.) are enforced by the database and intentionally not
# mirrored here. Lookup values themselves live in the database tables below,
# not as Python enums or Literal types.

import uuid
from datetime import date, datetime, time

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


class StaffStatus(CodeLookupMixin, Base):
    __tablename__ = "staff_statuses"


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
    __table_args__ = (
        # ix_staff_clubhouse is explicitly named in the SQL and does not
        # follow the ix_<table>_<column> convention index=True would
        # generate, so it is declared explicitly to match.
        sa.Index("ix_staff_clubhouse", "clubhouse_id"),
    )
    # staff_code is trigger-generated; eager_defaults makes SQLAlchemy fetch
    # it back via RETURNING right after INSERT instead of requiring a
    # manual refresh() call, the same as Member.
    __mapper_args__ = {"eager_defaults": True}

    staff_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    # Generated once by prepare_person() (the a_prepare_staff trigger),
    # which rejects an explicit value on INSERT and blocks changing it on
    # UPDATE outside the privileged redaction procedure.
    staff_code: Mapped[str] = mapped_column(sa.Text, unique=True, server_default=sa.FetchedValue())
    # Nullable because a redacted (anonymized) staff member has these
    # cleared; a CHECK constraint (not mirrored) requires both be NULL
    # together with anonymized_at, or both be non-blank without it.
    first_name: Mapped[str | None] = mapped_column(sa.Text)
    last_name: Mapped[str | None] = mapped_column(sa.Text)
    role: Mapped[str] = mapped_column(sa.Text)
    email: Mapped[str | None] = mapped_column(sa.Text, unique=True)
    clubhouse_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("clubhouses.clubhouse_id", ondelete="RESTRICT", onupdate="NO ACTION")
    )
    # No explicit index in the SQL for this FK column; the schema's
    # trailing maintenance block dynamically creates an ix_fk_staff_
    # staff_status index for any single-column FK left without one, so
    # it is intentionally not declared here.
    staff_status: Mapped[str] = mapped_column(
        sa.ForeignKey("staff_statuses.code", ondelete="RESTRICT", onupdate="NO ACTION"),
        server_default="active",
    )
    start_date: Mapped[date | None] = mapped_column(sa.Date)
    end_date: Mapped[date | None] = mapped_column(sa.Date)
    # Set only by the privileged redaction procedure. prepare_person()
    # (the a_prepare_staff trigger) rejects a non-NULL value on INSERT and
    # blocks changing it on UPDATE outside that procedure.
    anonymized_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
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


class Member(Base):
    """One row per clubhouse member.

    Application reads should eventually go through the members_current view
    instead of this table directly: membership_status and activity_status
    below are a cache that is only refreshed on write (or by the optional
    refresh_member_status_cache() procedure), so they can be stale relative
    to the current local date. The view itself is not mapped in this step.

    Changing clubhouse_id is logged by log_member_transfer (an AFTER UPDATE
    trigger) into member_clubhouse_history, which is not mapped here.
    """

    __tablename__ = "members"
    __table_args__ = (
        # ix_members_clubhouse is explicitly named in the SQL and does not
        # follow the ix_<table>_<column> convention index=True would
        # generate, so it is declared explicitly to match.
        sa.Index("ix_members_clubhouse", "clubhouse_id"),
    )
    # Several columns are entirely computed/generated by triggers and must
    # never be sent by the app on INSERT; eager_defaults lets SQLAlchemy
    # fetch them back via RETURNING right after INSERT/UPDATE instead of
    # requiring a manual refresh() call.
    __mapper_args__ = {"eager_defaults": True}

    member_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    clubhouse_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("clubhouses.clubhouse_id", ondelete="RESTRICT", onupdate="NO ACTION")
    )
    # Generated once by prepare_person() (the a_prepare_members trigger),
    # which rejects the INSERT if member_code is supplied; also immutable
    # afterward, since the same trigger blocks changing it on UPDATE outside
    # the privileged redaction procedure.
    member_code: Mapped[str] = mapped_column(sa.Text, unique=True, server_default=sa.FetchedValue())
    # Nullable because a redacted (anonymized) member has these cleared; a
    # CHECK constraint (not mirrored) requires both be NULL together with
    # anonymized_at, or both be non-blank/present without it.
    first_name: Mapped[str | None] = mapped_column(sa.Text)
    last_name: Mapped[str | None] = mapped_column(sa.Text)
    date_of_birth: Mapped[date | None] = mapped_column(sa.Date)
    join_date: Mapped[date] = mapped_column(sa.Date)
    leave_date: Mapped[date | None] = mapped_column(sa.Date)
    # Set only by the privileged redaction procedure. prepare_person() (the
    # a_prepare_members trigger) rejects a non-NULL value on INSERT and
    # blocks changing it on UPDATE outside that procedure, the same
    # immutability guard as member_code.
    anonymized_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    # Recomputed on every INSERT/UPDATE by refresh_member_on_write() (the
    # b_refresh_member trigger) from join_date; any client-supplied value is
    # ignored on INSERT and rejected on UPDATE unless it matches. No
    # explicit index in the SQL; left to the schema's dynamic ix_fk_*
    # maintenance pass, same as Staff.staff_status.
    membership_status: Mapped[str] = mapped_column(
        sa.ForeignKey("membership_statuses.code", ondelete="RESTRICT", onupdate="NO ACTION"),
        server_default=sa.FetchedValue(),
    )
    salutation: Mapped[str | None] = mapped_column(
        sa.ForeignKey("salutations.code", ondelete="RESTRICT", onupdate="NO ACTION")
    )
    gender: Mapped[str | None] = mapped_column(
        sa.ForeignKey("genders.code", ondelete="RESTRICT", onupdate="NO ACTION")
    )
    phone: Mapped[str | None] = mapped_column(sa.Text)
    email: Mapped[str | None] = mapped_column(sa.Text)
    street_address: Mapped[str | None] = mapped_column(sa.Text)
    postal_code: Mapped[str | None] = mapped_column(sa.Text)
    city: Mapped[str | None] = mapped_column(sa.Text)
    country: Mapped[str | None] = mapped_column(
        sa.ForeignKey("countries.code", ondelete="RESTRICT", onupdate="NO ACTION")
    )
    # Same refresh_member_on_write() trigger as membership_status; NULL until
    # the member's first attendance entry. No explicit index, same as above.
    activity_status: Mapped[str | None] = mapped_column(
        sa.ForeignKey("activity_statuses.code", ondelete="RESTRICT", onupdate="NO ACTION"),
        server_default=sa.FetchedValue(),
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


class Attendance(Base):
    """Time-in/time-out log for members.

    Inserting, updating, or deleting rows here fires
    refresh_attendance_members() (the refresh_members_after_visit_*
    statement-level triggers on this table), which issues an
    UPDATE members SET updated_at = clock_timestamp() for each affected
    member. That UPDATE in turn re-fires every BEFORE UPDATE trigger on
    members, including b_refresh_member, so Member.membership_status and
    Member.activity_status get recomputed as a side effect of writing
    attendance, not just Member.updated_at.

    This table is PARTITION BY RANGE (attendance_date) in the database; the
    backend never creates tables or partitions. All INSERT/UPDATE/DELETE
    must target this parent table (never a monthly partition directly);
    UPDATE and DELETE must address a row by both attendance_id and
    attendance_date (the full primary key), not attendance_id alone; and an
    INSERT for a date with no matching monthly partition fails.
    """

    __tablename__ = "attendance"
    __table_args__ = (
        sa.PrimaryKeyConstraint("attendance_id", "attendance_date", name="pk_attendance"),
        # ix_attendance_member_date is explicitly named in the SQL and does
        # not follow the ix_<table>_<column> convention index=True would
        # generate, so it is declared explicitly to match.
        sa.Index("ix_attendance_member_date", "member_id", sa.text("attendance_date DESC")),
    )

    attendance_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, server_default=sa.text("gen_random_uuid()")
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("members.member_id", ondelete="RESTRICT", onupdate="NO ACTION")
    )
    attendance_date: Mapped[date] = mapped_column(sa.Date)
    time_in: Mapped[time] = mapped_column(sa.Time)
    time_out: Mapped[time | None] = mapped_column(sa.Time)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )


class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"
    __table_args__ = (
        # ix_contacts_member is explicitly named in the SQL and does not
        # follow the ix_<table>_<column> convention index=True would
        # generate, so it is declared explicitly to match.
        sa.Index("ix_contacts_member", "member_id"),
    )

    contact_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("members.member_id", ondelete="CASCADE", onupdate="NO ACTION")
    )
    name: Mapped[str] = mapped_column(sa.Text)
    phone: Mapped[str] = mapped_column(sa.Text)
    # No explicit index in the SQL for this FK column anymore (the old
    # ix_emergency_contacts_relationship is gone); left to the schema's
    # dynamic ix_fk_* maintenance pass, same as Staff.staff_status.
    relationship_: Mapped[str | None] = mapped_column(
        "relationship",
        sa.ForeignKey("contact_relationships.code", ondelete="RESTRICT", onupdate="NO ACTION"),
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )


class PhoneCall(Base):
    """A phone call logged against either a member or a staff person.

    person_id/person_type are a polymorphic reference: person_id holds a
    member_id or a staff_id depending on whether person_type is 'member'
    or 'staff'. member_reference_id/staff_reference_id below are database-
    computed copies of person_id used only to give that polymorphic
    reference a real, checkable foreign key in each direction.

    This table is PARTITION BY RANGE (call_date) in the database; the
    backend never creates tables or partitions. All INSERT/UPDATE/DELETE
    must target this parent table (never a monthly partition directly);
    UPDATE and DELETE must address a row by both call_id and call_date (the
    full primary key), not call_id alone; and an INSERT for a date with no
    matching monthly partition fails.
    """

    __tablename__ = "phone_calls"
    __table_args__ = (
        sa.PrimaryKeyConstraint("call_id", "call_date", name="pk_phone_calls"),
        # ix_calls_member/ix_calls_staff are explicitly named in the SQL and
        # do not follow the ix_<table>_<column> convention index=True would
        # generate (they are also composite with call_date, replacing the
        # old single-column indexes), so they are declared explicitly.
        sa.Index("ix_calls_member", "member_reference_id", "call_date"),
        sa.Index("ix_calls_staff", "staff_reference_id", "call_date"),
    )

    call_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, server_default=sa.text("gen_random_uuid()"))
    person_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid)
    person_type: Mapped[str] = mapped_column(
        sa.ForeignKey("caller_types.code", ondelete="RESTRICT", onupdate="NO ACTION")
    )
    call_date: Mapped[date] = mapped_column(sa.Date)
    duration_minutes: Mapped[int] = mapped_column(sa.Integer)
    # No explicit index in the SQL for this FK column anymore (the old
    # ix_phone_calls_topic_code is gone); left to the schema's dynamic
    # ix_fk_* maintenance pass, same as Staff.staff_status.
    topic_code: Mapped[int] = mapped_column(
        sa.ForeignKey("call_topics.code", ondelete="RESTRICT", onupdate="NO ACTION")
    )
    note: Mapped[str | None] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    # Generated by the database (GENERATED ALWAYS AS ... STORED); equals
    # person_id when person_type = 'member', otherwise NULL. The app must
    # never set this directly — Postgres rejects an explicit value for a
    # generated column. Indexed via ix_calls_member above, not index=True.
    member_reference_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid,
        sa.Computed("CASE WHEN person_type = 'member' THEN person_id END", persisted=True),
        sa.ForeignKey("members.member_id", ondelete="RESTRICT", onupdate="NO ACTION"),
    )
    # Generated by the database (GENERATED ALWAYS AS ... STORED); equals
    # person_id when person_type = 'staff', otherwise NULL. Same
    # app-must-never-set-this rule as member_reference_id. Indexed via
    # ix_calls_staff above, not index=True.
    staff_reference_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid,
        sa.Computed("CASE WHEN person_type = 'staff' THEN person_id END", persisted=True),
        sa.ForeignKey("staff.staff_id", ondelete="RESTRICT", onupdate="NO ACTION"),
    )
