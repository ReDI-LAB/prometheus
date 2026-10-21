# Prometheus Backend

Python FastAPI backend for Project Prometheus.

## Running locally

### Prerequisites

- Python 3.12+
- Docker
- git

### Database

The schema script lives on the `data_architecture` branch, not on this one. Fetch it and save it outside the repository (or somewhere git-ignored):

```sh
git show origin/data_architecture:data_architecture/prometheus-redi-schema.sql > prometheus-redi-schema.sql
```

Start a PostgreSQL 17 container for it. The script itself requires an empty database named exactly `prometheus_redi` on PostgreSQL 17+, and refuses to run otherwise:

```sh
docker run -d --name prometheus-redi-db \
  -e POSTGRES_DB=prometheus_redi \
  -e POSTGRES_PASSWORD=devpass \
  -p 5434:5432 \
  postgres:17
```

These credentials (user `postgres`, password `devpass`) are for local development only.

Wait until the container is ready, then run the script against it:

```sh
until docker exec prometheus-redi-db pg_isready -U postgres; do sleep 1; done
cat prometheus-redi-schema.sql | docker exec -i prometheus-redi-db psql -U postgres -d prometheus_redi -v ON_ERROR_STOP=1
```

A successful run ends with the line `Redi installation complete`. Never run this script against a database that already has data in it — it only installs into a genuinely empty database. The backend itself never creates or changes tables; all schema changes come from this script.

### Test data

The `clubhouses` table is empty right after installation, so insert one before creating a member:

```sql
INSERT INTO public.clubhouses (name, timezone, country, primary_language)
VALUES ('Test Clubhouse', 'Europe/Berlin', 'DE', 'de')
RETURNING clubhouse_id;

INSERT INTO public.members (clubhouse_id, first_name, last_name, date_of_birth, join_date)
VALUES ('<clubhouse_id from above>', 'Jasmin', 'Mueller', '1990-05-01', '2026-01-01')
RETURNING member_id;
```

Look up a `member_id` to use against the endpoints below:

```sql
SELECT member_id FROM public.members;
```

Look up the valid `topic_code` values for phone calls:

```sql
SELECT code, label FROM public.call_topics ORDER BY sort_order;
```

### Configuration

Copy the example file for local development:

```sh
cp .env.example .env
```

Set `PROMETHEUS_DATABASE_URL` to match the container above:

```
PROMETHEUS_DATABASE_URL="postgresql+asyncpg://postgres:devpass@localhost:5434/prometheus_redi"
```

`.env` is never committed.

Configured frontend origins are allowed for browser requests. CORS is not authentication.

### Start the server

From the repository root:

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
uvicorn prometheus_backend.main:app --reload --host 127.0.0.1 --port 8000
```

`.env` is read from the current directory, so run `uvicorn` from `backend/`.

Local URLs:

- Swagger UI: `http://127.0.0.1:8000/docs`
- Health endpoint: `http://127.0.0.1:8000/api/v1/health`
- Database health endpoint: `http://127.0.0.1:8000/api/v1/db-health`

### Endpoints available now

| Method | Path                 | Description                                              |
| ------ | -------------------- | --------------------------------------------------------- |
| POST   | `/api/v1/phone-calls` | Log a phone call for a member or a staff person            |
| GET    | `/api/v1/phone-calls` | List phone calls, filterable by person and date range       |
| POST   | `/api/v1/attendance`  | Log a member's attendance (time in, optional time out)      |
| GET    | `/api/v1/attendance`  | List attendance entries, filterable by member and date range |

Main status codes: `201` on successful creation, `422` for invalid or unknown data (bad values, a foreign key that doesn't exist), `503` when the database is unavailable or a monthly partition is missing for the given date.

### Troubleshooting

- `Field required: database_url` — `.env` is missing or not being read; copy `.env.example` to `.env` inside `backend/` and set `PROMETHEUS_DATABASE_URL`.
- Port 8000 already in use — stop whatever is using it, or start `uvicorn` with a different `--port`.
- Connection refused on port 5434 — the `prometheus-redi-db` container is not running; start it as shown above.
- The SQL script refuses to run — the target database isn't named `prometheus_redi`, isn't PostgreSQL 17+, or already has objects in it.
- 503 on every request — the backend is reachable but the database isn't; check the container is running and `PROMETHEUS_DATABASE_URL` matches its host, port, and credentials.

### Checks

```sh
ruff check .
ruff format --check .
```

The backend exposes API endpoints for the React frontend. It does not connect to PostgreSQL directly from browser code.
