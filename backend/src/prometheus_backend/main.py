import logging
import uuid
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from prometheus_backend.database import get_session
from prometheus_backend.models import Anwesenheitseintraege, Mitglieder, Notfallkontakte, Telefonate
from prometheus_backend.schemas import (
    AnwesenheitPage,
    AnwesenheitRead,
    MitgliederPage,
    MitgliedRead,
    NotfallkontaktRead,
    TelefonatPage,
    TelefonatRead,
)
from prometheus_backend.settings import Settings

logger = logging.getLogger(__name__)

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or Settings()
    app = FastAPI(title=app_settings.app_name)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.allowed_frontend_origins,
        allow_credentials=False,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["Accept", "Content-Type"],
    )

    @app.get("/api/v1/health", tags=["health"])
    async def read_health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/v1/db-health", tags=["health"])
    async def read_db_health(session: SessionDep) -> dict[str, str]:
        try:
            await session.execute(text("SELECT 1"))
        except Exception:
            logger.exception("Database health check failed")
            raise HTTPException(status_code=503, detail="Database connection failed") from None
        return {"status": "ok"}

    @app.get("/api/v1/members", tags=["members"])
    async def list_members(
        session: SessionDep,
        limit: Annotated[int, Query(ge=1, le=200)] = 50,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> MitgliederPage:
        total = await session.scalar(select(func.count()).select_from(Mitglieder))
        result = await session.scalars(
            select(Mitglieder)
            .order_by(Mitglieder.nachname, Mitglieder.vorname)
            .limit(limit)
            .offset(offset)
        )
        members = result.all()
        return MitgliederPage(
            items=[MitgliedRead.model_validate(member) for member in members],
            total=total or 0,
            limit=limit,
            offset=offset,
        )

    @app.get("/api/v1/members/{mitglied_id}", tags=["members"])
    async def read_member(mitglied_id: uuid.UUID, session: SessionDep) -> MitgliedRead:
        member = await session.get(Mitglieder, mitglied_id)
        if member is None:
            raise HTTPException(status_code=404, detail="Member not found")
        return MitgliedRead.model_validate(member)

    @app.get("/api/v1/members/{mitglied_id}/attendance", tags=["members"])
    async def list_member_attendance(
        mitglied_id: uuid.UUID,
        session: SessionDep,
        limit: Annotated[int, Query(ge=1, le=200)] = 50,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> AnwesenheitPage:
        if await session.get(Mitglieder, mitglied_id) is None:
            raise HTTPException(status_code=404, detail="Member not found")

        total = await session.scalar(
            select(func.count())
            .select_from(Anwesenheitseintraege)
            .where(Anwesenheitseintraege.mitglied_id == mitglied_id)
        )
        result = await session.scalars(
            select(Anwesenheitseintraege)
            .where(Anwesenheitseintraege.mitglied_id == mitglied_id)
            .order_by(Anwesenheitseintraege.anwesenheitsdatum.desc())
            .limit(limit)
            .offset(offset)
        )
        entries = result.all()
        return AnwesenheitPage(
            items=[AnwesenheitRead.model_validate(entry) for entry in entries],
            total=total or 0,
            limit=limit,
            offset=offset,
        )

    @app.get("/api/v1/members/{mitglied_id}/emergency-contacts", tags=["members"])
    async def list_member_emergency_contacts(
        mitglied_id: uuid.UUID, session: SessionDep
    ) -> list[NotfallkontaktRead]:
        if await session.get(Mitglieder, mitglied_id) is None:
            raise HTTPException(status_code=404, detail="Member not found")

        result = await session.scalars(
            select(Notfallkontakte).where(Notfallkontakte.mitglied_id == mitglied_id)
        )
        return [NotfallkontaktRead.model_validate(contact) for contact in result.all()]

    @app.get("/api/v1/members/{mitglied_id}/calls", tags=["members"])
    async def list_member_calls(
        mitglied_id: uuid.UUID,
        session: SessionDep,
        limit: Annotated[int, Query(ge=1, le=200)] = 50,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> TelefonatPage:
        if await session.get(Mitglieder, mitglied_id) is None:
            raise HTTPException(status_code=404, detail="Member not found")

        total = await session.scalar(
            select(func.count())
            .select_from(Telefonate)
            .where(Telefonate.mitglied_id == mitglied_id)
        )
        result = await session.scalars(
            select(Telefonate)
            .where(Telefonate.mitglied_id == mitglied_id)
            .order_by(Telefonate.telefonat_datum.desc())
            .limit(limit)
            .offset(offset)
        )
        calls = result.all()
        return TelefonatPage(
            items=[TelefonatRead.model_validate(call) for call in calls],
            total=total or 0,
            limit=limit,
            offset=offset,
        )

    return app


app = create_app()
