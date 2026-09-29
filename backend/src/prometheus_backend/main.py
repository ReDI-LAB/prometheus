import logging
import uuid
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from prometheus_backend.database import get_session
from prometheus_backend.models import Anwesenheitseintraege, Mitglieder, Notfallkontakte, Telefonate
from prometheus_backend.schemas import (
    AnwesenheitPage,
    AnwesenheitRead,
    MitgliedCreate,
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

    async def handle_database_error(request: Request, exc: Exception) -> JSONResponse:
        # DBAPIError covers errors raised on an established connection (bad
        # query, auth rejected by the driver, etc). OSError covers failures
        # while establishing the connection itself (host unreachable,
        # connection refused) — SQLAlchemy does not wrap those in a
        # DBAPIError since no DBAPI connection exists yet to attribute the
        # error to. Together they cover DB connectivity failures without
        # catching unrelated application errors.
        origin = exc.orig if isinstance(exc, DBAPIError) else exc
        logger.error("Database error: %s: %s", type(origin).__name__, origin)
        return JSONResponse(status_code=503, content={"detail": "Database connection failed"})

    app.add_exception_handler(DBAPIError, handle_database_error)
    app.add_exception_handler(OSError, handle_database_error)

    @app.get("/api/v1/health", tags=["health"])
    async def read_health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/v1/db-health", tags=["health"])
    async def read_db_health(session: SessionDep) -> dict[str, str]:
        await session.execute(text("SELECT 1"))
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

    @app.post("/api/v1/members", tags=["members"], status_code=201)
    async def create_member(payload: MitgliedCreate, session: SessionDep) -> MitgliedRead:
        member = Mitglieder(**payload.model_dump())
        session.add(member)
        try:
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            if "mitgliedscode" in str(exc.orig).lower():
                raise HTTPException(
                    status_code=409, detail="A member with this mitgliedscode already exists"
                ) from None
            raise HTTPException(status_code=409, detail="Member could not be created") from None
        await session.refresh(member)
        return MitgliedRead.model_validate(member)

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
