import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    membership_status: str
    activity_status: str | None


class MemberPage(BaseModel):
    items: list[MemberSummary]
    total: int
    limit: int
    offset: int
