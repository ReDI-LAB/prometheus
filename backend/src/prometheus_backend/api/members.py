import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from prometheus_backend.database import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SessionDep
from prometheus_backend.models import Clubhouse, EmergencyContact, Member
from prometheus_backend.schemas import MemberCreate, MemberPage, MemberSummary
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


FOREIGN_KEY_VIOLATION = "23503"
UNIQUE_VIOLATION = "23505"
CHECK_VIOLATION = "23514"

_FOREIGN_KEY_MESSAGES = {
    "fk_members_clubhouse_id": "Unknown clubhouse_id",
    "fk_members_salutation": "Unknown salutation",
    "fk_members_gender": "Unknown gender",
    "fk_members_country": "Unknown country",
    "fk_members_postal_code": "Unknown postal_code",
    "fk_emergency_contacts_relationship": "Unknown emergency_contact.relationship",
}


def _map_integrity_error(exc: IntegrityError) -> tuple[int, str]:
    # exc.orig is SQLAlchemy's asyncpg DBAPI wrapper; the actual asyncpg
    # exception carrying sqlstate/constraint_name is its __cause__.
    asyncpg_error = exc.orig.__cause__
    sqlstate = getattr(asyncpg_error, "sqlstate", None)
    constraint_name = getattr(asyncpg_error, "constraint_name", None)

    if sqlstate == FOREIGN_KEY_VIOLATION:
        # The member trigger raises this without a constraint name when the
        # clubhouse does not exist, before the foreign key itself is checked.
        if constraint_name is None:
            return 422, "Unknown clubhouse_id"
        return 422, _FOREIGN_KEY_MESSAGES.get(constraint_name, "Invalid reference")
    if sqlstate == UNIQUE_VIOLATION:
        return 409, "Member already exists"
    if sqlstate == CHECK_VIOLATION and constraint_name is None:
        # Raised by the member triggers: the only one reachable without
        # sending generated columns is the member code generation, which
        # needs first and last names with transliterable letters.
        return 422, "first_name and last_name must contain letters"
    return 422, "Invalid member data"


async def _resolve_clubhouse_id(session: SessionDep, clubhouse_id: uuid.UUID | None) -> uuid.UUID:
    if clubhouse_id is not None:
        return clubhouse_id
    result = await session.scalars(select(Clubhouse.clubhouse_id).limit(2))
    clubhouse_ids = result.all()
    if not clubhouse_ids:
        raise HTTPException(status_code=409, detail="No clubhouse is configured")
    if len(clubhouse_ids) > 1:
        raise HTTPException(
            status_code=422, detail="clubhouse_id is required when several clubhouses exist"
        )
    return clubhouse_ids[0]


@router.post("", status_code=201)
async def create_member(payload: MemberCreate, session: SessionDep) -> MemberSummary:
    clubhouse_id = await _resolve_clubhouse_id(session, payload.clubhouse_id)
    # member_code, is_member, is_active and the timestamps are database-managed
    # and never sent; the member triggers generate them on INSERT.
    member = Member(
        clubhouse_id=clubhouse_id,
        **payload.model_dump(exclude={"clubhouse_id", "emergency_contact"}),
    )
    session.add(member)
    try:
        # One transaction: a failure on the emergency contact rolls the member back too.
        await session.flush()
        if payload.emergency_contact is not None:
            contact = payload.emergency_contact
            session.add(
                EmergencyContact(
                    member_id=member.member_id,
                    name=contact.name,
                    phone=contact.phone,
                    relationship_=contact.relationship,
                )
            )
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        status_code, detail = _map_integrity_error(exc)
        raise HTTPException(status_code=status_code, detail=detail) from None
    created = await session.scalar(
        select(MemberCurrent).where(MemberCurrent.member_id == member.member_id)
    )
    return MemberSummary.model_validate(created)


@router.get("")
async def list_members(
    session: SessionDep,
    search: Annotated[str | None, Query(max_length=MAX_SEARCH_LENGTH)] = None,
    is_active: Annotated[
        bool | None,
        Query(description="Filter on is_active. Omit to include members with no visit yet."),
    ] = None,
    include_left: bool = False,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MemberPage:
    # Anonymized members are never listed; members who left only on request.
    if include_left:
        filters = [MemberCurrent.anonymized_at.is_(None)]
    else:
        filters = [MemberCurrent.is_current.is_(True)]

    if is_active is not None:
        filters.append(MemberCurrent.is_active.is_(is_active))

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
