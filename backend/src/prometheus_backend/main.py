import logging
from typing import Annotated

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from prometheus_backend.database import get_session
from prometheus_backend.settings import Settings

logger = logging.getLogger(__name__)

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# Reused by the paginated list endpoints once the new schema's models land.
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200


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

    return app


app = create_app()
