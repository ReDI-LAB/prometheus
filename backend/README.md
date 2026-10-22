# Prometheus Backend

Python FastAPI backend for Project Prometheus.

## Running locally

### Prerequisites

- Python 3.12+
- Docker
- git

### Database

The schema script lives on the `data_architecture` branch, not on this one. Fetch it and save it outside the repository:

```sh
git fetch origin
git show origin/data_architecture:data_architecture/prometheus-redi-schema.sql > ~/prometheus-redi-schema.sql
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

Wait until the container is ready, then run the script against it. The readiness check goes over TCP because the server restarts once during its first start, which a plain `pg_isready` can miss:

```sh
until docker exec prometheus-redi-db pg_isready -h 127.0.0.1 -U postgres -d prometheus_redi; do sleep 1; done
cat ~/prometheus-redi-schema.sql | docker exec -i prometheus-redi-db psql -U postgres -d prometheus_redi -v ON_ERROR_STOP=1
```

A successful run ends with the line `Redi installation complete`. Never run this script against a database that already has data in it — it only installs into a genuinely empty database. The backend itself never creates or changes tables; all schema changes come from this script.

### Test data

The `clubhouses` table is empty right after installation, so insert one before creating a member. Open an interactive `psql` session against the container:

```sh
docker exec -it prometheus-redi-db psql -U postgres -d prometheus_redi
```

Then insert a clubhouse and a member, using a subquery so the member picks up the clubhouse's id without copy-pasting it:

```sql
INSERT INTO public.clubhouses (name, timezone, country, primary_language)
VALUES ('Test Clubhouse', 'Europe/Berlin', 'DE', 'de');

INSERT INTO public.members (clubhouse_id, first_name, last_name, date_of_birth, join_date)
SELECT clubhouse_id, 'Jasmin', 'Mueller', '1990-05-01', '2026-01-01'
FROM public.clubhouses
LIMIT 1;
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
cd backend
cp .env.example .env
```

The placeholder `PROMETHEUS_DATABASE_URL` in `.env.example` will not work as-is; set it in `.env` to match the container above:

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

On Windows, activate the virtual environment with `.venv\Scripts\activate` instead.

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

### Try it

Open the Swagger UI, expand `POST /api/v1/phone-calls` or `POST /api/v1/attendance`, click "Try it out", paste one of the bodies below (replacing `<member_id>`/`<topic_code>` with real values from the Test data section), and execute:

```json
{
  "person_id": "<member_id>",
  "person_type": "member",
  "call_date": "2026-01-15",
  "duration_minutes": 10,
  "topic_code": "<topic_code>"
}
```

```json
{
  "member_id": "<member_id>",
  "attendance_date": "2026-01-15",
  "time_in": "09:00:00",
  "time_out": "14:00:00"
}
```

Notes:

- There is no authentication yet.
- The `GET` date filters default to the last 90 days and are limited to a 366-day range.
- `person_id` on `/api/v1/phone-calls` requires `person_type` to be given as well.
- A successful attendance entry changes the member's activity status in the database.

### Troubleshooting

- `Field required: database_url` — `.env` is missing or not being read; copy `.env.example` to `.env` inside `backend/` and set `PROMETHEUS_DATABASE_URL`.
- Port 8000 already in use — stop whatever is using it, or start `uvicorn` with a different `--port`.
- Connection refused on port 5434 — the `prometheus-redi-db` container is not running; start it as shown above.
- The SQL script refuses to run — the target database isn't named `prometheus_redi`, isn't PostgreSQL 17+, or already has objects in it.
- 503 on every request — the backend is reachable but the database isn't; check the container is running and `PROMETHEUS_DATABASE_URL` matches its host, port, and credentials.

### Docker

The `Dockerfile` builds a production-style image of the backend. Build it from the repository root:

```sh
docker build -t prometheus-backend backend
```

Run it against a database, passing the connection string as an environment variable. The server listens on the port given by `PORT` (default `8000`); a hosting platform usually provides it:

```sh
docker run --rm -p 8000:8000 \
  -e PROMETHEUS_DATABASE_URL="postgresql+asyncpg://postgres:devpass@host.docker.internal:5434/prometheus_redi" \
  prometheus-backend
```

To use a different port, set `PORT` and publish the same one, for example `-e PORT=10000 -p 10000:10000`.

`host.docker.internal` resolves to the host machine on Docker Desktop. On Linux, add `--add-host=host.docker.internal:host-gateway` to the `docker run` command. If the database runs in another container, put both on the same Docker network and use the container name as the host instead.

The image never contains `.env`; `.dockerignore` excludes it. Credentials are passed only as environment variables at run time. Without `PROMETHEUS_DATABASE_URL` the container stops with a missing-setting error.

### Checks

```sh
ruff check .
ruff format --check .
```

The backend exposes API endpoints for the React frontend. It does not connect to PostgreSQL directly from browser code.
