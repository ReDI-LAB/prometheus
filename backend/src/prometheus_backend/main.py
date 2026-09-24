import logging
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from prometheus_backend.database import get_session
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

    return app


app = create_app()
