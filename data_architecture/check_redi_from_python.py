"""Create and verify synthetic Prometheus Redi records from Python.

Default: roll back ALL demo changes.
--keep: ask for confirmation, commit, then verify through a second connection.
This checks Python -> PostgreSQL, not a teammate's backend/API.
"""
from __future__ import annotations

import argparse
import getpass
import sys
import warnings
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

TARGET_DATABASE = "prometheus_redi"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--keep", action="store_true",
                        help="Confirm and permanently save synthetic demo records.")
    parser.add_argument("--connection-only", action="store_true",
                        help="Check login and the active database without creating records.")
    parser.add_argument("--no-password", action="store_true",
                        help="Use configured libpq authentication (.pgpass/trust); do not prompt.")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    if args.connection_only and args.keep:
        parser.error("--connection-only and --keep cannot be combined")
    return args


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def checked_conninfo(psycopg, params: dict) -> str:
    """Validate serialization without displaying or logging any credential."""
    from psycopg.conninfo import make_conninfo, conninfo_to_dict

    password = params.get("password", "")
    require(not any(ord(char) < 32 or ord(char) == 127 for char in password),
            "Password input contains control characters. Type it manually in the Terminal; "
            "do not paste it into code or send it in chat.")
    conninfo = make_conninfo(**params)
    parsed = conninfo_to_dict(conninfo)
    require(all(parsed.get(key) == str(value) for key, value in params.items()),
            "Connection parameters did not serialize correctly. No connection was attempted.")
    return conninfo


def create_demo(conn, ids: dict[str, UUID], run_name: str, today: date) -> dict[str, str]:
    """All inserts target parent tables and use bound SQL parameters."""
    conn.execute(
        """INSERT INTO public.clubhouses(clubhouse_id,name,timezone)
           VALUES(%s,%s,%s)""",
        (ids["clubhouse"], run_name, "Europe/Berlin"),
    )
    staff = conn.execute(
        """INSERT INTO public.staff(staff_id,clubhouse_id,first_name,last_name,role,start_date)
           VALUES(%s,%s,%s,%s,%s,%s) RETURNING staff_code""",
        (ids["staff"], ids["clubhouse"], "Demo", "Worker", "staff", today),
    ).fetchone()
    member = conn.execute(
        """INSERT INTO public.members(member_id,clubhouse_id,first_name,last_name,date_of_birth,join_date)
           VALUES(%s,%s,%s,%s,%s,%s) RETURNING member_code""",
        (ids["member"], ids["clubhouse"], "Demo", "Member", date(1990, 1, 1), today - timedelta(days=50)),
    ).fetchone()
    conn.execute(
        """INSERT INTO public.attendance(attendance_id,member_id,attendance_date,time_in,time_out)
           VALUES(%s,%s,%s,%s,%s)""",
        (ids["attendance"], ids["member"], today, "09:00", "12:00"),
    )
    conn.execute(
        """INSERT INTO public.emergency_contacts(contact_id,member_id,name,phone)
           VALUES(%s,%s,%s,%s)""",
        (ids["contact"], ids["member"], "Synthetic emergency contact", "DEMO-NOT-A-PHONE"),
    )
    conn.execute(
        """INSERT INTO public.phone_calls(call_id,person_id,person_type,call_date,duration_minutes,topic_code,note)
           VALUES(%s,%s,%s,%s,%s,%s,%s)""",
        (ids["call"], ids["member"], "member", today, 5, 3, "Synthetic Python smoke test"),
    )
    conn.execute(
        """INSERT INTO public.cash_opening_balances(opening_balance_id,member_id,balance_date,
                                                   currency,amount,recorded_by,source_reference)
           VALUES(%s,%s,%s,%s,%s,%s,%s)""",
        (ids["opening"], ids["member"], today, "EUR", Decimal("100.00"),
         ids["staff"], "Synthetic confirmed opening balance: Python demo"),
    )
    for key, kind, amount in (
        ("deposit", "deposit", Decimal("20.00")),
        ("purchase", "purchase", Decimal("5.00")),
    ):
        conn.execute(
            """INSERT INTO public.member_cash_transactions(member_transaction_id,member_id,
                       transaction_date,transaction_type,amount,currency,recorded_by,note)
               VALUES(%s,%s,%s,%s,%s,%s,%s,%s)""",
            (ids[key], ids["member"], today, kind, amount, "EUR", ids["staff"], "Synthetic Python demo"),
        )
    conn.execute(
        """INSERT INTO public.cashflow(cashflow_id,clubhouse_id,cashflow_date,cash_total_id,
                                       amount,currency,recorded_by)
           VALUES(%s,%s,%s,%s,%s,%s,%s)""",
        (ids["cashflow"], ids["clubhouse"], today, 2, Decimal("115.00"), "EUR", ids["staff"]),
    )

    # Delete ONLY a second contact created by this run to exercise SQL-owned history.
    conn.execute(
        """INSERT INTO public.emergency_contacts(contact_id,member_id,name,phone)
           VALUES(%s,%s,%s,%s)""",
        (ids["deleted_contact"], ids["member"], "Synthetic contact to archive", "DEMO-NOT-A-PHONE"),
    )
    conn.execute("SELECT set_config('prometheus.deleted_by',%s,true)", (str(ids["staff"]),))
    conn.execute("SELECT set_config('prometheus.deletion_reason',%s,true)", ("python_demo",))
    conn.execute("DELETE FROM public.emergency_contacts WHERE contact_id=%s", (ids["deleted_contact"],))
    return {"staff_code": staff[0], "member_code": member[0]}


def verify_rows(conn, ids: dict[str, UUID], saved: bool) -> None:
    """Count ONLY this run's UUIDs; never count or modify other people's records."""
    queries = [
        ("clubhouses", "SELECT count(*) FROM public.clubhouses WHERE clubhouse_id=%s", ids["clubhouse"], 1),
        ("staff", "SELECT count(*) FROM public.staff WHERE staff_id=%s", ids["staff"], 1),
        ("members", "SELECT count(*) FROM public.members WHERE member_id=%s", ids["member"], 1),
        ("attendance", "SELECT count(*) FROM public.attendance WHERE attendance_id=%s", ids["attendance"], 1),
        ("emergency_contacts", "SELECT count(*) FROM public.emergency_contacts WHERE contact_id=%s", ids["contact"], 1),
        ("phone_calls", "SELECT count(*) FROM public.phone_calls WHERE call_id=%s", ids["call"], 1),
        ("member_cash_transactions", "SELECT count(*) FROM public.member_cash_transactions WHERE member_id=%s", ids["member"], 2),
        ("cash_opening_balances", "SELECT count(*) FROM public.cash_opening_balances WHERE opening_balance_id=%s", ids["opening"], 1),
        ("cashflow", "SELECT count(*) FROM public.cashflow WHERE cashflow_id=%s", ids["cashflow"], 1),
        ("emergency_contacts_deleted", "SELECT count(*) FROM public.emergency_contacts_deleted WHERE contact_id=%s", ids["deleted_contact"], 1),
    ]
    for label, query, entity_id, stored_count in queries:
        actual = conn.execute(query, (entity_id,)).fetchone()[0]
        expected = stored_count if saved else 0
        require(actual == expected, f"{label}: expected {expected}, found {actual}")
        print(f"  PASS {label}: {actual} row(s)")
    actual = conn.execute(
        "SELECT count(*) FROM public.emergency_contacts WHERE contact_id=%s",
        (ids["deleted_contact"],),
    ).fetchone()[0]
    require(actual == 0, "The deleted demo contact is still in the live table.")


def verify_rules(conn, ids: dict[str, UUID], today: date) -> None:
    member = conn.execute(
        """SELECT member_code,membership_status,activity_status FROM public.members_current
           WHERE member_id=%s""", (ids["member"],),
    ).fetchone()
    require(member is not None and member[1:] == ("m", "active"),
            "Expected automatic membership=m and activity=active.")
    print(f"  PASS generated member code: {member[0]}")
    print("  PASS automatic statuses: membership=m, activity=active")
    call = conn.execute(
        """SELECT member_reference_id,staff_reference_id FROM public.phone_calls
           WHERE call_id=%s AND call_date=%s""", (ids["call"], today),
    ).fetchone()
    require(call == (ids["member"], None), "Generated phone-call FK is incorrect.")
    print("  PASS generated phone-call relationship")
    cash = conn.execute(
        """SELECT computed_balance,recorded_balance,difference,reconciliation_status
           FROM public.finance_reconciliation
           WHERE clubhouse_id=%s AND cash_total_id=2 AND currency='EUR' AND balance_date=%s""",
        (ids["clubhouse"], today),
    ).fetchone()
    require(cash == (Decimal("115.00"), Decimal("115.00"), Decimal("0.00"), "ok"),
            "Expected 100 + 20 - 5 = 115 EUR, difference=0, status=ok.")
    print("  PASS reconciliation: 100 + 20 - 5 = 115 EUR; difference=0")
    archive = conn.execute(
        """SELECT deleted_by,deletion_reason FROM public.emergency_contacts_deleted
           WHERE contact_id=%s""", (ids["deleted_contact"],),
    ).fetchone()
    require(archive == (ids["staff"], "python_demo"), "Automatic deletion attribution is incorrect.")
    print("  PASS deletion history recorded automatically by SQL")


def main() -> int:
    args = parse_args()
    try:
        import psycopg
    except ImportError:
        print('Install the driver in this Python environment first:\n'
              '  python -m pip install "psycopg[binary]>=3.2,<4"', file=sys.stderr)
        return 1
    if not callable(getattr(psycopg, "connect", None)):
        print("The psycopg module is incomplete or shadowed by another file.\n"
              "Check the Python environment and do not name your script psycopg.py.", file=sys.stderr)
        return 1

    print(f"Target: {args.host}:{args.port}/{TARGET_DATABASE} (user: {args.user})")
    print("This is a direct Python -> PostgreSQL check, not a backend/API test.")
    if args.keep:
        print("KEEP mode will save synthetic records in the test database.")
        try:
            confirmation = input("Type KEEP to confirm, or press Enter to cancel: ").strip()
        except EOFError:
            confirmation = ""
        except KeyboardInterrupt:
            print("\nCancelled. No database changes were made.")
            return 130
        if confirmation != "KEEP":
            print("Cancelled. No connection or database changes were made.")
            return 1
    elif args.connection_only:
        print("READ-ONLY mode: check login/database only; no demo records will be created.")
    else:
        print("SAFE mode: all demo changes will be rolled back.")

    kwargs = dict(host=args.host, port=args.port, dbname=TARGET_DATABASE,
                  user=args.user, connect_timeout=10, application_name="prometheus_python_demo")
    if not args.no_password:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", getpass.GetPassWarning)
                kwargs["password"] = getpass.getpass("PostgreSQL password (not saved): ")
        except (EOFError, getpass.GetPassWarning):
            print("Hidden password input is unavailable. Run this in the PyCharm Terminal,\n"
                  "or use --no-password with correctly configured .pgpass authentication.", file=sys.stderr)
            return 1
        except KeyboardInterrupt:
            print("\nCancelled. No database changes were made.")
            return 130

    ids = {key: uuid4() for key in (
        "clubhouse", "staff", "member", "attendance", "contact", "deleted_contact",
        "call", "opening", "deposit", "purchase", "cashflow",
    )}
    run_name = f"PYTHON_DEMO_{ids['clubhouse']}"
    conn = None
    committed = False
    try:
        conninfo = checked_conninfo(psycopg, kwargs)
        print("Connection parameters validated (password not displayed).")
        conn = psycopg.connect(conninfo)
        conn.execute("SET LOCAL lock_timeout='5s'")
        conn.execute("SET LOCAL statement_timeout='30s'")
        database, today = conn.execute(
            "SELECT current_database(),(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date"
        ).fetchone()
        require(database == TARGET_DATABASE, "Wrong database. No demo writes are allowed.")
        if args.connection_only:
            server_user = conn.execute("SELECT current_user").fetchone()[0]
            conn.rollback()
            print(f"CONNECTED: database={database}, user={server_user}")
            print("CONNECTION CHECK PASSED. No demo records were created.")
            return 0
        required = [
            "public.clubhouses", "public.staff", "public.members", "public.attendance",
            "public.emergency_contacts", "public.phone_calls", "public.member_cash_transactions",
            "public.cash_opening_balances", "public.cashflow", "public.emergency_contacts_deleted",
            "public.members_current", "public.finance_reconciliation",
        ]
        missing = conn.execute(
            "SELECT name FROM unnest(%s::text[]) AS required(name) WHERE to_regclass(name) IS NULL",
            (required,),
        ).fetchall()
        require(not missing, "Redi objects are missing. Install the schema first: " + str(missing))
        codes = create_demo(conn, ids, run_name, today)
        print("\nRecords read back inside the transaction:")
        verify_rows(conn, ids, saved=True)
        verify_rules(conn, ids, today)
        print(f"  PASS generated staff code: {codes['staff_code']}")

        if args.keep:
            conn.commit()
            committed = True
            print("\nCommitted synthetic records.")
        else:
            conn.rollback()
            print("\nRolled back ALL demo changes.")
        conn.close()
        conn = None

        # An independent session proves visibility after COMMIT or absence after ROLLBACK.
        print("\nIndependent connection verification:")
        with psycopg.connect(conninfo, autocommit=True) as observer:
            observer.execute("SET statement_timeout='30s'")
            verify_rows(observer, ids, saved=args.keep)
            if args.keep:
                verify_rules(observer, ids, today)
        print("\nPYTHON DATABASE CHECK PASSED")
        if args.keep:
            print(f"Clubhouse name: {run_name}")
            print(f"Clubhouse UUID: {ids['clubhouse']}")
            print(f"Member UUID: {ids['member']}")
            print(f"Staff UUID: {ids['staff']}")
            print("In DBeaver, refresh the public tables. Find the clubhouse by this exact name.")
            print("Each KEEP run creates a separate synthetic dataset; it does not overwrite earlier rows.")
        else:
            print("No demo records remain. Use --keep if you want to inspect saved rows in DBeaver.")
        return 0
    except (psycopg.Error, RuntimeError) as exc:
        if conn is not None:
            try:
                conn.rollback()
            except psycopg.Error:
                pass  # A broken connection also cannot commit this open transaction.
        if committed:
            print("CHECK INCOMPLETE: records were already committed; do not assume they were removed.",
                  file=sys.stderr)
            print(f"Saved clubhouse: {run_name}", file=sys.stderr)
        else:
            print("CHECK FAILED. This run did not commit any demo records.", file=sys.stderr)
        if isinstance(exc, psycopg.Error):
            if exc.sqlstate is None:
                # Raw libpq errors can quote a fragment of the connection string.
                # Classify privately, but never print the raw string or password.
                detail = str(exc).lower()
                if "connection info string" in detail or "conninfo" in detail:
                    summary = "The client rejected the connection-string format."
                elif "password authentication failed" in detail:
                    summary = "The server rejected authentication. Check the user/password locally."
                elif "connection refused" in detail or "timeout" in detail:
                    summary = "The server could not be reached. Check the host/port and PostgreSQL service."
                else:
                    summary = "Connection failed. Check host, port, user, authentication and driver settings."
                print("PostgreSQL connection error: " + summary, file=sys.stderr)
                print("Raw connection error hidden to protect credentials. Try --connection-only.",
                      file=sys.stderr)
            else:
                print(f"PostgreSQL error {exc.sqlstate}: {exc.diag.message_primary or type(exc).__name__}",
                      file=sys.stderr)
            if exc.sqlstate == "42501":
                print("Use the test database owner for this teaching check; this is not a least-privilege API test.",
                      file=sys.stderr)
            elif exc.sqlstate == "23514":
                print("Check constraints and current-month partition coverage. Do not rerun the installer.",
                      file=sys.stderr)
        else:
            print(str(exc), file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        if conn is not None:
            conn.rollback()
        print("\nCancelled. " + ("Demo records were already committed." if committed
                               else "No demo records were committed."), file=sys.stderr)
        return 130
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    raise SystemExit(main())

