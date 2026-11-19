import calendar
import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from prometheus_backend.database import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SessionDep
from prometheus_backend.models import Attendance, Member
from prometheus_backend.schemas import (
    AttendanceCreate,
    AttendancePage,
    AttendanceRead,
    AttendanceSummary,
)

router = APIRouter(prefix="/api/v1/attendance", tags=["attendance"])

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
    if constraint_name == "fk_attendance_member_id":
        return 422, "member_id does not exist"
    if constraint_name == "ck_attendance_times":
        return 422, "time_out must not be before time_in"
    return 422, "Invalid attendance data"


@router.post("", status_code=201)
async def create_attendance(payload: AttendanceCreate, session: SessionDep) -> AttendanceRead:
    # The database refreshes the related member's is_active and
    # updated_at as a side effect of this insert (see the Attendance
    # class docstring in models.py); this endpoint does not re-read or
    # report that, so a client should re-read the member separately.
    entry = Attendance(**payload.model_dump())
    session.add(entry)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        status_code, detail = _map_integrity_error(exc)
        raise HTTPException(status_code=status_code, detail=detail) from None
    return AttendanceRead.model_validate(entry)


@router.get("")
async def list_attendance(
    session: SessionDep,
    member_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AttendancePage:
    resolved_date_to = date_to or date.today()
    resolved_date_from = date_from or (resolved_date_to - timedelta(days=DEFAULT_DATE_RANGE_DAYS))

    if resolved_date_from > resolved_date_to:
        raise HTTPException(status_code=422, detail="date_from must not be after date_to")
    if (resolved_date_to - resolved_date_from).days > MAX_DATE_RANGE_DAYS:
        raise HTTPException(
            status_code=422, detail=f"date range must not exceed {MAX_DATE_RANGE_DAYS} days"
        )

    # Always filtering on attendance_date lets Postgres prune partitions.
    filters = [
        Attendance.attendance_date >= resolved_date_from,
        Attendance.attendance_date <= resolved_date_to,
    ]
    if member_id is not None:
        filters.append(Attendance.member_id == member_id)

    total = await session.scalar(select(func.count()).select_from(Attendance).where(*filters))
    result = await session.scalars(
        select(Attendance)
        .where(*filters)
        .order_by(
            Attendance.attendance_date.desc(),
            Attendance.time_in.desc(),
            Attendance.attendance_id,
        )
        .limit(limit)
        .offset(offset)
    )
    entries = result.all()
    return AttendancePage(
        items=[AttendanceRead.model_validate(entry) for entry in entries],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


@router.get("/summary", summary="Attendance counters for a member")
async def attendance_summary(
    session: SessionDep,
    member_id: uuid.UUID,
    month: Annotated[
        str | None,
        Query(
            pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
            description="Calendar month as YYYY-MM. Cannot be combined with date_from or date_to.",
        ),
    ] = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> AttendanceSummary:
    """Counts a member's attendance entries in a window: the given month, the given
    date_from/date_to, or the current calendar month when nothing is given (the date of the
    server clock). The window rules are the same as for the attendance list."""
    if month is not None and (date_from is not None or date_to is not None):
        raise HTTPException(
            status_code=422, detail="month cannot be combined with date_from or date_to"
        )

    if month is not None:
        try:
            year, month_number = (int(part) for part in month.split("-"))
            resolved_date_from = date(year, month_number, 1)
            resolved_date_to = date(year, month_number, calendar.monthrange(year, month_number)[1])
        except ValueError:
            raise HTTPException(status_code=422, detail="month is not a valid month") from None
    elif date_from is None and date_to is None:
        today = date.today()
        resolved_date_from = today.replace(day=1)
        resolved_date_to = today.replace(day=calendar.monthrange(today.year, today.month)[1])
    else:
        resolved_date_to = date_to or date.today()
        resolved_date_from = date_from or (
            resolved_date_to - timedelta(days=DEFAULT_DATE_RANGE_DAYS)
        )

    if resolved_date_from > resolved_date_to:
        raise HTTPException(status_code=422, detail="date_from must not be after date_to")
    if (resolved_date_to - resolved_date_from).days > MAX_DATE_RANGE_DAYS:
        raise HTTPException(
            status_code=422, detail=f"date range must not exceed {MAX_DATE_RANGE_DAYS} days"
        )

    if await session.scalar(select(Member.member_id).where(Member.member_id == member_id)) is None:
        raise HTTPException(status_code=404, detail="Member not found")

    # One aggregate over the attendance parent table; filtering on attendance_date
    # lets Postgres prune the monthly partitions.
    seconds = func.sum(func.extract("epoch", Attendance.time_out - Attendance.time_in))
    row = (
        await session.execute(
            select(
                func.count().label("visits"),
                func.count(func.distinct(Attendance.attendance_date)).label("days_attended"),
                func.coalesce(func.floor(seconds / 60), 0).label("total_minutes"),
                func.count().filter(Attendance.time_out.is_(None)).label("open_entries"),
            ).where(
                Attendance.member_id == member_id,
                Attendance.attendance_date >= resolved_date_from,
                Attendance.attendance_date <= resolved_date_to,
            )
        )
    ).one()
    return AttendanceSummary(
        member_id=member_id,
        date_from=resolved_date_from,
        date_to=resolved_date_to,
        visits=row.visits,
        days_attended=row.days_attended,
        total_minutes=int(row.total_minutes),
        open_entries=row.open_entries,
    )
