import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
