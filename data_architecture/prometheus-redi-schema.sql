-- Prometheus Redi: fresh TEST installation, PostgreSQL 17+.
-- Target database: prometheus_redi. Never execute the old installation file here.
-- Sources: client Redi specification + retained lookup/archive/business rules.
-- No staff_clubhouses, translations or lookup_labels. No real data is migrated.
-- Execute the ENTIRE file with stop-on-error. See README_redi_schema_RU.md.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '15s';
DO $preflight$
BEGIN
    IF current_database() <> 'prometheus_redi' THEN
        RAISE EXCEPTION 'Wrong database: %. Connect to prometheus_redi first.', current_database();
    END IF;
    IF current_setting('server_version_num')::integer < 170000 THEN
        RAISE EXCEPTION 'PostgreSQL 17 or newer is required.';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f'))
       OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='prometheus_private') THEN
        RAISE EXCEPTION 'Fresh installation only: target schemas already contain objects. No objects were dropped.';
    END IF;
END $preflight$;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
DO $extensions$
BEGIN
    IF to_regprocedure('public.unaccent(text)') IS NULL
       OR to_regprocedure('public.hmac(bytea,bytea,text)') IS NULL THEN
        RAISE EXCEPTION 'unaccent and pgcrypto must be installed in public.';
    END IF;
END $extensions$;
CREATE SCHEMA prometheus_private;
REVOKE ALL ON SCHEMA prometheus_private FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE TABLE prometheus_private.code_secret (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    secret bytea NOT NULL
);
INSERT INTO prometheus_private.code_secret VALUES (true, public.gen_random_bytes(32));
CREATE TABLE prometheus_private.code_counters (
    person_kind text NOT NULL CHECK (person_kind IN ('members','staff')),
    prefix_hash bytea NOT NULL,
    last_number bigint NOT NULL CHECK (last_number > 0),
    PRIMARY KEY (person_kind, prefix_hash)
);
CREATE TABLE prometheus_private.person_ids (
    person_kind text NOT NULL CHECK (person_kind IN ('members','staff')),
    person_id uuid NOT NULL,
    PRIMARY KEY (person_kind,person_id)
);
-- Only the owner-only redaction procedures can create these capabilities.
CREATE TABLE prometheus_private.redaction_context (
    transaction_id bigint NOT NULL,
    person_kind text NOT NULL CHECK (person_kind IN ('members','staff')),
    person_id uuid NOT NULL,
    PRIMARY KEY (transaction_id,person_kind,person_id)
);
CREATE TABLE public.salutations (
    code text PRIMARY KEY,
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0),
    CHECK (btrim(code) <> '')
);

CREATE TABLE public.genders (
    code text PRIMARY KEY,
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0),
    CHECK (btrim(code) <> '')
);

CREATE TABLE public.activity_statuses (
    code text PRIMARY KEY,
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0),
    CHECK (btrim(code) <> '')
);

CREATE TABLE public.membership_statuses (
    code text PRIMARY KEY,
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0),
    CHECK (btrim(code) <> '')
);

CREATE TABLE public.contact_relationships (
    code text PRIMARY KEY,
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0),
    CHECK (btrim(code) <> '')
);

CREATE TABLE public.caller_types (
    code text PRIMARY KEY,
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0),
    CHECK (btrim(code) <> '')
);

CREATE TABLE public.call_topics (
    code integer PRIMARY KEY,
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0)
);

CREATE TABLE public.cash_transaction_types (
    code text PRIMARY KEY,
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0),
    CHECK (btrim(code) <> '')
);

CREATE TABLE public.currencies (
    code text PRIMARY KEY,
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0),
    CHECK (btrim(code) <> '')
);

CREATE TABLE public.clubhouse_statuses (
    code text PRIMARY KEY,
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0),
    CHECK (btrim(code) <> '')
);

CREATE TABLE public.countries (
    code text PRIMARY KEY,
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0),
    CHECK (btrim(code) <> '')
);

CREATE TABLE public.languages (
    code text PRIMARY KEY,
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0),
    CHECK (btrim(code) <> '')
);


-- New Redi lookup tables. Account values must be supplied by the client.
CREATE TABLE public.staff_statuses (
    code text PRIMARY KEY CHECK (code IN ('active','on_leave','inactive','unverified')),
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0)
);
CREATE TABLE public.accounts (
    code text PRIMARY KEY CHECK (btrim(code) <> ''),
    label text NOT NULL CHECK (btrim(label) <> ''),
    sort_order integer NOT NULL CHECK (sort_order > 0)
);
CREATE TABLE public.cash_total (
    cash_total_id smallint PRIMARY KEY CHECK (cash_total_id IN (1,2)),
    code text NOT NULL UNIQUE CHECK (code IN ('clubhouse','member')),
    label text NOT NULL CHECK (btrim(label) <> ''),
    CHECK ((cash_total_id=1 AND code='clubhouse') OR (cash_total_id=2 AND code='member'))
);
CREATE TABLE public.clubhouses (
    clubhouse_id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    street_address text,
    postal_code text,
    city text,
    country text,
    timezone text NOT NULL,
    primary_language text,
    clubhouse_status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_clubhouses PRIMARY KEY (clubhouse_id),
    CONSTRAINT uq_clubhouses_name UNIQUE (name),
    CONSTRAINT fk_clubhouses_country FOREIGN KEY (country)
        REFERENCES public.countries (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_clubhouses_primary_language FOREIGN KEY (primary_language)
        REFERENCES public.languages (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_clubhouses_clubhouse_status FOREIGN KEY (clubhouse_status)
        REFERENCES public.clubhouse_statuses (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT ck_clubhouses_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE public.members (
    member_id uuid NOT NULL DEFAULT gen_random_uuid(),
    clubhouse_id uuid NOT NULL,
    member_code text NOT NULL,
    first_name text,
    last_name text,
    date_of_birth date,
    join_date date NOT NULL,
    leave_date date,
    anonymized_at timestamptz,
    membership_status text NOT NULL DEFAULT 'mo',
    salutation text,
    gender text,
    phone text,
    email text,
    street_address text,
    postal_code text,
    city text,
    country text,
    activity_status text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_members PRIMARY KEY (member_id),
    CONSTRAINT fk_members_clubhouse_id FOREIGN KEY (clubhouse_id)
        REFERENCES public.clubhouses (clubhouse_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT uq_members_member_code UNIQUE (member_code),
    CONSTRAINT fk_members_membership_status FOREIGN KEY (membership_status)
        REFERENCES public.membership_statuses (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_members_salutation FOREIGN KEY (salutation)
        REFERENCES public.salutations (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_members_gender FOREIGN KEY (gender)
        REFERENCES public.genders (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_members_country FOREIGN KEY (country)
        REFERENCES public.countries (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_members_activity_status FOREIGN KEY (activity_status)
        REFERENCES public.activity_statuses (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT ck_members_leave_date CHECK (leave_date IS NULL OR leave_date >= join_date),
    CONSTRAINT ck_members_personal_fields CHECK (
        (anonymized_at IS NULL AND first_name IS NOT NULL AND btrim(first_name) <> ''
         AND last_name IS NOT NULL AND btrim(last_name) <> '' AND date_of_birth IS NOT NULL)
        OR (anonymized_at IS NOT NULL AND first_name IS NULL AND last_name IS NULL
            AND date_of_birth IS NULL AND salutation IS NULL AND gender IS NULL
            AND phone IS NULL AND email IS NULL AND street_address IS NULL
            AND postal_code IS NULL AND city IS NULL AND country IS NULL)),
    CONSTRAINT ck_members_redacted_code CHECK (anonymized_at IS NULL OR member_code ~ '^ANON_[0-9a-f]{32}$')
);

CREATE TABLE public.staff (
    staff_id uuid NOT NULL DEFAULT gen_random_uuid(),
    staff_code text NOT NULL,
    first_name text,
    last_name text,
    role text NOT NULL,
    email text,
    clubhouse_id uuid NOT NULL REFERENCES public.clubhouses(clubhouse_id) ON DELETE RESTRICT,
    staff_status text NOT NULL DEFAULT 'active' REFERENCES public.staff_statuses(code) ON DELETE RESTRICT,
    start_date date,
    end_date date,
    anonymized_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_staff PRIMARY KEY (staff_id),
    CONSTRAINT uq_staff_staff_code UNIQUE (staff_code),
    CONSTRAINT uq_staff_email UNIQUE (email),
    CONSTRAINT ck_staff_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
    CONSTRAINT ck_staff_personal_fields CHECK (
        (anonymized_at IS NULL AND first_name IS NOT NULL AND btrim(first_name) <> ''
         AND last_name IS NOT NULL AND btrim(last_name) <> '')
        OR (anonymized_at IS NOT NULL AND first_name IS NULL AND last_name IS NULL AND email IS NULL)),
    CONSTRAINT ck_staff_redacted_code CHECK (anonymized_at IS NULL OR staff_code ~ '^ANON_[0-9a-f]{32}$'),
    CONSTRAINT ck_staff_role_not_blank CHECK (btrim(role) <> '')
);

CREATE TABLE public.attendance (
    attendance_id uuid NOT NULL DEFAULT gen_random_uuid(),
    member_id uuid NOT NULL,
    attendance_date date NOT NULL,
    time_in time NOT NULL,
    time_out time,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_attendance PRIMARY KEY (attendance_id, attendance_date),
    CONSTRAINT fk_attendance_member_id FOREIGN KEY (member_id)
        REFERENCES public.members (member_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT ck_attendance_times CHECK (time_out IS NULL OR time_out >= time_in)
) PARTITION BY RANGE (attendance_date);

CREATE TABLE public.emergency_contacts (
    contact_id uuid NOT NULL DEFAULT gen_random_uuid(),
    member_id uuid NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    relationship text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_emergency_contacts PRIMARY KEY (contact_id),
    CONSTRAINT fk_emergency_contacts_member_id FOREIGN KEY (member_id)
        REFERENCES public.members (member_id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT fk_emergency_contacts_relationship FOREIGN KEY (relationship)
        REFERENCES public.contact_relationships (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT ck_emergency_contacts_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT ck_emergency_contacts_phone_not_blank CHECK (btrim(phone) <> '')
);

CREATE TABLE public.phone_calls (
    call_id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    person_type text NOT NULL,
    call_date date NOT NULL,
    duration_minutes integer NOT NULL,
    topic_code integer NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_phone_calls PRIMARY KEY (call_id, call_date),
    CONSTRAINT fk_phone_calls_person_type FOREIGN KEY (person_type)
        REFERENCES public.caller_types (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_phone_calls_topic_code FOREIGN KEY (topic_code)
        REFERENCES public.call_topics (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT ck_phone_calls_duration CHECK (duration_minutes > 0),
    CONSTRAINT ck_phone_calls_person_type CHECK (person_type IN ('member', 'staff')),
    member_reference_id uuid GENERATED ALWAYS AS (CASE WHEN person_type = 'member' THEN person_id END) STORED,
    staff_reference_id uuid GENERATED ALWAYS AS (CASE WHEN person_type = 'staff' THEN person_id END) STORED,
    CONSTRAINT fk_phone_calls_member FOREIGN KEY (member_reference_id) REFERENCES public.members (member_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_phone_calls_staff FOREIGN KEY (staff_reference_id) REFERENCES public.staff (staff_id) ON DELETE RESTRICT ON UPDATE NO ACTION
) PARTITION BY RANGE (call_date);

CREATE TABLE public.member_cash_transactions (
    member_transaction_id uuid NOT NULL DEFAULT gen_random_uuid(),
    member_id uuid NOT NULL,
    transaction_date date NOT NULL,
    transaction_type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text NOT NULL,
    recorded_by uuid NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_member_cash_transactions PRIMARY KEY (member_transaction_id, transaction_date),
    CONSTRAINT fk_member_cash_transactions_member_id FOREIGN KEY (member_id)
        REFERENCES public.members (member_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_member_cash_transactions_transaction_type FOREIGN KEY (transaction_type)
        REFERENCES public.cash_transaction_types (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_member_cash_transactions_currency FOREIGN KEY (currency)
        REFERENCES public.currencies (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_member_cash_transactions_recorded_by FOREIGN KEY (recorded_by)
        REFERENCES public.staff (staff_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT ck_member_cash_transactions_amount CHECK (amount > 0 AND amount <> 'NaN'::numeric)
) PARTITION BY RANGE (transaction_date);



-- 2b. New financial core tables.
CREATE TABLE public.clubhouse_cash_transactions (
    clubhouse_transaction_id uuid NOT NULL DEFAULT gen_random_uuid(),
    transaction_date date NOT NULL,
    clubhouse_id uuid NOT NULL REFERENCES public.clubhouses(clubhouse_id) ON DELETE RESTRICT,
    month date GENERATED ALWAYS AS (make_date(extract(year FROM transaction_date)::integer,
                                             extract(month FROM transaction_date)::integer,1)) STORED NOT NULL,
    account text NOT NULL REFERENCES public.accounts(code) ON DELETE RESTRICT,
    transaction_type text NOT NULL REFERENCES public.cash_transaction_types(code) ON DELETE RESTRICT,
    amount numeric(10,2) NOT NULL CHECK (amount > 0 AND amount <> 'NaN'::numeric),
    currency text NOT NULL REFERENCES public.currencies(code) ON DELETE RESTRICT,
    recorded_by uuid NOT NULL REFERENCES public.staff(staff_id) ON DELETE RESTRICT,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (clubhouse_transaction_id,transaction_date)
) PARTITION BY RANGE (transaction_date);
CREATE TABLE public.cashflow (
    cashflow_id uuid NOT NULL DEFAULT gen_random_uuid(),
    cashflow_date date NOT NULL,
    clubhouse_id uuid NOT NULL REFERENCES public.clubhouses(clubhouse_id) ON DELETE RESTRICT,
    cash_total_id smallint NOT NULL REFERENCES public.cash_total(cash_total_id) ON DELETE RESTRICT,
    amount numeric(10,2) NOT NULL CHECK (amount >= 0 AND amount <> 'NaN'::numeric),
    currency text NOT NULL REFERENCES public.currencies(code) ON DELETE RESTRICT,
    recorded_by uuid NOT NULL REFERENCES public.staff(staff_id) ON DELETE RESTRICT,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (cashflow_id,cashflow_date),
    UNIQUE (clubhouse_id,cash_total_id,cashflow_date,currency)
) PARTITION BY RANGE (cashflow_date);

-- Supplemental table proposed and explained in the README: not a fabricated deposit.
-- One INITIAL balance per owner/currency. Exactly one of the two real FK columns is set.
CREATE TABLE public.cash_opening_balances (
    opening_balance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clubhouse_id uuid REFERENCES public.clubhouses(clubhouse_id) ON DELETE RESTRICT,
    member_id uuid REFERENCES public.members(member_id) ON DELETE RESTRICT,
    balance_date date NOT NULL,
    currency text NOT NULL REFERENCES public.currencies(code) ON DELETE RESTRICT,
    amount numeric(10,2) NOT NULL CHECK (amount >= 0 AND amount <> 'NaN'::numeric),
    recorded_by uuid NOT NULL REFERENCES public.staff(staff_id) ON DELETE RESTRICT,
    source_reference text NOT NULL CHECK (btrim(source_reference) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(clubhouse_id,member_id)=1)
);
CREATE UNIQUE INDEX uq_opening_clubhouse_currency
    ON public.cash_opening_balances(clubhouse_id,currency) WHERE clubhouse_id IS NOT NULL;
CREATE UNIQUE INDEX uq_opening_member_currency
    ON public.cash_opening_balances(member_id,currency) WHERE member_id IS NOT NULL;
CREATE TABLE public.member_clubhouse_history (
    transfer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id uuid NOT NULL,
    old_clubhouse_id uuid NOT NULL REFERENCES public.clubhouses(clubhouse_id) ON DELETE RESTRICT,
    new_clubhouse_id uuid NOT NULL REFERENCES public.clubhouses(clubhouse_id) ON DELETE RESTRICT,
    transferred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK (old_clubhouse_id <> new_clubhouse_id)
);
CREATE TABLE public.retention_policy (
    entity text PRIMARY KEY CHECK (entity IN ('members','staff','emergency_contacts','phone_call_notes')),
    retention_months integer CHECK (retention_months >= 0),
    approved boolean NOT NULL DEFAULT false,
    approval_reference text,
    CHECK (NOT approved OR (retention_months IS NOT NULL AND approval_reference IS NOT NULL
                            AND btrim(approval_reference) <> ''))
);
-- No legal retention periods are silently approved by this installation.
INSERT INTO public.retention_policy(entity)
VALUES ('members'),('staff'),('emergency_contacts'),('phone_call_notes');
CREATE TABLE public.privacy_events (
    event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity text NOT NULL,
    person_id uuid,
    processed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    processed_by_database_user text NOT NULL DEFAULT session_user,
    reason_code text NOT NULL CHECK (btrim(reason_code) <> '')
);
-- Entries contain identifiers and actions, never a before-image of private fields.


CREATE TABLE public.members_deleted (
    archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    deleted_by uuid REFERENCES public.staff(staff_id) ON DELETE SET NULL,
    deletion_reason text,
    member_id uuid NOT NULL,
    clubhouse_id uuid NOT NULL,
    member_code text NOT NULL,
    first_name text,
    last_name text,
    date_of_birth date,
    join_date date NOT NULL,
    leave_date date,
    anonymized_at timestamptz,
    membership_status text NOT NULL,
    salutation text,
    gender text,
    phone text,
    email text,
    street_address text,
    postal_code text,
    city text,
    country text,
    activity_status text,
    original_created_at timestamptz NOT NULL,
    original_updated_at timestamptz NOT NULL
);

CREATE TABLE public.staff_deleted (
    archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    deleted_by uuid REFERENCES public.staff(staff_id) ON DELETE SET NULL,
    deletion_reason text,
    staff_id uuid NOT NULL,
    staff_code text NOT NULL,
    first_name text,
    last_name text,
    role text NOT NULL,
    email text,
    clubhouse_id uuid NOT NULL,
    staff_status text NOT NULL,
    start_date date,
    end_date date,
    anonymized_at timestamptz,
    original_created_at timestamptz NOT NULL,
    original_updated_at timestamptz NOT NULL
);

CREATE TABLE public.attendance_deleted (
    archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    deleted_by uuid REFERENCES public.staff(staff_id) ON DELETE SET NULL,
    deletion_reason text,
    attendance_id uuid NOT NULL,
    member_id uuid NOT NULL,
    attendance_date date NOT NULL,
    time_in time NOT NULL,
    time_out time,
    original_created_at timestamptz NOT NULL
);

CREATE TABLE public.emergency_contacts_deleted (
    archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    deleted_by uuid REFERENCES public.staff(staff_id) ON DELETE SET NULL,
    deletion_reason text,
    contact_id uuid NOT NULL,
    member_id uuid NOT NULL,
    name text,
    phone text,
    relationship text,
    original_created_at timestamptz NOT NULL
);

CREATE TABLE public.phone_calls_deleted (
    archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    deleted_by uuid REFERENCES public.staff(staff_id) ON DELETE SET NULL,
    deletion_reason text,
    call_id uuid NOT NULL,
    person_id uuid NOT NULL,
    person_type text NOT NULL,
    call_date date NOT NULL,
    duration_minutes integer NOT NULL,
    topic_code integer NOT NULL,
    note text,
    original_created_at timestamptz NOT NULL
);

CREATE TABLE public.member_cash_transactions_deleted (
    archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    deleted_by uuid REFERENCES public.staff(staff_id) ON DELETE SET NULL,
    deletion_reason text,
    member_transaction_id uuid NOT NULL,
    member_id uuid NOT NULL,
    transaction_date date NOT NULL,
    transaction_type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text NOT NULL,
    recorded_by uuid NOT NULL,
    note text,
    original_created_at timestamptz NOT NULL
);

CREATE TABLE public.clubhouse_cash_transactions_deleted (
    archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    deleted_by uuid REFERENCES public.staff(staff_id) ON DELETE SET NULL,
    deletion_reason text,
    clubhouse_transaction_id uuid NOT NULL,
    transaction_date date NOT NULL,
    clubhouse_id uuid NOT NULL,
    month date,
    account text NOT NULL,
    transaction_type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text NOT NULL,
    recorded_by uuid NOT NULL,
    note text,
    original_created_at timestamptz NOT NULL
);

CREATE TABLE public.cashflow_deleted (
    archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    deleted_by uuid REFERENCES public.staff(staff_id) ON DELETE SET NULL,
    deletion_reason text,
    cashflow_id uuid NOT NULL,
    cashflow_date date NOT NULL,
    clubhouse_id uuid NOT NULL,
    cash_total_id smallint NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text NOT NULL,
    recorded_by uuid NOT NULL,
    note text,
    original_created_at timestamptz NOT NULL
);


-- Monthly partitions: rolling ten-year teaching history and two future years.
-- Owner-only maintenance procedure. No DEFAULT partition and no silent data loss.
CREATE PROCEDURE public.ensure_monthly_partitions(p_from date, p_through date)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE d date; nxt date; parent_name text; child_name text;
BEGIN
    IF p_from IS NULL OR p_through IS NULL OR p_through < p_from
       OR p_through > p_from + interval '30 years' THEN
        RAISE EXCEPTION 'Provide a valid partition interval of at most 30 years.';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('prometheus-redi-partitions',0));
    d := date_trunc('month',p_from)::date;
    WHILE d <= p_through LOOP
        nxt := (d+interval '1 month')::date;
        FOREACH parent_name IN ARRAY ARRAY['attendance','phone_calls','member_cash_transactions',
                                           'clubhouse_cash_transactions','cashflow'] LOOP
            child_name := parent_name || '_' || to_char(d,'YYYY_MM');
            IF to_regclass(format('public.%I',child_name)) IS NULL THEN
                EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
                               child_name,parent_name,d,nxt);
            END IF;
        END LOOP;
        d := nxt;
    END LOOP;
END $fn$;
REVOKE ALL ON PROCEDURE public.ensure_monthly_partitions(date,date) FROM PUBLIC;
CALL public.ensure_monthly_partitions(
    (date_trunc('month',current_date)-interval '10 years')::date,
    (date_trunc('month',current_date)+interval '2 years')::date);

CREATE INDEX ix_members_clubhouse ON public.members(clubhouse_id);
CREATE INDEX ix_staff_clubhouse ON public.staff(clubhouse_id);
CREATE INDEX ix_attendance_member_date ON public.attendance(member_id,attendance_date DESC);
CREATE INDEX ix_contacts_member ON public.emergency_contacts(member_id);
CREATE INDEX ix_calls_member ON public.phone_calls(member_reference_id,call_date);
CREATE INDEX ix_calls_staff ON public.phone_calls(staff_reference_id,call_date);
CREATE INDEX ix_member_cash_member_currency_date ON public.member_cash_transactions(member_id,currency,transaction_date);
CREATE INDEX ix_member_cash_actor ON public.member_cash_transactions(recorded_by);
CREATE INDEX ix_clubhouse_cash_owner_currency_date ON public.clubhouse_cash_transactions(clubhouse_id,currency,transaction_date);
CREATE INDEX ix_clubhouse_cash_actor ON public.clubhouse_cash_transactions(recorded_by);
CREATE INDEX ix_clubhouse_cash_account ON public.clubhouse_cash_transactions(account);
CREATE INDEX ix_cashflow_actor ON public.cashflow(recorded_by);
CREATE INDEX ix_opening_actor ON public.cash_opening_balances(recorded_by);
CREATE INDEX ix_transfer_member ON public.member_clubhouse_history(member_id,transferred_at);

-- 6. Initial lookup data: all rows from the client workbook.

INSERT INTO public.salutations (code, label, sort_order) VALUES
    ('ms', 'Ms.', 1),
    ('mr', 'Mr.', 2),
    ('unspecified', 'Not specified', 3);

INSERT INTO public.genders (code, label, sort_order) VALUES
    ('female', 'Female', 1),
    ('male', 'Male', 2),
    ('diverse', 'Diverse', 3),
    ('unspecified', 'Not specified', 4);

INSERT INTO public.activity_statuses (code, label, sort_order) VALUES
    ('active', 'Active', 1),
    ('inactive', 'Inactive', 2);

INSERT INTO public.membership_statuses (code, label, sort_order) VALUES
    ('mo', 'MO', 1),
    ('m', 'M', 2);

INSERT INTO public.contact_relationships (code, label, sort_order) VALUES
    ('mother', 'Mother', 1),
    ('father', 'Father', 2),
    ('sister', 'Sister', 3),
    ('brother', 'Brother', 4),
    ('wife', 'Wife', 5),
    ('husband', 'Husband', 6),
    ('son', 'Son', 7),
    ('daughter', 'Daughter', 8),
    ('other', 'Other', 9);

INSERT INTO public.caller_types (code, label, sort_order) VALUES
    ('member', 'Member', 1),
    ('staff', 'Staff member', 2);

INSERT INTO public.call_topics (code, label, sort_order) VALUES
    ('1', 'Shift sign-up', 1),
    ('2', 'Clubhouse matters', 2),
    ('3', 'Counseling conversation', 3),
    ('4', 'Crisis intervention', 4),
    ('5', 'Supportive conversation', 5);

INSERT INTO public.cash_transaction_types (code, label, sort_order) VALUES
    ('deposit', 'Deposit', 1),
    ('purchase', 'Purchase', 2);

INSERT INTO public.currencies (code, label, sort_order) VALUES
    ('EUR', 'Euro', 1),
    ('CHF', 'Swiss Franc', 2),
    ('GBP', 'British Pound', 3),
    ('NOK', 'Norwegian Krone', 4),
    ('GIP', 'Gibraltar Pound', 5);

INSERT INTO public.clubhouse_statuses (code, label, sort_order) VALUES
    ('active', 'Active', 1),
    ('inactive', 'Inactive', 2);

INSERT INTO public.countries (code, label, sort_order) VALUES
    ('DE', 'Germany', 1),
    ('AT', 'Austria', 2),
    ('CH', 'Switzerland', 3),
    ('NL', 'Netherlands', 4),
    ('FR', 'France', 5),
    ('ES', 'Spain', 6),
    ('IT', 'Italy', 7),
    ('GB', 'United Kingdom', 8),
    ('NO', 'Norway', 9),
    ('GI', 'Gibraltar', 10);

INSERT INTO public.languages (code, label, sort_order) VALUES
    ('de', 'German', 1),
    ('en', 'English', 2),
    ('fr', 'French', 3),
    ('es', 'Spanish', 4),
    ('it', 'Italian', 5),
    ('nl', 'Dutch', 6),
    ('no', 'Norwegian', 7);


INSERT INTO public.staff_statuses(code,label,sort_order) VALUES
 ('active','Active',1),('on_leave','On leave',2),('inactive','Inactive',3),('unverified','Unverified',4);
INSERT INTO public.cash_total(cash_total_id,code,label) VALUES
 (1,'clubhouse','Clubhouse cash'),(2,'member','Member cash');
-- accounts intentionally has no invented client values.

CREATE FUNCTION public.membership_status_on(p_join_date date, p_as_of date)
RETURNS text LANGUAGE sql IMMUTABLE STRICT
SET search_path = pg_catalog, public
AS $fn$
    SELECT CASE WHEN p_as_of >= p_join_date + 42 THEN 'm' ELSE 'mo' END;
$fn$;

-- NULL until first visit; active through day 90, inactive from day 91.
CREATE FUNCTION public.activity_status_on(p_last_visit date, p_as_of date)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, public
AS $fn$
    SELECT CASE
        WHEN p_last_visit IS NULL OR p_as_of IS NULL THEN NULL
        WHEN p_as_of - p_last_visit <= 90 THEN 'active'
        ELSE 'inactive'
    END;
$fn$;

CREATE FUNCTION public.code_name_part(p_name text)
RETURNS text LANGUAGE sql STABLE STRICT
SET search_path = pg_catalog, public
AS $fn$
    SELECT regexp_replace(
        upper(public.unaccent(
            replace(replace(replace(replace(lower(btrim(p_name)),
                'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss')
        )), '[^A-Z]', '', 'g'
    );
$fn$;


CREATE FUNCTION prometheus_private.is_redacting(p_kind text,p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,prometheus_private AS $fn$
    SELECT EXISTS(SELECT 1 FROM prometheus_private.redaction_context
                  WHERE transaction_id=txid_current() AND person_kind=p_kind AND person_id=p_id);
$fn$;
REVOKE ALL ON FUNCTION prometheus_private.is_redacting(text,uuid) FROM PUBLIC;

CREATE FUNCTION public.allocate_person_code(p_kind text,p_first_name text,p_last_name text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,prometheus_private AS $fn$
DECLARE prefix text; digest bytea; n bigint;
BEGIN
    IF p_kind NOT IN ('members','staff') OR p_first_name IS NULL OR p_last_name IS NULL THEN
        RAISE EXCEPTION 'Names and a valid person namespace are required.' USING ERRCODE='23514';
    END IF;
    prefix:=public.code_name_part(p_last_name)||left(public.code_name_part(p_first_name),1);
    IF public.code_name_part(p_last_name)='' OR public.code_name_part(p_first_name)='' THEN
        RAISE EXCEPTION 'Names need transliterable letters for code generation.' USING ERRCODE='23514';
    END IF;
    SELECT public.hmac(convert_to(prefix,'UTF8'),secret,'sha256') INTO digest
    FROM prometheus_private.code_secret WHERE singleton;
    INSERT INTO prometheus_private.code_counters(person_kind,prefix_hash,last_number)
    VALUES (p_kind,digest,1)
    ON CONFLICT(person_kind,prefix_hash) DO UPDATE
    SET last_number=code_counters.last_number+1 RETURNING last_number INTO n;
    RETURN prefix||lpad(n::text,greatest(2,length(n::text)),'0');
END $fn$;
REVOKE ALL ON FUNCTION public.allocate_person_code(text,text,text) FROM PUBLIC;

CREATE FUNCTION public.prepare_person()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,prometheus_private AS $fn$
DECLARE kind text:=TG_TABLE_NAME; id uuid; old_id uuid; code_field text;
BEGIN
    code_field:=CASE WHEN kind='members' THEN 'member_code' ELSE 'staff_code' END;
    id:=(to_jsonb(NEW)->>CASE WHEN kind='members' THEN 'member_id' ELSE 'staff_id' END)::uuid;
    IF TG_OP='INSERT' THEN
        IF NEW.anonymized_at IS NOT NULL OR to_jsonb(NEW)->>code_field IS NOT NULL THEN
            RAISE EXCEPTION 'Omit generated code and anonymized_at on INSERT.' USING ERRCODE='23514';
        END IF;
        INSERT INTO prometheus_private.person_ids VALUES(kind,id);
        IF kind='members' THEN
            NEW.member_code:=public.allocate_person_code(kind,NEW.first_name,NEW.last_name);
        ELSE
            NEW.staff_code:=public.allocate_person_code(kind,NEW.first_name,NEW.last_name);
        END IF;
    ELSE
        old_id:=(to_jsonb(OLD)->>CASE WHEN kind='members' THEN 'member_id' ELSE 'staff_id' END)::uuid;
        IF id IS DISTINCT FROM old_id THEN
            RAISE EXCEPTION 'Person UUID is immutable.' USING ERRCODE='23514';
        END IF;
        IF NOT prometheus_private.is_redacting(kind,id)
           AND (NEW.anonymized_at IS DISTINCT FROM OLD.anonymized_at
                OR to_jsonb(NEW)->>code_field IS DISTINCT FROM to_jsonb(OLD)->>code_field) THEN
            RAISE EXCEPTION 'Only the privileged privacy procedure can change code/anonymized_at.'
                USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END $fn$;
CREATE TRIGGER a_prepare_members BEFORE INSERT OR UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.prepare_person();
CREATE TRIGGER a_prepare_staff BEFORE INSERT OR UPDATE ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.prepare_person();
CREATE FUNCTION public.validate_clubhouse_timezone()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $fn$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
        RAISE EXCEPTION 'Unknown timezone: %', NEW.timezone USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$fn$;
CREATE TRIGGER a_validate_timezone BEFORE INSERT OR UPDATE OF timezone ON public.clubhouses
FOR EACH ROW EXECUTE FUNCTION public.validate_clubhouse_timezone();

CREATE FUNCTION public.refresh_member_on_write()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $fn$
DECLARE
    v_today date;
    v_last_visit date;
    v_membership text;
    v_activity text;
BEGIN
    SELECT (statement_timestamp() AT TIME ZONE c.timezone)::date
    INTO v_today FROM public.clubhouses AS c WHERE c.clubhouse_id = NEW.clubhouse_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown clubhouse_id: %', NEW.clubhouse_id USING ERRCODE = '23503';
    END IF;
    SELECT max(attendance_date) INTO v_last_visit FROM public.attendance
    WHERE member_id = NEW.member_id AND attendance_date <= v_today;

    v_membership := public.membership_status_on(NEW.join_date, v_today);
    v_activity := public.activity_status_on(v_last_visit, v_today);
    IF TG_OP = 'UPDATE' THEN
        IF NEW.membership_status IS DISTINCT FROM OLD.membership_status
           AND NEW.membership_status IS DISTINCT FROM v_membership THEN
            RAISE EXCEPTION 'membership_status is calculated from join_date; manual override is disabled.'
                USING ERRCODE = '23514';
        END IF;
        IF NEW.activity_status IS DISTINCT FROM OLD.activity_status
           AND NEW.activity_status IS DISTINCT FROM v_activity THEN
            RAISE EXCEPTION 'activity_status is calculated from attendance; manual override is disabled.'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    -- INSERT ignores any proposed status and derives the correct value.
    NEW.membership_status := v_membership;
    NEW.activity_status := v_activity;
    RETURN NEW;
END;
$fn$;
CREATE TRIGGER b_refresh_member BEFORE INSERT OR UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.refresh_member_on_write();

CREATE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $fn$
BEGIN
    NEW.created_at := OLD.created_at;
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$fn$;
CREATE TRIGGER z_touch_members BEFORE UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER z_touch_staff BEFORE UPDATE ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER z_touch_clubhouses BEFORE UPDATE ON public.clubhouses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Statement-level transition tables update each affected member once.
-- Sorted parent row locks reduce deadlocks and serialize concurrent attendance changes.
CREATE FUNCTION public.refresh_attendance_members()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $fn$
DECLARE v_ids uuid[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT array_agg(DISTINCT member_id ORDER BY member_id) INTO v_ids FROM new_visits;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT array_agg(DISTINCT member_id ORDER BY member_id) INTO v_ids FROM old_visits;
    ELSE
        SELECT array_agg(member_id ORDER BY member_id) INTO v_ids
        FROM (SELECT member_id FROM old_visits UNION SELECT member_id FROM new_visits) AS affected;
    END IF;
    IF v_ids IS NOT NULL THEN
        PERFORM member_id FROM public.members
        WHERE member_id = ANY(v_ids) ORDER BY member_id FOR NO KEY UPDATE;
        UPDATE public.members SET updated_at = clock_timestamp() WHERE member_id = ANY(v_ids);
    END IF;
    RETURN NULL;
END;
$fn$;
CREATE TRIGGER refresh_members_after_visit_insert AFTER INSERT ON public.attendance
REFERENCING NEW TABLE AS new_visits
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_attendance_members();
CREATE TRIGGER refresh_members_after_visit_update AFTER UPDATE ON public.attendance
REFERENCING OLD TABLE AS old_visits NEW TABLE AS new_visits
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_attendance_members();
CREATE TRIGGER refresh_members_after_visit_delete AFTER DELETE ON public.attendance
REFERENCING OLD TABLE AS old_visits
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_attendance_members();

-- Cache columns are retained for compatibility with the client model.
-- Application reads must use this view to avoid a stale cache after midnight.
CREATE VIEW public.members_current AS
SELECT
    m.member_id, m.clubhouse_id, m.member_code, m.first_name, m.last_name,
    m.date_of_birth, m.join_date, m.leave_date, m.anonymized_at,
    (m.leave_date IS NULL AND m.anonymized_at IS NULL) AS is_current,
    public.membership_status_on(m.join_date, d.local_date) AS membership_status,
    m.salutation, m.gender, m.phone, m.email, m.street_address,
    m.postal_code, m.city, m.country,
    public.activity_status_on(v.last_visit_date, d.local_date) AS activity_status,
    m.created_at, m.updated_at,
    v.last_visit_date,
    d.local_date AS status_as_of
FROM public.members AS m
JOIN public.clubhouses AS c ON c.clubhouse_id = m.clubhouse_id
CROSS JOIN LATERAL (
    SELECT (statement_timestamp() AT TIME ZONE c.timezone)::date AS local_date
) AS d
LEFT JOIN LATERAL (
    SELECT max(a.attendance_date) AS last_visit_date
    FROM public.attendance AS a
    WHERE a.member_id = m.member_id AND a.attendance_date <= d.local_date
) AS v ON true;

-- Optional cache refresh for a backend scheduler. Views need no scheduler.
CREATE PROCEDURE public.refresh_member_status_cache()
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $fn$
BEGIN
    -- Recalculate in the BEFORE trigger, after acquiring each member's row lock.
    UPDATE public.members AS m SET updated_at = clock_timestamp()
    FROM public.members_current AS c
    WHERE c.member_id = m.member_id
      AND (m.membership_status IS DISTINCT FROM c.membership_status
           OR m.activity_status IS DISTINCT FROM c.activity_status);
END;
$fn$;


CREATE FUNCTION public.log_member_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
    IF NEW.clubhouse_id IS DISTINCT FROM OLD.clubhouse_id THEN
        INSERT INTO public.member_clubhouse_history(member_id,old_clubhouse_id,new_clubhouse_id)
        VALUES(NEW.member_id,OLD.clubhouse_id,NEW.clubhouse_id);
    END IF;
    RETURN NULL;
END $fn$;
CREATE TRIGGER log_member_transfer AFTER UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.log_member_transfer();


-- IDs remain stable; dates are part of composite PKs and may be corrected.
CREATE FUNCTION public.guard_source_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE id text; already_deleted boolean;
BEGIN
    id:=to_jsonb(NEW)->>TG_ARGV[0];
    IF TG_OP='UPDATE' AND id IS DISTINCT FROM to_jsonb(OLD)->>TG_ARGV[0] THEN
        RAISE EXCEPTION '% is immutable.',TG_ARGV[0] USING ERRCODE='23514';
    END IF;
    IF TG_OP='INSERT' THEN
        EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %I=$1::uuid)',
                        TG_ARGV[1]||'_deleted',TG_ARGV[0]) INTO already_deleted USING id;
        IF already_deleted THEN RAISE EXCEPTION 'Deleted identifier cannot be reused.' USING ERRCODE='23514'; END IF;
    END IF;
    RETURN NEW;
END $fn$;

-- Archive once for the parent DELETE statement. A partition-moving UPDATE is not a deletion.
-- Always issue INSERT/UPDATE/DELETE against the parent, never a monthly child table.
CREATE FUNCTION public.archive_deleted_statement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE r record; payload jsonb; actor uuid; reason text; archive_name text:=TG_ARGV[0]||'_deleted';
BEGIN
    actor:=nullif(current_setting('prometheus.deleted_by',true),'')::uuid;
    reason:=nullif(current_setting('prometheus.deletion_reason',true),'');
    IF actor IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.staff WHERE staff_id=actor) THEN
        IF TG_ARGV[0]='staff' AND EXISTS(SELECT 1 FROM old_deleted WHERE (to_jsonb(old_deleted)->>'staff_id')::uuid=actor)
        THEN actor:=NULL;
        ELSE RAISE EXCEPTION 'Deletion actor is not a live staff record.' USING ERRCODE='23503'; END IF;
    END IF;
    FOR r IN SELECT * FROM old_deleted LOOP
        payload:=(to_jsonb(r)-'created_at'-'updated_at'-'member_reference_id'-'staff_reference_id')
          ||jsonb_build_object('archive_id',gen_random_uuid(),'deleted_at',clock_timestamp(),
               'deleted_by',actor,'deletion_reason',reason,'original_created_at',to_jsonb(r)->'created_at');
        IF TG_ARGV[0] IN ('members','staff') THEN
            payload:=payload||jsonb_build_object('original_updated_at',to_jsonb(r)->'updated_at');
        END IF;
        EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I,$1)',
                       archive_name,archive_name) USING payload;
    END LOOP;
    RETURN NULL;
END $fn$;

CREATE FUNCTION public.guard_archive_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,prometheus_private AS $fn$
DECLARE j jsonb:=to_jsonb(OLD); n jsonb:=to_jsonb(NEW); authorized boolean;
        private_fields text[]:=ARRAY['first_name','last_name','date_of_birth','salutation','gender',
         'phone','email','street_address','postal_code','city','country','name','relationship',
         'note','deletion_reason','member_code','staff_code','anonymized_at'];
        f text;
BEGIN
    IF OLD.deleted_by IS NOT NULL AND NEW.deleted_by IS NULL
       AND (j-'deleted_by')=(n-'deleted_by')
       AND NOT EXISTS(SELECT 1 FROM public.staff WHERE staff_id=OLD.deleted_by) THEN RETURN NEW; END IF;
    SELECT EXISTS(
        SELECT 1 FROM prometheus_private.redaction_context c
        WHERE c.transaction_id=txid_current() AND (
          (c.person_kind='members' AND
             (j->>'member_id'=c.person_id::text OR
              (j->>'person_type'='member' AND j->>'person_id'=c.person_id::text)))
          OR (c.person_kind='staff' AND
             (j->>'staff_id'=c.person_id::text OR j->>'recorded_by'=c.person_id::text
              OR j->>'deleted_by'=c.person_id::text
              OR (j->>'person_type'='staff' AND j->>'person_id'=c.person_id::text)))))
    INTO authorized;
    IF NOT authorized OR (j-private_fields) IS DISTINCT FROM (n-private_fields) THEN
        RAISE EXCEPTION 'Archive is immutable outside controlled personal-data redaction.' USING ERRCODE='23514';
    END IF;
    FOREACH f IN ARRAY private_fields LOOP
        IF n ? f AND n->f IS DISTINCT FROM j->f AND n->f <> 'null'::jsonb THEN
            IF f IN ('member_code','staff_code') AND n->>f ~ '^ANON_[0-9a-f]{32}$' THEN CONTINUE; END IF;
            IF f='anonymized_at' THEN CONTINUE; END IF;
            RAISE EXCEPTION 'Privacy operation may only clear %, not replace its content.',f USING ERRCODE='23514';
        END IF;
    END LOOP;
    RETURN NEW;
END $fn$;

CREATE FUNCTION public.block_history_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN RAISE EXCEPTION 'No automatic archive deletion or TRUNCATE. Retention requires a separate approved purge plan.'
       USING ERRCODE='23514'; END $fn$;
CREATE TRIGGER immutable_transfer_history BEFORE UPDATE OR DELETE ON public.member_clubhouse_history
FOR EACH ROW EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER no_transfer_truncate BEFORE TRUNCATE ON public.member_clubhouse_history
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER immutable_privacy_history BEFORE UPDATE OR DELETE ON public.privacy_events
FOR EACH ROW EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER no_privacy_truncate BEFORE TRUNCATE ON public.privacy_events
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER archive_on_delete AFTER DELETE ON public.members
REFERENCING OLD TABLE AS old_deleted FOR EACH STATEMENT
EXECUTE FUNCTION public.archive_deleted_statement('members');
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.members
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.members_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();
CREATE TRIGGER prevent_archive_delete BEFORE DELETE ON public.members_deleted
FOR EACH ROW EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER no_archive_truncate BEFORE TRUNCATE ON public.members_deleted
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE INDEX ix_members_deleted_original ON public.members_deleted(member_id);
CREATE INDEX ix_members_deleted_actor ON public.members_deleted(deleted_by);
CREATE TRIGGER archive_on_delete AFTER DELETE ON public.staff
REFERENCING OLD TABLE AS old_deleted FOR EACH STATEMENT
EXECUTE FUNCTION public.archive_deleted_statement('staff');
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.staff
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.staff_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();
CREATE TRIGGER prevent_archive_delete BEFORE DELETE ON public.staff_deleted
FOR EACH ROW EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER no_archive_truncate BEFORE TRUNCATE ON public.staff_deleted
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE INDEX ix_staff_deleted_original ON public.staff_deleted(staff_id);
CREATE INDEX ix_staff_deleted_actor ON public.staff_deleted(deleted_by);
CREATE TRIGGER a_guard_id BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.guard_source_id('attendance_id','attendance');
CREATE TRIGGER archive_on_delete AFTER DELETE ON public.attendance
REFERENCING OLD TABLE AS old_deleted FOR EACH STATEMENT
EXECUTE FUNCTION public.archive_deleted_statement('attendance');
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.attendance
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.attendance_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();
CREATE TRIGGER prevent_archive_delete BEFORE DELETE ON public.attendance_deleted
FOR EACH ROW EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER no_archive_truncate BEFORE TRUNCATE ON public.attendance_deleted
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE INDEX ix_attendance_deleted_original ON public.attendance_deleted(attendance_id);
CREATE INDEX ix_attendance_deleted_actor ON public.attendance_deleted(deleted_by);
CREATE TRIGGER a_guard_id BEFORE INSERT OR UPDATE ON public.emergency_contacts
FOR EACH ROW EXECUTE FUNCTION public.guard_source_id('contact_id','emergency_contacts');
CREATE TRIGGER archive_on_delete AFTER DELETE ON public.emergency_contacts
REFERENCING OLD TABLE AS old_deleted FOR EACH STATEMENT
EXECUTE FUNCTION public.archive_deleted_statement('emergency_contacts');
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.emergency_contacts
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.emergency_contacts_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();
CREATE TRIGGER prevent_archive_delete BEFORE DELETE ON public.emergency_contacts_deleted
FOR EACH ROW EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER no_archive_truncate BEFORE TRUNCATE ON public.emergency_contacts_deleted
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE INDEX ix_emergency_contacts_deleted_original ON public.emergency_contacts_deleted(contact_id);
CREATE INDEX ix_emergency_contacts_deleted_actor ON public.emergency_contacts_deleted(deleted_by);
CREATE TRIGGER a_guard_id BEFORE INSERT OR UPDATE ON public.phone_calls
FOR EACH ROW EXECUTE FUNCTION public.guard_source_id('call_id','phone_calls');
CREATE TRIGGER archive_on_delete AFTER DELETE ON public.phone_calls
REFERENCING OLD TABLE AS old_deleted FOR EACH STATEMENT
EXECUTE FUNCTION public.archive_deleted_statement('phone_calls');
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.phone_calls
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.phone_calls_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();
CREATE TRIGGER prevent_archive_delete BEFORE DELETE ON public.phone_calls_deleted
FOR EACH ROW EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER no_archive_truncate BEFORE TRUNCATE ON public.phone_calls_deleted
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE INDEX ix_phone_calls_deleted_original ON public.phone_calls_deleted(call_id);
CREATE INDEX ix_phone_calls_deleted_actor ON public.phone_calls_deleted(deleted_by);
CREATE TRIGGER a_guard_id BEFORE INSERT OR UPDATE ON public.member_cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_source_id('member_transaction_id','member_cash_transactions');
CREATE TRIGGER archive_on_delete AFTER DELETE ON public.member_cash_transactions
REFERENCING OLD TABLE AS old_deleted FOR EACH STATEMENT
EXECUTE FUNCTION public.archive_deleted_statement('member_cash_transactions');
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.member_cash_transactions
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.member_cash_transactions_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();
CREATE TRIGGER prevent_archive_delete BEFORE DELETE ON public.member_cash_transactions_deleted
FOR EACH ROW EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER no_archive_truncate BEFORE TRUNCATE ON public.member_cash_transactions_deleted
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE INDEX ix_member_cash_transactions_deleted_original ON public.member_cash_transactions_deleted(member_transaction_id);
CREATE INDEX ix_member_cash_transactions_deleted_actor ON public.member_cash_transactions_deleted(deleted_by);
CREATE TRIGGER a_guard_id BEFORE INSERT OR UPDATE ON public.clubhouse_cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_source_id('clubhouse_transaction_id','clubhouse_cash_transactions');
CREATE TRIGGER archive_on_delete AFTER DELETE ON public.clubhouse_cash_transactions
REFERENCING OLD TABLE AS old_deleted FOR EACH STATEMENT
EXECUTE FUNCTION public.archive_deleted_statement('clubhouse_cash_transactions');
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.clubhouse_cash_transactions
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.clubhouse_cash_transactions_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();
CREATE TRIGGER prevent_archive_delete BEFORE DELETE ON public.clubhouse_cash_transactions_deleted
FOR EACH ROW EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER no_archive_truncate BEFORE TRUNCATE ON public.clubhouse_cash_transactions_deleted
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE INDEX ix_clubhouse_cash_transactions_deleted_original ON public.clubhouse_cash_transactions_deleted(clubhouse_transaction_id);
CREATE INDEX ix_clubhouse_cash_transactions_deleted_actor ON public.clubhouse_cash_transactions_deleted(deleted_by);
CREATE TRIGGER a_guard_id BEFORE INSERT OR UPDATE ON public.cashflow
FOR EACH ROW EXECUTE FUNCTION public.guard_source_id('cashflow_id','cashflow');
CREATE TRIGGER archive_on_delete AFTER DELETE ON public.cashflow
REFERENCING OLD TABLE AS old_deleted FOR EACH STATEMENT
EXECUTE FUNCTION public.archive_deleted_statement('cashflow');
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.cashflow
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.cashflow_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();
CREATE TRIGGER prevent_archive_delete BEFORE DELETE ON public.cashflow_deleted
FOR EACH ROW EXECUTE FUNCTION public.block_history_delete();
CREATE TRIGGER no_archive_truncate BEFORE TRUNCATE ON public.cashflow_deleted
FOR EACH STATEMENT EXECUTE FUNCTION public.block_history_delete();
CREATE INDEX ix_cashflow_deleted_original ON public.cashflow_deleted(cashflow_id);
CREATE INDEX ix_cashflow_deleted_actor ON public.cashflow_deleted(deleted_by);


-- Serialize opening-balance and transaction writes per real owner.
CREATE FUNCTION public.validate_financial_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE baseline date; old_owner uuid; new_owner uuid; owner_ids uuid[];
BEGIN
    IF NEW.transaction_type NOT IN ('deposit','purchase') THEN
        RAISE EXCEPTION 'Unsupported sign rule for transaction_type.' USING ERRCODE='23514';
    END IF;
    IF TG_ARGV[0]='member' THEN
        new_owner:=NEW.member_id;
        IF TG_OP='UPDATE' THEN old_owner:=OLD.member_id; END IF;
        owner_ids:=ARRAY[new_owner,old_owner];
        PERFORM member_id FROM public.members WHERE member_id=ANY(owner_ids) ORDER BY member_id FOR UPDATE;
        SELECT balance_date INTO baseline FROM public.cash_opening_balances
        WHERE member_id=new_owner AND currency=NEW.currency;
    ELSE
        new_owner:=NEW.clubhouse_id;
        IF TG_OP='UPDATE' THEN old_owner:=OLD.clubhouse_id; END IF;
        owner_ids:=ARRAY[new_owner,old_owner];
        PERFORM clubhouse_id FROM public.clubhouses WHERE clubhouse_id=ANY(owner_ids) ORDER BY clubhouse_id FOR UPDATE;
        SELECT balance_date INTO baseline FROM public.cash_opening_balances
        WHERE clubhouse_id=new_owner AND currency=NEW.currency;
    END IF;
    IF baseline IS NOT NULL AND NEW.transaction_date < baseline THEN
        RAISE EXCEPTION 'Transaction predates the initial opening balance; review the baseline before importing it.'
            USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $fn$;
CREATE TRIGGER b_validate_finance BEFORE INSERT OR UPDATE ON public.member_cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_financial_transaction('member');
CREATE TRIGGER b_validate_finance BEFORE INSERT OR UPDATE ON public.clubhouse_cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_financial_transaction('clubhouse');

CREATE FUNCTION public.validate_opening_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE earliest date;
BEGIN
    IF TG_OP='UPDATE' AND
       (NEW.opening_balance_id,NEW.clubhouse_id,NEW.member_id,NEW.currency,NEW.balance_date)
       IS DISTINCT FROM (OLD.opening_balance_id,OLD.clubhouse_id,OLD.member_id,OLD.currency,OLD.balance_date) THEN
        RAISE EXCEPTION 'Opening-balance identity, owner, currency and date are immutable.' USING ERRCODE='23514';
    END IF;
    IF NEW.member_id IS NOT NULL THEN
        PERFORM member_id FROM public.members WHERE member_id=NEW.member_id FOR UPDATE;
        SELECT min(transaction_date) INTO earliest FROM public.member_cash_transactions
        WHERE member_id=NEW.member_id AND currency=NEW.currency;
    ELSE
        PERFORM clubhouse_id FROM public.clubhouses WHERE clubhouse_id=NEW.clubhouse_id FOR UPDATE;
        SELECT min(transaction_date) INTO earliest FROM public.clubhouse_cash_transactions
        WHERE clubhouse_id=NEW.clubhouse_id AND currency=NEW.currency;
    END IF;
    IF earliest IS NOT NULL AND NEW.balance_date > earliest THEN
        RAISE EXCEPTION 'Initial balance must be dated no later than the first imported transaction.'
            USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $fn$;
CREATE TRIGGER validate_opening BEFORE INSERT OR UPDATE ON public.cash_opening_balances
FOR EACH ROW EXECUTE FUNCTION public.validate_opening_balance();

-- Initial balance = start of balance_date; cashflow = end of cashflow_date.
-- The two transaction types are deposit (+) and purchase (-). Currencies never mix.
CREATE FUNCTION public.calculated_cash_balance(p_clubhouse uuid,p_total smallint,p_currency text,p_day date)
RETURNS TABLE(computed_balance numeric,owners_count bigint,missing_openings bigint)
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $fn$
DECLARE base public.cash_opening_balances%ROWTYPE;
BEGIN
    IF p_total=1 THEN
        SELECT * INTO base FROM public.cash_opening_balances
        WHERE clubhouse_id=p_clubhouse AND currency=p_currency AND balance_date<=p_day;
        IF NOT FOUND THEN RETURN QUERY SELECT NULL::numeric,1::bigint,1::bigint; RETURN; END IF;
        RETURN QUERY SELECT base.amount+coalesce(sum(CASE t.transaction_type WHEN 'deposit' THEN t.amount ELSE -t.amount END),0),
                            1::bigint,0::bigint
        FROM public.clubhouse_cash_transactions t
        WHERE t.clubhouse_id=p_clubhouse AND t.currency=p_currency
          AND t.transaction_date BETWEEN base.balance_date AND p_day;
    ELSIF p_total=2 THEN
        RETURN QUERY
        WITH relevant AS (
            SELECT o.member_id FROM public.cash_opening_balances o JOIN public.members m USING(member_id)
            WHERE m.clubhouse_id=p_clubhouse AND o.currency=p_currency AND o.balance_date<=p_day
            UNION
            SELECT t.member_id FROM public.member_cash_transactions t JOIN public.members m USING(member_id)
            WHERE m.clubhouse_id=p_clubhouse AND t.currency=p_currency AND t.transaction_date<=p_day
        ), amounts AS (
            SELECT r.member_id,o.amount,
              (SELECT coalesce(sum(CASE t.transaction_type WHEN 'deposit' THEN t.amount ELSE -t.amount END),0)
               FROM public.member_cash_transactions t
               WHERE t.member_id=r.member_id AND t.currency=p_currency
                 AND t.transaction_date BETWEEN o.balance_date AND p_day) AS net
            FROM relevant r LEFT JOIN public.cash_opening_balances o
              ON o.member_id=r.member_id AND o.currency=p_currency AND o.balance_date<=p_day
        )
        SELECT CASE WHEN count(*)=0 OR count(*) FILTER(WHERE amount IS NULL)>0 THEN NULL::numeric
                    ELSE sum(amount+net) END,
               count(*),
               CASE WHEN count(*)=0 THEN 1::bigint ELSE count(*) FILTER(WHERE amount IS NULL) END
        FROM amounts;
    ELSE RAISE EXCEPTION 'Unknown cash_total_id: %',p_total USING ERRCODE='23514'; END IF;
END $fn$;

CREATE VIEW public.finance_reconciliation AS
WITH points AS (
    SELECT clubhouse_id,cash_total_id,currency,cashflow_date AS balance_date FROM public.cashflow
    UNION
    SELECT clubhouse_id,1::smallint,currency,transaction_date FROM public.clubhouse_cash_transactions
    UNION
    SELECT m.clubhouse_id,2::smallint,t.currency,t.transaction_date
      FROM public.member_cash_transactions t JOIN public.members m USING(member_id)
    UNION
    SELECT coalesce(o.clubhouse_id,m.clubhouse_id),
           CASE WHEN o.clubhouse_id IS NOT NULL THEN 1::smallint ELSE 2::smallint END,
           o.currency,o.balance_date
      FROM public.cash_opening_balances o LEFT JOIN public.members m USING(member_id)
)
SELECT p.*,b.computed_balance,c.amount AS recorded_balance,
       c.amount-b.computed_balance AS difference,b.owners_count,b.missing_openings,
       CASE WHEN b.missing_openings>0 THEN 'missing_opening_balance'
            WHEN c.cashflow_id IS NULL THEN 'missing_cashflow'
            WHEN c.amount=b.computed_balance THEN 'ok' ELSE 'balance_mismatch' END AS reconciliation_status,
       (p.cash_total_id=2 AND EXISTS(
          SELECT 1 FROM public.member_clubhouse_history h
          WHERE (h.old_clubhouse_id=p.clubhouse_id OR h.new_clubhouse_id=p.clubhouse_id)
            AND (h.transferred_at AT TIME ZONE cl.timezone)::date>=p.balance_date
       )) AS transfer_may_affect_history
FROM points p JOIN public.clubhouses cl USING(clubhouse_id)
CROSS JOIN LATERAL public.calculated_cash_balance(p.clubhouse_id,p.cash_total_id,p.currency,p.balance_date) b
LEFT JOIN public.cashflow c ON c.clubhouse_id=p.clubhouse_id AND c.cash_total_id=p.cash_total_id
 AND c.currency=p.currency AND c.cashflow_date=p.balance_date;
CREATE VIEW public.finance_reconciliation_issues AS
SELECT * FROM public.finance_reconciliation WHERE reconciliation_status<>'ok';


-- Prevent new associated personal content after a person has been redacted.
CREATE FUNCTION public.guard_redacted_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE redacted timestamptz; member_owner uuid; staff_owner uuid;
BEGIN
    IF TG_ARGV[0]='emergency_contacts' THEN member_owner:=NEW.member_id;
    ELSIF TG_ARGV[0]='phone_calls' THEN
        IF NEW.person_type='member' THEN member_owner:=NEW.person_id; ELSE staff_owner:=NEW.person_id; END IF;
    ELSIF TG_ARGV[0]='member_cash_transactions' THEN member_owner:=NEW.member_id; staff_owner:=NEW.recorded_by;
    ELSE staff_owner:=NEW.recorded_by; END IF;
    IF member_owner IS NOT NULL THEN
        SELECT anonymized_at INTO redacted FROM public.members WHERE member_id=member_owner FOR KEY SHARE;
        IF redacted IS NOT NULL AND (TG_ARGV[0]='emergency_contacts' OR (to_jsonb(NEW)->>'note') IS NOT NULL) THEN
            RAISE EXCEPTION 'Do not add contacts or free-text notes to a redacted person.' USING ERRCODE='23514';
        END IF;
    END IF;
    IF staff_owner IS NOT NULL THEN
        SELECT anonymized_at INTO redacted FROM public.staff WHERE staff_id=staff_owner FOR KEY SHARE;
        IF redacted IS NOT NULL AND (to_jsonb(NEW)->>'note') IS NOT NULL THEN
            RAISE EXCEPTION 'Do not add notes associated with a redacted staff member.' USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END $fn$;
CREATE TRIGGER c_guard_redacted_content BEFORE INSERT OR UPDATE ON public.emergency_contacts
FOR EACH ROW EXECUTE FUNCTION public.guard_redacted_content('emergency_contacts');
CREATE TRIGGER c_guard_redacted_content BEFORE INSERT OR UPDATE ON public.phone_calls
FOR EACH ROW EXECUTE FUNCTION public.guard_redacted_content('phone_calls');
CREATE TRIGGER c_guard_redacted_content BEFORE INSERT OR UPDATE ON public.member_cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_redacted_content('member_cash_transactions');
CREATE TRIGGER c_guard_redacted_content BEFORE INSERT OR UPDATE ON public.clubhouse_cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_redacted_content('clubhouse_cash_transactions');
CREATE TRIGGER c_guard_redacted_content BEFORE INSERT OR UPDATE ON public.cashflow
FOR EACH ROW EXECUTE FUNCTION public.guard_redacted_content('cashflow');

-- Controlled pseudonymisation, NOT a legal guarantee of irreversible anonymity.
-- Owner-only. No scheduler is installed. Requires explicit confirmation and an ended relationship.
CREATE PROCEDURE public.redact_person(p_kind text,p_id uuid,p_confirmation text,p_reason_code text DEFAULT 'manual_request')
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,prometheus_private AS $fn$
DECLARE opaque_code text:='ANON_'||replace(gen_random_uuid()::text,'-','');
        ended date; today date; exists_person boolean; archive_name text; cond text; sets text;
BEGIN
    IF p_confirmation IS DISTINCT FROM 'CONFIRM_PSEUDONYMIZATION' OR p_kind IS NULL OR p_kind NOT IN ('members','staff')
       OR p_id IS NULL OR p_reason_code IS NULL OR p_reason_code !~ '^[a-z0-9_:-]{1,64}$' THEN
        RAISE EXCEPTION 'Supply a valid kind/UUID, explicit confirmation and a non-personal reason code.'
            USING ERRCODE='23514';
    END IF;
    IF p_kind='members' THEN
        SELECT m.leave_date,(statement_timestamp() AT TIME ZONE c.timezone)::date,
               CASE WHEN m.anonymized_at IS NOT NULL THEN m.member_code ELSE opaque_code END
          INTO ended,today,opaque_code
        FROM public.members m JOIN public.clubhouses c USING(clubhouse_id)
        WHERE m.member_id=p_id FOR UPDATE OF m;
        exists_person:=FOUND;
        IF NOT exists_person THEN
            SELECT leave_date,current_date,CASE WHEN anonymized_at IS NOT NULL THEN member_code
                                                ELSE 'ANON_'||replace(gen_random_uuid()::text,'-','') END
              INTO ended,today,opaque_code FROM public.members_deleted WHERE member_id=p_id LIMIT 1;
            exists_person:=FOUND;
        END IF;
    ELSE
        SELECT s.end_date,(statement_timestamp() AT TIME ZONE c.timezone)::date,
               CASE WHEN s.anonymized_at IS NOT NULL THEN s.staff_code ELSE opaque_code END
          INTO ended,today,opaque_code
        FROM public.staff s JOIN public.clubhouses c USING(clubhouse_id)
        WHERE s.staff_id=p_id FOR UPDATE OF s;
        exists_person:=FOUND;
        IF NOT exists_person THEN
            SELECT end_date,current_date,CASE WHEN anonymized_at IS NOT NULL THEN staff_code
                                              ELSE 'ANON_'||replace(gen_random_uuid()::text,'-','') END
              INTO ended,today,opaque_code FROM public.staff_deleted WHERE staff_id=p_id LIMIT 1;
            exists_person:=FOUND;
        END IF;
    END IF;
    IF NOT exists_person THEN RAISE EXCEPTION 'Person was not found.' USING ERRCODE='23503'; END IF;
    IF ended IS NULL OR ended>today THEN
        RAISE EXCEPTION 'Set leave_date/end_date to an ended relationship before redaction.' USING ERRCODE='23514';
    END IF;
    INSERT INTO prometheus_private.redaction_context VALUES(txid_current(),p_kind,p_id);
    IF p_kind='members' THEN
        UPDATE public.members SET first_name=NULL,last_name=NULL,date_of_birth=NULL,salutation=NULL,
          gender=NULL,phone=NULL,email=NULL,street_address=NULL,postal_code=NULL,city=NULL,country=NULL,
          member_code=opaque_code,anonymized_at=coalesce(anonymized_at,clock_timestamp()) WHERE member_id=p_id;
        DELETE FROM public.emergency_contacts WHERE member_id=p_id;
        UPDATE public.members_deleted SET first_name=NULL,last_name=NULL,date_of_birth=NULL,salutation=NULL,
          gender=NULL,phone=NULL,email=NULL,street_address=NULL,postal_code=NULL,city=NULL,country=NULL,
          member_code=opaque_code,anonymized_at=coalesce(anonymized_at,clock_timestamp()),deletion_reason=NULL WHERE member_id=p_id;
        UPDATE public.emergency_contacts_deleted SET name=NULL,phone=NULL,relationship=NULL,
          deletion_reason=NULL WHERE member_id=p_id;
        UPDATE public.phone_calls SET note=NULL WHERE person_type='member' AND person_id=p_id;
        UPDATE public.member_cash_transactions SET note=NULL WHERE member_id=p_id;
        UPDATE public.cash_opening_balances SET source_reference='redacted_reference' WHERE member_id=p_id;
    ELSE
        UPDATE public.staff SET first_name=NULL,last_name=NULL,email=NULL,staff_code=opaque_code,
          staff_status='inactive',anonymized_at=coalesce(anonymized_at,clock_timestamp()) WHERE staff_id=p_id;
        UPDATE public.staff_deleted SET first_name=NULL,last_name=NULL,email=NULL,staff_code=opaque_code,
          anonymized_at=coalesce(anonymized_at,clock_timestamp()),deletion_reason=NULL WHERE staff_id=p_id;
        UPDATE public.phone_calls SET note=NULL WHERE person_type='staff' AND person_id=p_id;
        UPDATE public.member_cash_transactions SET note=NULL WHERE recorded_by=p_id;
        UPDATE public.clubhouse_cash_transactions SET note=NULL WHERE recorded_by=p_id;
        UPDATE public.cashflow SET note=NULL WHERE recorded_by=p_id;
        UPDATE public.cash_opening_balances SET source_reference='redacted_reference' WHERE recorded_by=p_id;
    END IF;
    -- Clear related notes and deletion reasons without changing monetary history or UUID links.
    FOREACH archive_name IN ARRAY ARRAY['members_deleted','staff_deleted','attendance_deleted',
       'emergency_contacts_deleted','phone_calls_deleted','member_cash_transactions_deleted',
       'clubhouse_cash_transactions_deleted','cashflow_deleted'] LOOP
        cond:='false'; sets:='deletion_reason=NULL';
        IF p_kind='members' THEN
            IF archive_name IN ('members_deleted','attendance_deleted','emergency_contacts_deleted','member_cash_transactions_deleted') THEN
                cond:='member_id=$1';
            ELSIF archive_name='phone_calls_deleted' THEN cond:='person_type=''member'' AND person_id=$1'; END IF;
        ELSE
            cond:='deleted_by=$1';
            IF archive_name='staff_deleted' THEN cond:=cond||' OR staff_id=$1';
            ELSIF archive_name='phone_calls_deleted' THEN cond:=cond||' OR (person_type=''staff'' AND person_id=$1)';
            ELSIF archive_name IN ('member_cash_transactions_deleted','clubhouse_cash_transactions_deleted','cashflow_deleted') THEN
                cond:=cond||' OR recorded_by=$1';
            END IF;
        END IF;
        IF archive_name IN ('phone_calls_deleted','member_cash_transactions_deleted','clubhouse_cash_transactions_deleted','cashflow_deleted')
        THEN sets:=sets||',note=NULL'; END IF;
        EXECUTE format('UPDATE public.%I SET %s WHERE %s',archive_name,sets,cond) USING p_id;
    END LOOP;
    INSERT INTO public.privacy_events(entity,person_id,reason_code) VALUES(p_kind,p_id,p_reason_code);
    DELETE FROM prometheus_private.redaction_context
    WHERE transaction_id=txid_current() AND person_kind=p_kind AND person_id=p_id;
END $fn$;
REVOKE ALL ON PROCEDURE public.redact_person(text,uuid,text,text) FROM PUBLIC;

-- Retention periods are intentionally NULL and unapproved. Read-only preview only.
CREATE VIEW public.retention_candidates AS
SELECT 'members'::text AS entity,m.member_id AS record_id,m.member_id AS person_id,
       (m.leave_date+make_interval(months=>p.retention_months))::date AS eligible_on,
       'pseudonymize_person'::text AS proposed_action,p.approval_reference
FROM public.members m JOIN public.retention_policy p ON p.entity='members'
JOIN public.clubhouses c USING(clubhouse_id)
WHERE p.approved AND m.leave_date IS NOT NULL AND m.anonymized_at IS NULL
 AND (m.leave_date+make_interval(months=>p.retention_months))::date
     <=(statement_timestamp() AT TIME ZONE c.timezone)::date
UNION ALL
SELECT 'staff',s.staff_id,s.staff_id,(s.end_date+make_interval(months=>p.retention_months))::date,
       'pseudonymize_person',p.approval_reference
FROM public.staff s JOIN public.retention_policy p ON p.entity='staff'
JOIN public.clubhouses c USING(clubhouse_id)
WHERE p.approved AND s.end_date IS NOT NULL AND s.anonymized_at IS NULL
 AND (s.end_date+make_interval(months=>p.retention_months))::date
     <=(statement_timestamp() AT TIME ZONE c.timezone)::date
UNION ALL
SELECT 'emergency_contacts',e.contact_id,e.member_id,
       (m.leave_date+make_interval(months=>p.retention_months))::date,'review_contact_redaction',p.approval_reference
FROM public.emergency_contacts e JOIN public.members m USING(member_id)
JOIN public.retention_policy p ON p.entity='emergency_contacts'
JOIN public.clubhouses c USING(clubhouse_id)
WHERE p.approved AND m.leave_date IS NOT NULL
 AND (m.leave_date+make_interval(months=>p.retention_months))::date
     <=(statement_timestamp() AT TIME ZONE c.timezone)::date
UNION ALL
SELECT 'phone_call_notes',t.call_id,t.person_id,
       (t.call_date+make_interval(months=>p.retention_months))::date,'review_note_redaction',p.approval_reference
FROM public.phone_calls t JOIN public.retention_policy p ON p.entity='phone_call_notes'
WHERE p.approved AND t.note IS NOT NULL
 AND (t.call_date+make_interval(months=>p.retention_months))::date<=current_date;


-- Add supporting indexes for remaining single-column FKs, including retained lookup references.
DO $fk_indexes$
DECLARE f record;
BEGIN
    FOR f IN SELECT c.conrelid,n.nspname,t.relname,a.attname
        FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
        JOIN pg_namespace n ON n.oid=t.relnamespace
        JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=c.conkey[1]
        WHERE c.contype='f' AND n.nspname='public' AND NOT t.relispartition
          AND cardinality(c.conkey)=1
          AND NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=t.oid
                         AND i.indisvalid AND i.indpred IS NULL AND i.indkey[0]=c.conkey[1])
    LOOP
        EXECUTE format('CREATE INDEX %I ON %I.%I(%I)',
            'ix_fk_'||f.relname||'_'||f.attname,f.nspname,f.relname,f.attname);
    END LOOP;
END $fk_indexes$;
-- No table privileges are granted to PUBLIC. Give the backend explicit parent-table privileges,
-- not owner/superuser membership or direct monthly-partition writes.
-- Trigger functions are not an application API.
DO $privileges$
DECLARE r record;
BEGIN
    FOR r IN SELECT p.oid::regprocedure AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.prorettype='trigger'::regtype LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',r.fn);
    END LOOP;
END $privileges$;
REVOKE ALL ON ALL TABLES IN SCHEMA prometheus_private FROM PUBLIC;
REVOKE ALL ON FUNCTION public.code_name_part(text) FROM PUBLIC;
REVOKE ALL ON PROCEDURE public.refresh_member_status_cache() FROM PUBLIC;
COMMENT ON TABLE public.cashflow IS 'End-of-day observed cash balances; never silently recomputed on member transfer.';
COMMENT ON TABLE public.cash_opening_balances IS 'Initial start-of-day balance per owner/currency; missing is unknown, not zero.';
COMMENT ON TABLE public.accounts IS 'Populate with client-approved account codes before clubhouse transactions.';
COMMENT ON TABLE public.retention_policy IS 'Unapproved/disabled by default. No automatic destructive retention job.';
COMMENT ON TABLE public.member_clubhouse_history IS 'Transfer metadata; member financial history intentionally follows current clubhouse.';
COMMENT ON COLUMN public.members.anonymized_at IS 'Technical pseudonymisation marker; retained UUID links are not proof of irreversible anonymity.';
COMMENT ON COLUMN public.staff.anonymized_at IS 'Technical pseudonymisation marker; not a legal anonymity guarantee.';
COMMENT ON COLUMN public.members.membership_status IS 'Calculated cache. Read members_current for current clubhouse-local status.';
COMMENT ON COLUMN public.members.activity_status IS 'Calculated cache. Read members_current for current clubhouse-local status.';
COMMENT ON COLUMN public.phone_calls.member_reference_id IS 'Internal generated FK. Omit from INSERT/UPDATE and UI.';
COMMENT ON COLUMN public.phone_calls.staff_reference_id IS 'Internal generated FK. Omit from INSERT/UPDATE and UI.';
COMMENT ON COLUMN public.clubhouse_cash_transactions.month IS 'Generated first day of transaction month; omit from INSERT/UPDATE.';
COMMENT ON VIEW public.finance_reconciliation IS 'Read-only balance comparison; unknown baseline yields NULL, not a fabricated zero.';
COMMENT ON VIEW public.retention_candidates IS 'Read-only approved-policy preview. Does not remove or redact records.';
COMMIT;
SELECT current_database() AS database_name,'Redi installation complete' AS result;

