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

## Run Locally

```sh
uvicorn prometheus_backend.main:app --reload --host 127.0.0.1 --port 8000
```

## Checks

```sh
python -m pytest
ruff check .
ruff format --check .
```

The backend exposes API endpoints for the React frontend. It does not connect to PostgreSQL directly from browser code.
