from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from prometheus_backend.database import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SessionDep
from prometheus_backend.schemas import MemberPage, MemberSummary
from prometheus_backend.views import MemberCurrent

router = APIRouter(prefix="/api/v1/members", tags=["members"])

MAX_SEARCH_LENGTH = 100
LIKE_ESCAPE = "\\"


def _escape_like(value: str) -> str:
    # Escape the escape character first, then the LIKE wildcards.
    return (
        value.replace(LIKE_ESCAPE, LIKE_ESCAPE * 2)
        .replace("%", f"{LIKE_ESCAPE}%")
        .replace("_", f"{LIKE_ESCAPE}_")
    )


@router.get("")
async def list_members(
    session: SessionDep,
    search: Annotated[str | None, Query(max_length=MAX_SEARCH_LENGTH)] = None,
    activity_status: str | None = None,
    include_left: bool = False,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MemberPage:
    # Anonymized members are never listed; members who left only on request.
    if include_left:
        filters = [MemberCurrent.anonymized_at.is_(None)]
    else:
        filters = [MemberCurrent.is_current.is_(True)]

    if activity_status is not None:
        filters.append(MemberCurrent.activity_status == activity_status)

    # Every word must match at least one of name or member code.
    for word in (search or "").split():
        pattern = f"%{_escape_like(word)}%"
        filters.append(
            or_(
                MemberCurrent.first_name.ilike(pattern, escape=LIKE_ESCAPE),
                MemberCurrent.last_name.ilike(pattern, escape=LIKE_ESCAPE),
                MemberCurrent.member_code.ilike(pattern, escape=LIKE_ESCAPE),
            )
        )

    total = await session.scalar(select(func.count()).select_from(MemberCurrent).where(*filters))
    result = await session.scalars(
        select(MemberCurrent)
        .where(*filters)
        .order_by(
            MemberCurrent.last_name.asc().nulls_last(),
            MemberCurrent.first_name.asc().nulls_last(),
            MemberCurrent.member_id,
        )
        .limit(limit)
        .offset(offset)
    )
    members = result.all()
    return MemberPage(
        items=[MemberSummary.model_validate(member) for member in members],
        total=total or 0,
        limit=limit,
        offset=offset,
    )
