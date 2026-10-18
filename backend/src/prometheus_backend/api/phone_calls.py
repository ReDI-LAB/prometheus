import uuid
from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from prometheus_backend.database import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SessionDep
from prometheus_backend.models import PhoneCall
from prometheus_backend.schemas import PhoneCallCreate, PhoneCallPage, PhoneCallRead

router = APIRouter(prefix="/api/v1/phone-calls", tags=["phone-calls"])

DEFAULT_DATE_RANGE_DAYS = 90
MAX_DATE_RANGE_DAYS = 366


def _map_integrity_error(exc: IntegrityError) -> tuple[int, str]:
    # exc.orig is SQLAlchemy's asyncpg DBAPI wrapper; the actual asyncpg
    # exception carrying constraint_name/message is its __cause__.
    asyncpg_error = exc.orig.__cause__
    constraint_name = getattr(asyncpg_error, "constraint_name", None)
    message = getattr(asyncpg_error, "message", str(asyncpg_error))

    if "no partition of relation" in message:
        return 503, "No database partition exists for this date; contact the database administrator"
    if constraint_name in ("fk_phone_calls_member", "fk_phone_calls_staff"):
        return 422, "person_id does not exist for this person_type"
    if constraint_name == "fk_phone_calls_topic_code":
        return 422, "Unknown topic_code"
    return 422, "Invalid phone call data"


@router.post("", status_code=201)
async def create_phone_call(payload: PhoneCallCreate, session: SessionDep) -> PhoneCallRead:
    call = PhoneCall(**payload.model_dump())
    session.add(call)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        status_code, detail = _map_integrity_error(exc)
        raise HTTPException(status_code=status_code, detail=detail) from None
    return PhoneCallRead.model_validate(call)


@router.get("")
async def list_phone_calls(
    session: SessionDep,
    person_id: uuid.UUID | None = None,
    person_type: Literal["member", "staff"] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PhoneCallPage:
    if person_id is not None and person_type is None:
        raise HTTPException(
            status_code=422, detail="person_type is required when person_id is given"
        )

    resolved_date_to = date_to or date.today()
    resolved_date_from = date_from or (resolved_date_to - timedelta(days=DEFAULT_DATE_RANGE_DAYS))

    if resolved_date_from > resolved_date_to:
        raise HTTPException(status_code=422, detail="date_from must not be after date_to")
    if (resolved_date_to - resolved_date_from).days > MAX_DATE_RANGE_DAYS:
        raise HTTPException(
            status_code=422, detail=f"date range must not exceed {MAX_DATE_RANGE_DAYS} days"
        )

    # Always filtering on call_date lets Postgres prune partitions.
    filters = [PhoneCall.call_date >= resolved_date_from, PhoneCall.call_date <= resolved_date_to]
    if person_id is not None:
        if person_type == "member":
            filters.append(PhoneCall.member_reference_id == person_id)
        else:
            filters.append(PhoneCall.staff_reference_id == person_id)

    total = await session.scalar(select(func.count()).select_from(PhoneCall).where(*filters))
    result = await session.scalars(
        select(PhoneCall)
        .where(*filters)
        .order_by(PhoneCall.call_date.desc(), PhoneCall.call_id)
        .limit(limit)
        .offset(offset)
    )
    calls = result.all()
    return PhoneCallPage(
        items=[PhoneCallRead.model_validate(call) for call in calls],
        total=total or 0,
        limit=limit,
        offset=offset,
    )
