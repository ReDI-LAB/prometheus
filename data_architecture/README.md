# Prometheus Redi — V3 backend handover

PostgreSQL 17+ schema for a new teaching/test database. This package describes the database contract for backend integration. It does not implement API endpoints or application authentication.

## Files

| File | Purpose |
| --- | --- |
| [prometheus_redi_schema_V3.sql](prometheus_redi_schema_V3.sql) | Complete database installer, including lookup data, constraints, triggers, views and deletion archives |
| [prometheus_redi_schema_tests_V3.sql](prometheus_redi_schema_tests_V3.sql) | 106 SQL regression checks; synthetic test changes are rolled back |
| [prometheus_redi_schema_V3.xlsx](prometheus_redi_schema_V3.xlsx) | Field specification for the core tables and the sectors lookup |
| [prometheus_redi_sector_UI.md](prometheus_redi_sector_UI.md) | Sector/postal-code queries and form integration rules |

## Local installation and verification

1. Using a database-owner account, create a new empty test database named `prometheus_redi`. Run `CREATE DATABASE prometheus_redi;` in autocommit mode, outside a transaction, only if the database does not already exist.
2. Connect to that database and confirm `SELECT current_database();` returns `prometheus_redi`.
3. Execute the entire `prometheus_redi_schema_V3.sql` with stop-on-error. In DBeaver, Alt+X executes the full script when no fragment is selected.
4. Execute the entire `prometheus_redi_schema_tests_V3.sql` in the same database. Expect 106 passed tests and `ALL TESTS PASSED`. Execution statistics alone do not establish success.

The installer is for a new, empty schema. It refuses to overwrite an existing installation. A migration is needed to upgrade a populated or previously installed database. Do not run the installer on application startup. If a script fails, stop and run `ROLLBACK;` before investigating.

The V3 schema content passed its 106 SQL checks and a direct Python write/read/rollback check on a separate PostgreSQL 17 database on 18 November 2026. Renaming the release to V3 did not change its business logic. These checks do not test the team's API or UI.

## Current UI integration scope

The planned UI creates records in `members`, `attendance`, `phone_calls` and `emergency_contacts`. It reads `clubhouses` for context and `staff` where a staff selection is required. Confirm endpoint ownership and permissions within the team.

Read member lists and current calculated status from `members_current`. Attendance totals and monthly summaries are calculated from attendance records; their reporting definitions must be agreed by the team.

Read lookup values as needed: `salutations`, `genders`, `countries`, `contact_relationships`, `caller_types`, `call_topics` and `sectors`. The SQL installer seeds the lookup data. Backend code reads these choices and saves selected codes; it does not recreate lookup rows for each form submission.

Financial tables `member_cash_transactions`, `clubhouse_cash_transactions` and `cashflow` remain in the schema for future functionality. Their presence does not add financial forms or endpoints to the current UI scope.

## Rules the backend must follow

- SQL generates member/staff codes and member status flags. Omit generated codes and derived member flags from writes. Read current member flags from `members_current`.
- `clubhouses.is_active` is Boolean and defaults to true. `members.is_member` is false through membership day 42 and true from day 43. `members.is_active` is NULL before the first visit, true through activity day 90 and false from day 91.
- `members.postal_code` is an optional string referencing `sectors.postal_code`. V3 contains 74 client-provided Munich postal codes. `members_current.sector` is derived from the postcode. Do not write a separate member sector. Use NULL for an omitted postcode; unknown values and empty strings are rejected. See the sector guide for dropdown queries.
- A new member needs a valid clubhouse, nonblank first and last names, date of birth and join date. Controlled personal-data redaction has separate SQL rules; ordinary form writes must not imitate it.
- `attendance` and `phone_calls` are monthly partitioned. Identify records by both ID and date when updating or deleting. Write to the parent tables rather than monthly children.
- Phone-call `duration_minutes` is a positive integer. `person_type` selects member or staff. Omit the generated `member_reference_id` and `staff_reference_id`; PostgreSQL enforces person existence through their foreign keys.
- SQL automatically writes deletion archives. The backend does not insert archive rows. Ordinary corrections use UPDATE; no previous-value or correction-author audit is implemented.
- Initial monthly partitions cover ten years back and two years ahead. The database owner can extend them with `public.ensure_monthly_partitions(from_date, through_date)`. No scheduler is configured. An insert into a missing month fails; maintenance needs an assigned owner.
- Installation/tests use the database owner. The application needs a separate restricted role with the required access to parent tables, lookup tables and views. Application role setup is a separate deployment task.

## Pending form decisions

- The client says one mobile number is sufficient, but the team has not resolved the disagreement. The schema retains one `members.phone` field.
- The client says ORI interviewer can be dropped, but this remains unresolved within the team. No ORI storage field is implemented.
- An optional, persisted attendance note is confirmed but deferred. V3 has no `attendance.note`; do not silently discard a note entered in the UI. Align the field's rollout with the next agreed database/backend change.
- Call-duration requirements and the final form variant still need agreement if the UI requires seconds or call start/end times rather than integer minutes.
