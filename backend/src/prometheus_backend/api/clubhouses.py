from fastapi import APIRouter
from sqlalchemy import select

from prometheus_backend.database import SessionDep
from prometheus_backend.models import Clubhouse
from prometheus_backend.schemas import ClubhouseRead

router = APIRouter(prefix="/api/v1/clubhouses", tags=["clubhouses"])


@router.get("", summary="List clubhouses")
async def list_clubhouses(session: SessionDep) -> list[ClubhouseRead]:
    """All clubhouses ordered by name. The table is small, so it is not paginated."""
    result = await session.scalars(select(Clubhouse).order_by(Clubhouse.name))
    return [ClubhouseRead.model_validate(clubhouse) for clubhouse in result.all()]
