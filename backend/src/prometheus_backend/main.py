from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from prometheus_backend.settings import Settings


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

    return app


app = create_app()
