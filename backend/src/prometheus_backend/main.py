from fastapi import FastAPI

app = FastAPI(title="Prometheus Backend")


@app.get("/api/v1/health", tags=["health"])
async def read_health() -> dict[str, str]:
    return {"status": "ok"}
