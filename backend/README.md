# Prometheus Backend

Python FastAPI backend for Project Prometheus.

## Running locally

### Prerequisites

- Python 3.12+
- Docker
- git

### Database

The schema script (version 4) lives on the `data_architecture` branch, not on this one. Fetch it and save it outside the repository:

```sh
git fetch origin
git show origin/data_architecture:data_architecture/prometheus_redi_schema_V4.sql > ~/prometheus_redi_schema_V4.sql
```

The backend needs a version 4 database: it reads columns of the `members_current` view (`landline_phone`, `ori_interviewer_id`) that only version 4 has, so member requests fail against a version 3 database.

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
cat ~/prometheus_redi_schema_V4.sql | docker exec -i prometheus-redi-db psql -U postgres -d prometheus_redi -v ON_ERROR_STOP=1
```

A successful run ends with the line `Prometheus Redi V4 installation complete`. Never run this script against a database that already has data in it — it only installs into a genuinely empty database. The backend itself never creates or changes tables; all schema changes come from this script.

#### Verify the installation (optional)

The `data_architecture` branch also contains two check files for the schema. Both verify an installation that already exists; never use them to install the schema. Each must run in full, against the `prometheus_redi` database:

- `prometheus_redi_healthcheck_V4.sql` is read-only: it runs in a read-only transaction and lists the key columns, table and partition counts, lookup values and reconciliation status.
- `prometheus_redi_schema_tests_V4.sql` runs 120 checks with synthetic rows inside a transaction that ends with `ROLLBACK`, so it leaves no data behind. If it fails, execute `ROLLBACK;` before trying again, and never rerun the installer.

```sh
git show origin/data_architecture:data_architecture/prometheus_redi_healthcheck_V4.sql | docker exec -i prometheus-redi-db psql -v ON_ERROR_STOP=1 -U postgres -d prometheus_redi
git show origin/data_architecture:data_architecture/prometheus_redi_schema_tests_V4.sql | docker exec -i prometheus-redi-db psql -v ON_ERROR_STOP=1 -U postgres -d prometheus_redi
```

#### Existing version 3 database

The installer only works on an empty database. For a database that already has version 3 installed, the `data_architecture` branch contains `prometheus_redi_upgrade_V3_to_V4.sql`. It runs only on an installed version 3 `prometheus_redi` database (PostgreSQL 17+, as the database owner) and refuses to run otherwise, for example when the version 4 columns already exist. It locks the `members`, `members_deleted`, `attendance`, `attendance_deleted` and `staff` tables while it runs, keeps the existing rows and values, and adds the new columns as empty (`NULL`). Run the entire file with `-v ON_ERROR_STOP=1`, as for the installer, and back up the database first.

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

To try the optional ORI interviewer of a member, also insert a staff person:

```sql
INSERT INTO public.staff (clubhouse_id, first_name, last_name, role)
SELECT clubhouse_id, 'Tom', 'Becker', 'staff'
FROM public.clubhouses
LIMIT 1;
```

Look up a `member_id` and a `staff_id` to use against the endpoints below:

```sql
SELECT member_id FROM public.members;
SELECT staff_id FROM public.staff;
```

Look up the valid `topic_code` values for phone calls:

```sql
SELECT code, label FROM public.call_topics ORDER BY sort_order;
```

Look up the valid postal codes for members. A member's `postal_code` must be one of these (for example `80333`, sector North) or empty:

```sql
SELECT postal_code, sector FROM public.sectors ORDER BY postal_code;
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
| POST   | `/api/v1/attendance`  | Log a member's attendance (time in, optional time out and note) |
| GET    | `/api/v1/attendance`  | List attendance entries, filterable by member and date range |
| GET    | `/api/v1/attendance/summary` | Attendance counters for one member (`visits`, `days_attended`, `total_minutes`, `open_entries`) for a month or date range |
| POST   | `/api/v1/members`     | Create a member, optionally with one emergency contact |
| GET    | `/api/v1/members`     | List members for a selector, with search, `is_active` filter and paging |
| GET    | `/api/v1/lookups`     | All lookup lists (salutations, genders, countries, contact relationships, caller types, call topics, sectors) |
| GET    | `/api/v1/clubhouses`  | List clubhouses, ordered by name |
| GET    | `/api/v1/staff`       | List staff (names, role, clubhouse, status), filterable by clubhouse and status, with paging |

`GET /api/v1/attendance/summary` needs `member_id` and takes either `month` (`YYYY-MM`) or `date_from` and/or `date_to`; combining `month` with a date is `422`. Without any of them it uses the current calendar month of the server's date. The date window rules are the same as for the attendance list (at most 366 days, `date_from` not after `date_to`), and an unknown member returns `404`. The counters are:

- `visits`: the number of attendance entries in the window.
- `days_attended`: the number of distinct days with at least one entry.
- `total_minutes`: the total of `time_out` minus `time_in` over the entries that have a `time_out`, in whole minutes (rounded down once at the end), or `0`.
- `open_entries`: the entries without a `time_out`; they are not counted in `total_minutes`.

The `code` values returned by `GET /api/v1/lookups` are the values the create endpoints expect: `salutation`, `gender`, `country` and the emergency contact `relationship` for `POST /api/v1/members`, and `person_type` and `topic_code` (an integer) for `POST /api/v1/phone-calls`. The code/label lists are ordered by `sort_order`. The `sectors` list has a different shape (`postal_code`, `sector`, `city`, `country`) and is ordered by `postal_code`; its `postal_code` values are the ones `POST /api/v1/members` accepts. `GET /api/v1/staff` never includes email or other contact details and omits anonymized people; `staff_status` is matched exactly.

`POST /api/v1/attendance` takes `member_id`, `attendance_date` and `time_in` (required) and the optional `time_out` and `note`. The `note` is trimmed, a blank note is saved as `null`, and it may be at most 500 characters; this is a backend limit, the database itself has none. A note for an anonymized member is rejected with `422`. Unknown fields are rejected with `422`. The response and `GET /api/v1/attendance` include the `note`.

`POST /api/v1/members` takes `first_name`, `last_name`, `date_of_birth` and `join_date` (required) and the optional `salutation`, `gender`, `phone`, `landline_phone`, `ori_interviewer_id`, `email`, `street_address`, `postal_code`, `city`, `country` and `clubhouse_id`. `phone` is the mobile number and `landline_phone` the landline number; both are trimmed, a blank value is saved as `null`, and each may be at most 50 characters, a backend limit (the database has none). `ori_interviewer_id` is the `staff_id` of the staff person who conducted the ORI closing interview, taken from `GET /api/v1/staff`; an id that doesn't exist is rejected with `422` "Unknown ori_interviewer_id", and a value that is not a UUID with `422`. An optional `emergency_contact` object (`name`, `phone`, optional `relationship`) is stored in the same transaction, so a failure rolls back the member too. `salutation`, `gender`, `country` and `relationship` are lookup codes that the database validates. `postal_code` must be one of the Munich postal codes in the `sectors` list (for example `80333`), or empty or omitted; any other value is rejected with `422` "Unknown postal_code". If `clubhouse_id` is omitted, the only existing clubhouse is used (`409` if none exists, `422` if there are several). Unknown fields are rejected with `422`. The response is `201` with the member as in the list below, including the generated `member_code`; `member_code`, `is_member` and `is_active` are set by the database and cannot be sent. The phone numbers and `ori_interviewer_id` are stored but not returned in the member response or list.

`GET /api/v1/members` reads the `members_current` view. `search` (up to 100 characters) matches every word, case-insensitively, against first name, last name or member code; by default only current members are returned (`include_left=true` also includes members who have left, never anonymized ones), and `is_active` (`true` or `false`) filters by activity.

Each member item contains `member_id`, `member_code`, `first_name`, `last_name`, `is_member`, `is_active` and `sector`:

- `sector` (`North`, `South`, `East` or `West`) is derived by the database from the member's postal code, and is `null` when the member has none.
- `is_member` is `false` for newcomers and `true` from day 43 after the join date.
- `is_active` is `true` up to 90 days after the last visit and `false` afterwards. It is `null` until the member's first visit, which the frontend should treat as unknown. Members with a `null` value match neither `is_active=true` nor `is_active=false`, so a member selector should not filter on `is_active`.

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
  "time_out": "14:00:00",
  "note": "Helped in the kitchen"
}
```

Notes:

- There is no authentication yet.
- The `GET` date filters default to the last 90 days and are limited to a 366-day range.
- `person_id` on `/api/v1/phone-calls` requires `person_type` to be given as well.
- A successful attendance entry updates the member's `is_active` value in the database.

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
