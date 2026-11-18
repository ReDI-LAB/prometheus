import uuid
from datetime import date, datetime, time
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)


class PhoneCallCreate(BaseModel):
    person_id: uuid.UUID
    person_type: Literal["member", "staff"]
    call_date: date
    duration_minutes: int = Field(gt=0)
    # Not restricted to a Literal/enum of known codes: the database's
    # fk_phone_calls_topic_code foreign key validates this, not Python.
    topic_code: int
    note: str | None = None

    @field_validator("note")
    @classmethod
    def blank_note_to_none(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            return None
        return value


class PhoneCallRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    call_id: uuid.UUID
    person_id: uuid.UUID
    person_type: str
    call_date: date
    duration_minutes: int
    topic_code: int
    note: str | None
    created_at: datetime


class PhoneCallPage(BaseModel):
    items: list[PhoneCallRead]
    total: int
    limit: int
    offset: int


class AttendanceCreate(BaseModel):
    member_id: uuid.UUID
    attendance_date: date
    time_in: time
    time_out: time | None = None

    @model_validator(mode="after")
    def time_out_not_before_time_in(self) -> "AttendanceCreate":
        if self.time_out is not None and self.time_out < self.time_in:
            raise ValueError("time_out must not be before time_in")
        return self


class AttendanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    attendance_id: uuid.UUID
    member_id: uuid.UUID
    attendance_date: date
    time_in: time
    time_out: time | None
    created_at: datetime


class AttendancePage(BaseModel):
    items: list[AttendanceRead]
    total: int
    limit: int
    offset: int


class MemberSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    member_id: uuid.UUID
    member_code: str
    # Nullable because the database clears names when a member is anonymized.
    first_name: str | None
    last_name: str | None
    is_member: bool
    # NULL before the member's first attendance entry.
    is_active: bool | None


class MemberPage(BaseModel):
    items: list[MemberSummary]
    total: int
    limit: int
    offset: int


def _reject_nul(value: str) -> str:
    # The database cannot store NUL characters in text columns.
    if "\x00" in value:
        raise ValueError("must not contain NUL characters")
    return value


def _optional_text(max_length: int) -> BeforeValidator:
    """Trim a string, turn blank into None, and enforce a maximum length."""

    def clean(value: object) -> object:
        if not isinstance(value, str):
            return value
        value = _reject_nul(value).strip()
        if len(value) > max_length:
            raise ValueError(f"must be at most {max_length} characters")
        return value or None

    return BeforeValidator(clean)


def _required_text(max_length: int) -> tuple[object, ...]:
    return (
        StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length),
        AfterValidator(_reject_nul),
    )


class EmergencyContactCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, *_required_text(200)]
    phone: Annotated[str, *_required_text(50)]
    # Validated against contact_relationships by the database.
    relationship: Annotated[str | None, _optional_text(50)] = None


class MemberCreate(BaseModel):
    # Generated or database-managed columns (member_code, is_member, is_active,
    # anonymized_at, leave_date, timestamps) are rejected rather than ignored.
    model_config = ConfigDict(extra="forbid")

    first_name: Annotated[str, *_required_text(100)]
    last_name: Annotated[str, *_required_text(100)]
    date_of_birth: date
    join_date: date
    # salutation, gender and country are validated against their lookup
    # tables by the database.
    salutation: Annotated[str | None, _optional_text(50)] = None
    gender: Annotated[str | None, _optional_text(50)] = None
    phone: Annotated[str | None, _optional_text(50)] = None
    email: Annotated[str | None, _optional_text(254)] = None
    street_address: Annotated[str | None, _optional_text(200)] = None
    postal_code: Annotated[str | None, _optional_text(20)] = None
    city: Annotated[str | None, _optional_text(100)] = None
    country: Annotated[str | None, _optional_text(50)] = None
    clubhouse_id: uuid.UUID | None = None
    emergency_contact: EmergencyContactCreate | None = None


class LookupItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str = Field(description="Value to send in requests that reference this lookup.")
    label: str
    sort_order: int


class CallTopicItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: int = Field(description="Integer value to send as topic_code.")
    label: str
    sort_order: int


class LookupsRead(BaseModel):
    """All lookup lists, each ordered by sort_order and then code."""

    salutations: list[LookupItem]
    genders: list[LookupItem]
    countries: list[LookupItem]
    contact_relationships: list[LookupItem]
    caller_types: list[LookupItem]
    call_topics: list[CallTopicItem]


class ClubhouseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    clubhouse_id: uuid.UUID
    name: str
    street_address: str | None
    postal_code: str | None
    city: str | None
    country: str | None
    timezone: str
    primary_language: str | None
    is_active: bool


class StaffSummary(BaseModel):
    """Staff entry without contact details such as email."""

    model_config = ConfigDict(from_attributes=True)

    staff_id: uuid.UUID
    staff_code: str
    # Nullable because the database clears names when a person is anonymized.
    first_name: str | None
    last_name: str | None
    role: str
    clubhouse_id: uuid.UUID
    staff_status: str


class StaffPage(BaseModel):
    items: list[StaffSummary]
    total: int
    limit: int
    offset: int
