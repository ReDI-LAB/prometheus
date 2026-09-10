# Prometheus Backend

Python FastAPI backend for Project Prometheus.

## Setup

From the repository root:

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
```

## Environment

Copy the example file for local development:

```sh
cp .env.example .env
```

Configured frontend origins are allowed for browser requests. CORS is not authentication.

## Run Locally

```sh
uvicorn prometheus_backend.main:app --reload --host 127.0.0.1 --port 8000
```

Local URLs:

- Health endpoint: `http://127.0.0.1:8000/api/v1/health`
- Swagger UI: `http://127.0.0.1:8000/docs`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

## Checks

```sh
python -m pytest
ruff check .
ruff format --check .
```

The backend exposes API endpoints for the React frontend. It does not connect to PostgreSQL directly from browser code.
