from fastapi import APIRouter
from sqlalchemy import select

from prometheus_backend.database import SessionDep
from prometheus_backend.models import (
    CallerType,
    CallTopic,
    ContactRelationship,
    Country,
    Gender,
    Salutation,
    Sector,
)
from prometheus_backend.schemas import CallTopicItem, LookupItem, LookupsRead, SectorItem

router = APIRouter(prefix="/api/v1/lookups", tags=["lookups"])


@router.get("", summary="List all lookup values")
async def list_lookups(session: SessionDep) -> LookupsRead:
    """The codes used by the create endpoints (salutation, gender, country, relationship,
    person_type, topic_code) and the postal codes with their sectors. The lists are small,
    so they are not paginated."""

    async def load(model: type) -> list:
        result = await session.scalars(select(model).order_by(model.sort_order, model.code))
        return result.all()

    sectors = await session.scalars(select(Sector).order_by(Sector.postal_code))

    return LookupsRead(
        salutations=[LookupItem.model_validate(row) for row in await load(Salutation)],
        genders=[LookupItem.model_validate(row) for row in await load(Gender)],
        countries=[LookupItem.model_validate(row) for row in await load(Country)],
        contact_relationships=[
            LookupItem.model_validate(row) for row in await load(ContactRelationship)
        ],
        caller_types=[LookupItem.model_validate(row) for row in await load(CallerType)],
        call_topics=[CallTopicItem.model_validate(row) for row in await load(CallTopic)],
        sectors=[SectorItem.model_validate(row) for row in sectors.all()],
    )
