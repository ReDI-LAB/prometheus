# Prometheus Redi — Version 4

PostgreSQL 17+ schema for a new teaching/test database, based on the client's Redi model. These files contain schema definitions and synthetic tests, not real member records or a database dump.

## Current files

| File | Purpose |
| --- | --- |
| [prometheus_redi_schema_V4.sql](prometheus_redi_schema_V4.sql) | Complete installer for a new, empty database |
| [prometheus_redi_upgrade_V3_to_V4.sql](prometheus_redi_upgrade_V3_to_V4.sql) | Upgrade an installed V3 database while preserving its rows |
| [V4 changes and backend mapping](prometheus_redi_changes_V4_EN.md) | Confirmed decisions, field mapping and remaining application work |
| [prometheus_redi_schema_V4.xlsx](prometheus_redi_schema_V4.xlsx) | Complete current core Excel specification, including all 15 lookup dictionaries and V4 optional form fields |
| [prometheus_redi_schema_tests_V4.sql](prometheus_redi_schema_tests_V4.sql) | 120 regression checks, with test changes rolled back |
| [prometheus_redi_healthcheck_V4.sql](prometheus_redi_healthcheck_V4.sql) | Read-only database checks |
| [check_redi_from_python.py](check_redi_from_python.py) | Direct Python-to-PostgreSQL check |
| [Backend core diagram](prometheus_redi_core_V4_EN.mmd) | Nine core tables for backend planning |
| [Combined diagram](prometheus_redi_merged_V4.mmd) | Core, lookup and deletion-history tables |
| [SQL implementation diagram](prometheus_redi_sql_V4.mmd) | All 36 logical public tables |
| [Interactive diagram viewer](prometheus_redi_diagram_V4.html) | Open locally in a browser; rendering requires internet access |

The two authoritative implementation files are `prometheus_redi_schema_V4.sql` and `prometheus_redi_schema_V4.xlsx`. All agreed schema changes are consolidated in these files. The installer includes the complete Version 4 schema. V4 also includes a guarded V3-to-V4 upgrade because the backend has already installed V3. Older client-provided documents remain reference material; use the Version 4 SQL and Excel files for the current implementation.

Confirmed V4 decisions are recorded in [review and changes](prometheus_redi_changes_V4_EN.md). The optional attendance note, optional landline and optional ORI interviewer are now implemented. The Munich-only postcode policy is retained by Natalia's decision of 25 November 2026. Remaining items are listed in [decision status](prometheus_redi_pending_changes.md).

## Install and check

Use PostgreSQL 17 or later and a database-owner account for installation and teaching tests.

1. If the test database does not exist, run [00-create-prometheus-redi.sql](00-create-prometheus-redi.sql) in autocommit mode. It creates `prometheus_redi`.
2. Open an SQL editor connected to that database. Confirm with `SELECT current_database();`.
3. Run the entire `prometheus_redi_schema_V4.sql` installer with stop-on-error.
4. Run the entire `prometheus_redi_schema_tests_V4.sql`. Look for **120** passed tests and `ALL TESTS PASSED`. Execution statistics alone do not confirm success.
5. Run `prometheus_redi_healthcheck_V4.sql` for a read-only check.

In DBeaver, **Alt+X** executes the whole file when no fragment is selected. If a script fails, stop and run `ROLLBACK;` before investigating.

The installer is for a **new, empty schema** and refuses to overwrite an installed schema. Do not run it at application startup. Saving these files does not update an existing database; for an installed V3 database, use `prometheus_redi_upgrade_V3_to_V4.sql` once, then the V4 tests. The upgrade adds nullable fields without rewriting existing phone values. Review and back up an existing database before applying it during a write pause.

## Backend tables and SQL responsibilities

The nine core tables are `clubhouses`, `members`, `staff`, `attendance`, `emergency_contacts`, `phone_calls`, `member_cash_transactions`, `clubhouse_cash_transactions` and `cashflow`.

SQL installs the tables, lookup values, constraints, functions, triggers, views and deletion archives. Backend models must match this schema. The backend reads lookup values as needed and writes application records to the core parent tables. It does not manually create lookup data or insert deletion-history records. `staff_clubhouses`, `translations`, `lookup_labels` and `accounts` are absent. Each staff member has one current clubhouse.

SQL generates person codes and calculated member flags. Omit generated codes, `phone_calls.member_reference_id`, `phone_calls.staff_reference_id` and `clubhouse_cash_transactions.month` from INSERT/UPDATE. Read current member status from `members_current`. Do not manually write derived member flags.

| Field | Meaning |
| --- | --- |
| `clubhouses.is_active` | Required Boolean, defaults to `true` |
| `members.is_member` | `false` during observation through membership day 42; `true` from day 43 |
| `members.is_active` | `NULL` before the first visit; `true` through activity day 90; `false` from day 91 |

The three former status lookup tables remain as legacy references; Boolean fields no longer reference them. Phone-call references are enforced by generated member/staff columns and real foreign keys according to `person_type`.

## Member sector

The client-provided `sector.xlsx` is implemented as `public.sectors`: 74 Munich postal codes with their `North`, `South`, `East` or `West` sector. `members.postal_code` remains optional, but a supplied value must exist in this lookup. Store postcode strings, not numbers; send NULL for a missing value. `members_current.sector` derives the sector from the selected postal code. Do not write a separate sector to members.

The UI can filter postal codes by sector or show the sector automatically after postcode selection. See [sector UI and backend mapping](prometheus_redi_sector_UI_V4.md) for queries and integration rules. The file changes do not upgrade an existing database. V4 adds the separate optional landline, optional staff-linked ORI interviewer and optional attendance note. The API/UI wiring is the application team's work.

## V4 form fields

Keep `members.phone` for Mobile in the V4 form; its existing values remain unchanged. `members.landline_phone` is a separate nullable text field. `members.ori_interviewer_id` is nullable and references `staff.staff_id`; deleting that staff record sets the live reference to NULL. The backend saves the selected staff UUID or NULL. It does not invent an interviewer from the logged-in user. `members_current` exposes both new fields.

`attendance.note` is optional text saved with the specific attendance entry. SQL copies it into `attendance_deleted.note` on deletion. Member redaction clears live and archived attendance notes, both member phone numbers and the ORI association. The backend must include the new fields in its models and request/response handling; SQL does not implement endpoints.

All 15 lookup dictionaries are now present as Excel tabs, including `salutations` (Title), `genders` and `countries` (10 configured entries). Three old status dictionaries are labelled legacy; the Boolean status columns do not use them. Financial tables remain future UI scope.

## Financial records and clubhouse transfers

Both cash transaction tables use `transaction_type`: **`deposit`** for cash in and **`purchase`** for cash out. Amounts must be positive. SQL derives the sign directly from the type: `deposit` = `1`, `purchase` = `-1`. Each movement contributes `amount * sign` to the balance. The sign is not stored in a separate editable field, so it cannot contradict the transaction type. The two-code `cash_transaction_types` lookup remains. There is no account field or accounts lookup.

`member_cash_transactions.clubhouse_id` stores the clubhouse of the operation. On INSERT, SQL fills it from the member's current clubhouse if omitted. Historical imports and app corrections may explicitly provide the actual clubhouse. Updates do not automatically replace it with the member's current clubhouse.

**Transferring a member does not move earlier financial operations or the initial balance.** Reports use saved clubhouse IDs. New operations default to the new clubhouse. A transfer of the person does not itself transfer cash.

Example: A has an opening 100, a deposit 20 and a purchase 5. Its calculated balance is 115. Moving the member to B leaves A's history at 115. A new deposit 7 in B contributes 7 to B.

`cashflow.amount` is the actual cash on hand at the **end of the day**. SQL does not overwrite it to force a match. `cash_total_id=1` means clubhouse-owned funds; `2` means member funds.

The current implementation still uses `cash_opening_balances` for a confirmed initial amount at the **start** of its date, once per owner and currency. A member opening also retains its saved clubhouse. An unknown initial amount produces an unknown calculated balance, not an assumed zero. Replacing this table with another opening-balance input method has not been implemented in Version 4.

`finance_reconciliation` compares the confirmed opening plus deposits minus purchases with recorded cashflow by saved clubhouse, date and currency. It reports `ok`, `missing_opening_balance`, `missing_cashflow` or `balance_mismatch`. `finance_reconciliation_issues` shows rows needing review. The compatibility field `transfer_may_affect_history` is always `false`.

Correct application mistakes with ordinary UPDATE. No previous-value audit or correction-author tracking is implemented. Existing recording staff references remain. SQL automatically archives deleted records, including the operation's saved clubhouse ID.

## Monthly partitions

`attendance`, `phone_calls`, `member_cash_transactions`, `clubhouse_cash_transactions` and `cashflow` are partitioned by month. Each record's primary key combines its ID and date. Use **both ID and date** to identify a record for an update or deletion.

Write to parent tables, never directly to monthly child tables. Initially, the installer creates 145 months covering ten years back through two years ahead, inclusive: 725 physical children across five logical parents.

The database owner can create additional months:

```sql
CALL public.ensure_monthly_partitions(DATE '2028-01-01', DATE '2029-12-31');
```

No automatic scheduler is configured. An insert for a missing month fails. Partitions support date-based database access; the backend must still use date filters and pagination when returning data.

## Python check

From the project root, using the same Python environment for installation and execution:

```powershell
python -m pip install -r data_architecture/requirements-python-check.txt
python data_architecture/check_redi_from_python.py --connection-only
python data_architecture/check_redi_from_python.py
```

Defaults: `localhost:5432`, user `postgres`, database `prometheus_redi`. Use `--host`, `--port` and `--user` to match the connection. The password is requested interactively and is not stored. Do not put credentials in GitHub.

The default check creates synthetic records, verifies SQL behaviour and rolls back all demo changes. `--keep` explicitly saves a separate synthetic dataset after confirmation. This verifies direct Python/database integration; it does not test the team's API or authentication.

## Privacy, access and limits

Controlled redaction is technical pseudonymisation; UUIDs and financial links remain. It is not a guarantee of legal anonymity. Retention settings start disabled. No automatic destructive retention or partition-deletion job is configured.

For the application, create a separate backend role with the minimum required permissions on parent tables, lookup tables and views. Do not grant schema-owner/superuser privileges, access to `prometheus_private`, direct archive writes, TRUNCATE or maintenance/redaction procedures.

This is a teaching/test implementation. Production access configuration, approved retention rules, real-data import, frontend/API integration and scheduled partition maintenance require separate work.

## Verification

V3 passed 106 SQL checks and direct Python write/read/rollback verification on 18 November 2026. V4 has 120 SQL regression checks covering the added optional fields, their foreign key, deletion snapshots and redaction. Release verification covers both a fresh V4 installation and a V3-to-V4 upgrade on a disposable PostgreSQL 17 cluster. The working database is not modified by preparing these files.
