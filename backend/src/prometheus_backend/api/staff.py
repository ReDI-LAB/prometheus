import uuid
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from prometheus_backend.database import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SessionDep
from prometheus_backend.models import Staff
from prometheus_backend.schemas import StaffPage, StaffSummary

router = APIRouter(prefix="/api/v1/staff", tags=["staff"])


@router.get("", summary="List staff")
async def list_staff(
    session: SessionDep,
    clubhouse_id: uuid.UUID | None = None,
    staff_status: Annotated[
        str | None, Query(description="Exact staff status code; the database owns the values.")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> StaffPage:
    """Staff names, role, clubhouse and status. Anonymized people are never listed and
    contact details such as email are never included."""
    filters = [Staff.anonymized_at.is_(None)]
    if clubhouse_id is not None:
        filters.append(Staff.clubhouse_id == clubhouse_id)
    if staff_status is not None:
        filters.append(Staff.staff_status == staff_status)

    total = await session.scalar(select(func.count()).select_from(Staff).where(*filters))
    result = await session.scalars(
        select(Staff)
        .where(*filters)
        .order_by(
            Staff.last_name.asc().nulls_last(),
            Staff.first_name.asc().nulls_last(),
            Staff.staff_id,
        )
        .limit(limit)
        .offset(offset)
    )
    return StaffPage(
        items=[StaffSummary.model_validate(person) for person in result.all()],
        total=total or 0,
        limit=limit,
        offset=offset,
    )
