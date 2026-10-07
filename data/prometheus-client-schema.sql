-- Prometheus: client schema + retained business rules
-- PostgreSQL 17+. UTF-8. Execute the ENTIRE file as a script in DBeaver.
-- Fresh installation in public. Existing target objects cause a rollback.
-- This file never drops old German tables and does not migrate their data.
-- Sources: Clubhaus_Schema.xlsx / Clubhaus_Schema_Diagram.pdf (2026-09-27)
--          Prometheus_Data_Architecture_v0.1.xlsx / prometheus-schema.sql
-- See README_RU.md for decisions, field mapping, scheduling and deletion context.

BEGIN;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '15s';

DO $preflight$
DECLARE v_name text;
BEGIN
    FOREACH v_name IN ARRAY ARRAY['clubhouses', 'members', 'staff', 'staff_clubhouses', 'attendance', 'emergency_contacts', 'phone_calls', 'cash_transactions', 'cash_transactions_deleted', 'salutations', 'genders', 'activity_statuses', 'membership_statuses', 'contact_relationships', 'caller_types', 'call_topics', 'cash_transaction_types', 'currencies', 'clubhouse_statuses', 'countries', 'languages', 'translations', 'members_deleted', 'staff_deleted', 'attendance_deleted', 'emergency_contacts_deleted', 'phone_calls_deleted', 'members_current', 'lookup_labels']
    LOOP
        IF to_regclass(format('public.%I', v_name)) IS NOT NULL THEN
            RAISE EXCEPTION 'Object public.% already exists. Use a new database or a reviewed migration.', v_name;
        END IF;
    END LOOP;
END
$preflight$;

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
-- Avoid silently depending on an extension installed under another schema.
DO $extension_check$
BEGIN
    IF to_regprocedure('public.unaccent(text)') IS NULL THEN
        RAISE EXCEPTION 'unaccent must be installed in public for this installation.';
    END IF;
END
$extension_check$;

-- 1. Lookup tables (client codes and labels).

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

-- 2. Main tables, with native foreign keys.

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
    first_name text NOT NULL,
    last_name text NOT NULL,
    date_of_birth date NOT NULL,
    join_date date NOT NULL,
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
    CONSTRAINT ck_members_first_name_not_blank CHECK (btrim(first_name) <> ''),
    CONSTRAINT ck_members_last_name_not_blank CHECK (btrim(last_name) <> '')
);

CREATE TABLE public.staff (
    staff_id uuid NOT NULL DEFAULT gen_random_uuid(),
    staff_code text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    role text NOT NULL,
    email text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_staff PRIMARY KEY (staff_id),
    CONSTRAINT uq_staff_staff_code UNIQUE (staff_code),
    CONSTRAINT uq_staff_email UNIQUE (email),
    CONSTRAINT ck_staff_first_name_not_blank CHECK (btrim(first_name) <> ''),
    CONSTRAINT ck_staff_last_name_not_blank CHECK (btrim(last_name) <> ''),
    CONSTRAINT ck_staff_role_not_blank CHECK (btrim(role) <> '')
);

CREATE TABLE public.staff_clubhouses (
    staff_id uuid NOT NULL,
    clubhouse_id uuid NOT NULL,
    is_primary boolean NOT NULL DEFAULT false,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_staff_clubhouses_staff_id FOREIGN KEY (staff_id)
        REFERENCES public.staff (staff_id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT fk_staff_clubhouses_clubhouse_id FOREIGN KEY (clubhouse_id)
        REFERENCES public.clubhouses (clubhouse_id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT pk_staff_clubhouses PRIMARY KEY (staff_id, clubhouse_id)
);

CREATE TABLE public.attendance (
    attendance_id uuid NOT NULL DEFAULT gen_random_uuid(),
    member_id uuid NOT NULL,
    attendance_date date NOT NULL,
    time_in time NOT NULL,
    time_out time,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_attendance PRIMARY KEY (attendance_id),
    CONSTRAINT fk_attendance_member_id FOREIGN KEY (member_id)
        REFERENCES public.members (member_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT ck_attendance_times CHECK (time_out IS NULL OR time_out >= time_in)
);

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
    CONSTRAINT pk_phone_calls PRIMARY KEY (call_id),
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
);

CREATE TABLE public.cash_transactions (
    transaction_id uuid NOT NULL DEFAULT gen_random_uuid(),
    member_id uuid NOT NULL,
    transaction_date date NOT NULL,
    transaction_type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text NOT NULL,
    recorded_by uuid NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_cash_transactions PRIMARY KEY (transaction_id),
    CONSTRAINT fk_cash_transactions_member_id FOREIGN KEY (member_id)
        REFERENCES public.members (member_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_cash_transactions_transaction_type FOREIGN KEY (transaction_type)
        REFERENCES public.cash_transaction_types (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_cash_transactions_currency FOREIGN KEY (currency)
        REFERENCES public.currencies (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_cash_transactions_recorded_by FOREIGN KEY (recorded_by)
        REFERENCES public.staff (staff_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT ck_cash_transactions_amount CHECK (amount > 0 AND amount <> 'NaN'::numeric)
);

-- 3. Localization. Internal generated columns make the generic target enforceable.

CREATE TABLE public.translations (
    table_name text NOT NULL,
    code text NOT NULL,
    language_code text NOT NULL,
    label text NOT NULL CHECK (btrim(label) <> ''),
    CONSTRAINT pk_translations PRIMARY KEY (table_name, code, language_code),
    CONSTRAINT fk_translations_language FOREIGN KEY (language_code) REFERENCES public.languages (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT ck_translations_table CHECK (table_name IN ('salutations', 'genders', 'activity_statuses', 'membership_statuses', 'contact_relationships', 'caller_types', 'call_topics', 'cash_transaction_types', 'currencies', 'clubhouse_statuses', 'countries', 'languages')),
    ref_salutations text GENERATED ALWAYS AS (CASE WHEN table_name = 'salutations' THEN code END) STORED,
    CONSTRAINT fk_translations_salutations FOREIGN KEY (ref_salutations) REFERENCES public.salutations (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    ref_genders text GENERATED ALWAYS AS (CASE WHEN table_name = 'genders' THEN code END) STORED,
    CONSTRAINT fk_translations_genders FOREIGN KEY (ref_genders) REFERENCES public.genders (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    ref_activity_statuses text GENERATED ALWAYS AS (CASE WHEN table_name = 'activity_statuses' THEN code END) STORED,
    CONSTRAINT fk_translations_activity_statuses FOREIGN KEY (ref_activity_statuses) REFERENCES public.activity_statuses (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    ref_membership_statuses text GENERATED ALWAYS AS (CASE WHEN table_name = 'membership_statuses' THEN code END) STORED,
    CONSTRAINT fk_translations_membership_statuses FOREIGN KEY (ref_membership_statuses) REFERENCES public.membership_statuses (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    ref_contact_relationships text GENERATED ALWAYS AS (CASE WHEN table_name = 'contact_relationships' THEN code END) STORED,
    CONSTRAINT fk_translations_contact_relationships FOREIGN KEY (ref_contact_relationships) REFERENCES public.contact_relationships (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    ref_caller_types text GENERATED ALWAYS AS (CASE WHEN table_name = 'caller_types' THEN code END) STORED,
    CONSTRAINT fk_translations_caller_types FOREIGN KEY (ref_caller_types) REFERENCES public.caller_types (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    ref_call_topics integer GENERATED ALWAYS AS (CASE WHEN table_name = 'call_topics' THEN code::integer END) STORED,
    CONSTRAINT fk_translations_call_topics FOREIGN KEY (ref_call_topics) REFERENCES public.call_topics (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    ref_cash_transaction_types text GENERATED ALWAYS AS (CASE WHEN table_name = 'cash_transaction_types' THEN code END) STORED,
    CONSTRAINT fk_translations_cash_transaction_types FOREIGN KEY (ref_cash_transaction_types) REFERENCES public.cash_transaction_types (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    ref_currencies text GENERATED ALWAYS AS (CASE WHEN table_name = 'currencies' THEN code END) STORED,
    CONSTRAINT fk_translations_currencies FOREIGN KEY (ref_currencies) REFERENCES public.currencies (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    ref_clubhouse_statuses text GENERATED ALWAYS AS (CASE WHEN table_name = 'clubhouse_statuses' THEN code END) STORED,
    CONSTRAINT fk_translations_clubhouse_statuses FOREIGN KEY (ref_clubhouse_statuses) REFERENCES public.clubhouse_statuses (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    ref_countries text GENERATED ALWAYS AS (CASE WHEN table_name = 'countries' THEN code END) STORED,
    CONSTRAINT fk_translations_countries FOREIGN KEY (ref_countries) REFERENCES public.countries (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    ref_languages text GENERATED ALWAYS AS (CASE WHEN table_name = 'languages' THEN code END) STORED,
    CONSTRAINT fk_translations_languages FOREIGN KEY (ref_languages) REFERENCES public.languages (code) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT ck_translations_topic_code CHECK (table_name <> 'call_topics' OR code ~ '^[1-9][0-9]*$')
);

-- 4. Deletion history. Only deleted_by is a live foreign key.

CREATE TABLE public.cash_transactions_deleted (
    archive_id uuid NOT NULL DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT now(),
    deleted_by uuid,
    deletion_reason text,
    transaction_id uuid NOT NULL,
    member_id uuid NOT NULL,
    transaction_date date NOT NULL,
    transaction_type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text NOT NULL,
    recorded_by uuid NOT NULL,
    note text,
    original_created_at timestamptz NOT NULL,
    CONSTRAINT pk_cash_transactions_deleted PRIMARY KEY (archive_id),
    CONSTRAINT fk_cash_transactions_deleted_deleted_by FOREIGN KEY (deleted_by) REFERENCES public.staff (staff_id) ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE TABLE public.members_deleted (
    archive_id uuid NOT NULL DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT now(),
    deleted_by uuid,
    deletion_reason text,
    member_id uuid NOT NULL,
    clubhouse_id uuid NOT NULL,
    member_code text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    date_of_birth date NOT NULL,
    join_date date NOT NULL,
    membership_status text NOT NULL,
    salutation text,
    gender text,
    phone text,
    email text,
    street_address text,
    postal_code text,
    city text,
    activity_status text,
    original_created_at timestamptz NOT NULL,
    original_updated_at timestamptz NOT NULL,
    country text,
    CONSTRAINT pk_members_deleted PRIMARY KEY (archive_id),
    CONSTRAINT fk_members_deleted_deleted_by FOREIGN KEY (deleted_by) REFERENCES public.staff (staff_id) ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE TABLE public.staff_deleted (
    archive_id uuid NOT NULL DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT now(),
    deleted_by uuid,
    deletion_reason text,
    staff_id uuid NOT NULL,
    staff_code text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    role text NOT NULL,
    email text,
    active boolean NOT NULL,
    original_created_at timestamptz NOT NULL,
    original_updated_at timestamptz NOT NULL,
    CONSTRAINT pk_staff_deleted PRIMARY KEY (archive_id),
    CONSTRAINT fk_staff_deleted_deleted_by FOREIGN KEY (deleted_by) REFERENCES public.staff (staff_id) ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE TABLE public.attendance_deleted (
    archive_id uuid NOT NULL DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT now(),
    deleted_by uuid,
    deletion_reason text,
    attendance_id uuid NOT NULL,
    member_id uuid NOT NULL,
    attendance_date date NOT NULL,
    time_in time NOT NULL,
    time_out time,
    original_created_at timestamptz NOT NULL,
    CONSTRAINT pk_attendance_deleted PRIMARY KEY (archive_id),
    CONSTRAINT fk_attendance_deleted_deleted_by FOREIGN KEY (deleted_by) REFERENCES public.staff (staff_id) ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE TABLE public.emergency_contacts_deleted (
    archive_id uuid NOT NULL DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT now(),
    deleted_by uuid,
    deletion_reason text,
    contact_id uuid NOT NULL,
    member_id uuid NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    relationship text,
    original_created_at timestamptz NOT NULL,
    CONSTRAINT pk_emergency_contacts_deleted PRIMARY KEY (archive_id),
    CONSTRAINT fk_emergency_contacts_deleted_deleted_by FOREIGN KEY (deleted_by) REFERENCES public.staff (staff_id) ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE TABLE public.phone_calls_deleted (
    archive_id uuid NOT NULL DEFAULT gen_random_uuid(),
    deleted_at timestamptz NOT NULL DEFAULT now(),
    deleted_by uuid,
    deletion_reason text,
    call_id uuid NOT NULL,
    person_id uuid NOT NULL,
    person_type text NOT NULL,
    call_date date NOT NULL,
    duration_minutes integer NOT NULL,
    topic_code integer NOT NULL,
    note text,
    original_created_at timestamptz NOT NULL,
    CONSTRAINT pk_phone_calls_deleted PRIMARY KEY (archive_id),
    CONSTRAINT fk_phone_calls_deleted_deleted_by FOREIGN KEY (deleted_by) REFERENCES public.staff (staff_id) ON DELETE SET NULL ON UPDATE NO ACTION
);

-- 5. Indexes: unique constraints already create their own indexes.
CREATE UNIQUE INDEX uq_staff_primary_clubhouse ON public.staff_clubhouses (staff_id) WHERE is_primary;
CREATE INDEX ix_members_clubhouse_id ON public.members (clubhouse_id);
CREATE INDEX ix_staff_clubhouses_clubhouse_id ON public.staff_clubhouses (clubhouse_id);
CREATE INDEX ix_attendance_member_id ON public.attendance (member_id, attendance_date DESC);
CREATE INDEX ix_emergency_contacts_member_id ON public.emergency_contacts (member_id);
CREATE INDEX ix_phone_calls_person_type ON public.phone_calls (person_type, person_id, call_date DESC);
CREATE INDEX ix_phone_calls_member_reference_id ON public.phone_calls (member_reference_id);
CREATE INDEX ix_phone_calls_staff_reference_id ON public.phone_calls (staff_reference_id);
CREATE INDEX ix_cash_transactions_member_id ON public.cash_transactions (member_id, transaction_date DESC);
CREATE INDEX ix_cash_transactions_recorded_by ON public.cash_transactions (recorded_by);
CREATE INDEX ix_translations_language_code ON public.translations (language_code, table_name);
CREATE INDEX ix_members_membership_status ON public.members (membership_status);
CREATE INDEX ix_members_activity_status ON public.members (activity_status);
CREATE INDEX ix_cash_transactions_deleted_transaction_id ON public.cash_transactions_deleted (transaction_id);
CREATE INDEX ix_cash_transactions_deleted_deleted_by ON public.cash_transactions_deleted (deleted_by);
CREATE INDEX ix_cash_transactions_deleted_deleted_at ON public.cash_transactions_deleted (deleted_at);
CREATE INDEX ix_members_deleted_member_id ON public.members_deleted (member_id);
CREATE INDEX ix_members_deleted_deleted_by ON public.members_deleted (deleted_by);
CREATE INDEX ix_members_deleted_deleted_at ON public.members_deleted (deleted_at);
CREATE INDEX ix_staff_deleted_staff_id ON public.staff_deleted (staff_id);
CREATE INDEX ix_staff_deleted_deleted_by ON public.staff_deleted (deleted_by);
CREATE INDEX ix_staff_deleted_deleted_at ON public.staff_deleted (deleted_at);
CREATE INDEX ix_attendance_deleted_attendance_id ON public.attendance_deleted (attendance_id);
CREATE INDEX ix_attendance_deleted_deleted_by ON public.attendance_deleted (deleted_by);
CREATE INDEX ix_attendance_deleted_deleted_at ON public.attendance_deleted (deleted_at);
CREATE INDEX ix_emergency_contacts_deleted_contact_id ON public.emergency_contacts_deleted (contact_id);
CREATE INDEX ix_emergency_contacts_deleted_deleted_by ON public.emergency_contacts_deleted (deleted_by);
CREATE INDEX ix_emergency_contacts_deleted_deleted_at ON public.emergency_contacts_deleted (deleted_at);
CREATE INDEX ix_phone_calls_deleted_call_id ON public.phone_calls_deleted (call_id);
CREATE INDEX ix_phone_calls_deleted_deleted_by ON public.phone_calls_deleted (deleted_by);
CREATE INDEX ix_phone_calls_deleted_deleted_at ON public.phone_calls_deleted (deleted_at);

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

-- English labels from the client's lookup sheets.
INSERT INTO public.translations (table_name, code, language_code, label)
SELECT 'salutations', code::text, 'en', label FROM public.salutations;
INSERT INTO public.translations (table_name, code, language_code, label)
SELECT 'genders', code::text, 'en', label FROM public.genders;
INSERT INTO public.translations (table_name, code, language_code, label)
SELECT 'activity_statuses', code::text, 'en', label FROM public.activity_statuses;
INSERT INTO public.translations (table_name, code, language_code, label)
SELECT 'membership_statuses', code::text, 'en', label FROM public.membership_statuses;
INSERT INTO public.translations (table_name, code, language_code, label)
SELECT 'contact_relationships', code::text, 'en', label FROM public.contact_relationships;
INSERT INTO public.translations (table_name, code, language_code, label)
SELECT 'caller_types', code::text, 'en', label FROM public.caller_types;
INSERT INTO public.translations (table_name, code, language_code, label)
SELECT 'call_topics', code::text, 'en', label FROM public.call_topics;
INSERT INTO public.translations (table_name, code, language_code, label)
SELECT 'cash_transaction_types', code::text, 'en', label FROM public.cash_transaction_types;
INSERT INTO public.translations (table_name, code, language_code, label)
SELECT 'currencies', code::text, 'en', label FROM public.currencies;
INSERT INTO public.translations (table_name, code, language_code, label)
SELECT 'clubhouse_statuses', code::text, 'en', label FROM public.clubhouse_statuses;
INSERT INTO public.translations (table_name, code, language_code, label)
SELECT 'countries', code::text, 'en', label FROM public.countries;
INSERT INTO public.translations (table_name, code, language_code, label)
SELECT 'languages', code::text, 'en', label FROM public.languages;

-- Exact German sample translations supplied by the client.
INSERT INTO public.translations (table_name, code, language_code, label) VALUES
    ('salutations', 'ms', 'de', 'Frau'),
    ('salutations', 'mr', 'de', 'Herr'),
    ('call_topics', '3', 'de', 'Beratungsgespräch'),
    ('call_topics', '4', 'de', 'Krisenintervention');

-- German labels retained from the old approved value lists where available.
INSERT INTO public.translations (table_name, code, language_code, label) VALUES
    ('salutations', 'unspecified', 'de', 'Keine Angabe'),
    ('genders', 'female', 'de', 'Weiblich'),
    ('genders', 'male', 'de', 'Männlich'),
    ('genders', 'diverse', 'de', 'Divers'),
    ('genders', 'unspecified', 'de', 'Keine Angabe'),
    ('activity_statuses', 'active', 'de', 'Aktiv'),
    ('activity_statuses', 'inactive', 'de', 'Inaktiv'),
    ('membership_statuses', 'mo', 'de', 'MO'),
    ('membership_statuses', 'm', 'de', 'M'),
    ('caller_types', 'member', 'de', 'Mitglied'),
    ('caller_types', 'staff', 'de', 'Mitarbeitende Person'),
    ('call_topics', '1', 'de', 'Anmeldung zu Schicht'),
    ('call_topics', '2', 'de', 'Clubhausbelange'),
    ('call_topics', '5', 'de', 'Entlastungsgespräch'),
    ('contact_relationships', 'mother', 'de', 'Mutter'),
    ('contact_relationships', 'father', 'de', 'Vater'),
    ('contact_relationships', 'sister', 'de', 'Schwester'),
    ('contact_relationships', 'brother', 'de', 'Bruder'),
    ('contact_relationships', 'wife', 'de', 'Ehefrau'),
    ('contact_relationships', 'husband', 'de', 'Ehemann'),
    ('contact_relationships', 'son', 'de', 'Sohn'),
    ('contact_relationships', 'daughter', 'de', 'Tochter'),
    ('contact_relationships', 'other', 'de', 'Sonstige');

-- 7. Business rules. Day 1 = join_date, M from join_date + 42.
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

-- Serialize allocations for the same prefix. Deleted codes stay reserved by archives.
-- READ COMMITTED is the recommended application isolation level.
-- At stronger isolation, a uniqueness/serialization error must retry the transaction.
CREATE FUNCTION public.allocate_person_code(p_kind text, p_first_name text, p_last_name text)
RETURNS text LANGUAGE plpgsql VOLATILE
SET search_path = pg_catalog, public
AS $fn$
DECLARE
    v_prefix text;
    v_number bigint;
BEGIN
    IF p_kind NOT IN ('members', 'staff') THEN
        RAISE EXCEPTION 'Unsupported code namespace: %', p_kind;
    END IF;
    v_prefix := public.code_name_part(p_last_name)
        || left(public.code_name_part(p_first_name), 1);
    IF public.code_name_part(p_last_name) = ''
       OR public.code_name_part(p_first_name) = '' THEN
        RAISE EXCEPTION 'Names must contain letters that can be transliterated for code generation.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('prometheus-code:' || p_kind || ':' || v_prefix, 0));
    IF p_kind = 'members' THEN
        SELECT coalesce(max(substring(code FROM length(v_prefix) + 1)::bigint), 0) + 1
        INTO v_number
        FROM (
            SELECT member_code AS code FROM public.members
            UNION ALL
            SELECT member_code FROM public.members_deleted
        ) AS used_codes
        WHERE left(code, length(v_prefix)) = v_prefix
          AND substring(code FROM length(v_prefix) + 1) ~ '^[0-9]+$';
    ELSE
        SELECT coalesce(max(substring(code FROM length(v_prefix) + 1)::bigint), 0) + 1
        INTO v_number
        FROM (
            SELECT staff_code AS code FROM public.staff
            UNION ALL
            SELECT staff_code FROM public.staff_deleted
        ) AS used_codes
        WHERE left(code, length(v_prefix)) = v_prefix
          AND substring(code FROM length(v_prefix) + 1) ~ '^[0-9]+$';
    END IF;
    RETURN v_prefix || lpad(v_number::text, greatest(2, length(v_number::text)), '0');
END;
$fn$;

CREATE FUNCTION public.prepare_person()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $fn$
DECLARE
    v_code text;
    v_id uuid;
    v_archived boolean;
BEGIN
    IF TG_TABLE_NAME = 'members' THEN
        IF TG_OP = 'UPDATE' THEN
            IF NEW.member_id IS DISTINCT FROM OLD.member_id
               OR NEW.member_code IS DISTINCT FROM OLD.member_code THEN
                RAISE EXCEPTION 'member_id and member_code cannot be changed.' USING ERRCODE = '23514';
            END IF;
        ELSE
            SELECT EXISTS(SELECT 1 FROM public.members_deleted WHERE member_id = NEW.member_id)
            INTO v_archived;
            IF v_archived THEN
                RAISE EXCEPTION 'A deleted member_id cannot be reused.' USING ERRCODE = '23514';
            END IF;
            IF NEW.member_code IS NOT NULL THEN
                RAISE EXCEPTION 'Omit member_code: the database generates it.' USING ERRCODE = '23514';
            END IF;
            NEW.member_code := public.allocate_person_code('members', NEW.first_name, NEW.last_name);
        END IF;
    ELSE
        IF TG_OP = 'UPDATE' THEN
            IF NEW.staff_id IS DISTINCT FROM OLD.staff_id
               OR NEW.staff_code IS DISTINCT FROM OLD.staff_code THEN
                RAISE EXCEPTION 'staff_id and staff_code cannot be changed.' USING ERRCODE = '23514';
            END IF;
        ELSE
            SELECT EXISTS(SELECT 1 FROM public.staff_deleted WHERE staff_id = NEW.staff_id)
            INTO v_archived;
            IF v_archived THEN
                RAISE EXCEPTION 'A deleted staff_id cannot be reused.' USING ERRCODE = '23514';
            END IF;
            IF NEW.staff_code IS NOT NULL THEN
                RAISE EXCEPTION 'Omit staff_code: the database generates it.' USING ERRCODE = '23514';
            END IF;
            NEW.staff_code := public.allocate_person_code('staff', NEW.first_name, NEW.last_name);
        END IF;
    END IF;
    RETURN NEW;
END;
$fn$;

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

-- Only source identifiers with real archive tables are protected here.
CREATE FUNCTION public.guard_source_id()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $fn$
DECLARE
    v_id text;
    v_exists boolean;
BEGIN
    v_id := to_jsonb(NEW) ->> TG_ARGV[0];
    IF TG_OP = 'UPDATE' AND v_id IS DISTINCT FROM (to_jsonb(OLD) ->> TG_ARGV[0]) THEN
        RAISE EXCEPTION '% is immutable.', TG_ARGV[0] USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'INSERT' THEN
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1::uuid)',
                       TG_TABLE_NAME || '_deleted', TG_ARGV[0])
        INTO v_exists USING v_id;
        IF v_exists THEN
            RAISE EXCEPTION 'A deleted % cannot be reused.', TG_ARGV[0] USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$fn$;
CREATE TRIGGER a_guard_attendance_id BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.guard_source_id('attendance_id');
CREATE TRIGGER a_guard_contact_id BEFORE INSERT OR UPDATE ON public.emergency_contacts
FOR EACH ROW EXECUTE FUNCTION public.guard_source_id('contact_id');
CREATE TRIGGER a_guard_call_id BEFORE INSERT OR UPDATE ON public.phone_calls
FOR EACH ROW EXECUTE FUNCTION public.guard_source_id('call_id');
CREATE TRIGGER a_guard_transaction_id BEFORE INSERT OR UPDATE ON public.cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_source_id('transaction_id');

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
    m.date_of_birth, m.join_date,
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

CREATE VIEW public.lookup_labels AS
SELECT table_name, code, language_code, label FROM public.translations;

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

-- 8. Deletion audit. Context is transaction-local and supplied by a trusted backend.
-- BEGIN;
-- SELECT set_config('prometheus.deleted_by', '<staff uuid>', true);
-- SELECT set_config('prometheus.deletion_reason', 'Duplicate record', true);
-- DELETE FROM public.emergency_contacts WHERE contact_id = '<contact uuid>';
-- COMMIT;
-- These settings record attribution; they do NOT authenticate or authorize the actor.
CREATE FUNCTION public.archive_deleted_row()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $fn$
DECLARE
    v_actor uuid;
    v_reason text;
    v_payload jsonb;
    v_today date;
    v_last_visit date;
BEGIN
    v_actor := nullif(current_setting('prometheus.deleted_by', true), '')::uuid;
    v_reason := nullif(current_setting('prometheus.deletion_reason', true), '');
    IF v_actor IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.staff WHERE staff_id = v_actor
    ) THEN
        -- An actor deleting their own staff row no longer has a live FK target.
        IF TG_TABLE_NAME = 'staff' THEN
            IF v_actor = OLD.staff_id THEN
                v_actor := NULL;
            ELSE
                RAISE EXCEPTION 'Deletion actor is not a live staff record: %', v_actor
                    USING ERRCODE = '23503';
            END IF;
        ELSE
            RAISE EXCEPTION 'Deletion actor is not a live staff record: %', v_actor
                USING ERRCODE = '23503';
        END IF;
    END IF;

    v_payload := (to_jsonb(OLD) - 'created_at' - 'updated_at')
        || jsonb_build_object(
            'archive_id', gen_random_uuid(),
            'deleted_at', clock_timestamp(),
            'deleted_by', v_actor,
            'deletion_reason', v_reason,
            'original_created_at', to_jsonb(OLD) -> 'created_at'
        );
    IF TG_TABLE_NAME IN ('members', 'staff') THEN
        v_payload := v_payload || jsonb_build_object(
            'original_updated_at', to_jsonb(OLD) -> 'updated_at'
        );
    END IF;
    IF TG_TABLE_NAME = 'members' THEN
        SELECT (statement_timestamp() AT TIME ZONE timezone)::date
        INTO v_today FROM public.clubhouses WHERE clubhouse_id = OLD.clubhouse_id;
        SELECT max(attendance_date) INTO v_last_visit FROM public.attendance
        WHERE member_id = OLD.member_id AND attendance_date <= v_today;
        v_payload := v_payload || jsonb_build_object(
            'membership_status', public.membership_status_on(OLD.join_date, v_today),
            'activity_status', public.activity_status_on(v_last_visit, v_today)
        );
    END IF;
    EXECUTE format(
        'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)',
        TG_TABLE_NAME || '_deleted', TG_TABLE_NAME || '_deleted'
    ) USING v_payload;
    RETURN OLD;
END;
$fn$;

CREATE TRIGGER archive_members AFTER DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_row();
CREATE TRIGGER archive_staff AFTER DELETE ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_row();
CREATE TRIGGER archive_attendance AFTER DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_row();
CREATE TRIGGER archive_contacts AFTER DELETE ON public.emergency_contacts
FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_row();
CREATE TRIGGER archive_calls AFTER DELETE ON public.phone_calls
FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_row();
CREATE TRIGGER archive_cash AFTER DELETE ON public.cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_row();

CREATE FUNCTION public.guard_archive_update()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $fn$
BEGIN
    -- Permit only ON DELETE SET NULL cleanup when the actor was removed.
    IF OLD.deleted_by IS NOT NULL AND NEW.deleted_by IS NULL
       AND (to_jsonb(OLD) - 'deleted_by') = (to_jsonb(NEW) - 'deleted_by')
       AND NOT EXISTS(SELECT 1 FROM public.staff WHERE staff_id = OLD.deleted_by) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Deletion history is immutable; archive rows cannot be edited.'
        USING ERRCODE = '23514';
END;
$fn$;

CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.cash_transactions_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();

CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.members_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();

CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.staff_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();

CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.attendance_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();

CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.emergency_contacts_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();

CREATE TRIGGER prevent_archive_edits BEFORE UPDATE ON public.phone_calls_deleted
FOR EACH ROW EXECUTE FUNCTION public.guard_archive_update();

-- 9. Metadata and additional FK indexes.
CREATE INDEX ix_clubhouses_country ON public.clubhouses (country);
CREATE INDEX ix_clubhouses_primary_language ON public.clubhouses (primary_language);
CREATE INDEX ix_clubhouses_clubhouse_status ON public.clubhouses (clubhouse_status);
CREATE INDEX ix_members_salutation ON public.members (salutation);
CREATE INDEX ix_members_gender ON public.members (gender);
CREATE INDEX ix_members_country ON public.members (country);
CREATE INDEX ix_emergency_contacts_relationship ON public.emergency_contacts (relationship);
CREATE INDEX ix_phone_calls_topic_code ON public.phone_calls (topic_code);
CREATE INDEX ix_cash_transactions_transaction_type ON public.cash_transactions (transaction_type);
CREATE INDEX ix_cash_transactions_currency ON public.cash_transactions (currency);
CREATE INDEX ix_translations_ref_salutations ON public.translations (ref_salutations) WHERE ref_salutations IS NOT NULL;
CREATE INDEX ix_translations_ref_genders ON public.translations (ref_genders) WHERE ref_genders IS NOT NULL;
CREATE INDEX ix_translations_ref_activity_statuses ON public.translations (ref_activity_statuses) WHERE ref_activity_statuses IS NOT NULL;
CREATE INDEX ix_translations_ref_membership_statuses ON public.translations (ref_membership_statuses) WHERE ref_membership_statuses IS NOT NULL;
CREATE INDEX ix_translations_ref_contact_relationships ON public.translations (ref_contact_relationships) WHERE ref_contact_relationships IS NOT NULL;
CREATE INDEX ix_translations_ref_caller_types ON public.translations (ref_caller_types) WHERE ref_caller_types IS NOT NULL;
CREATE INDEX ix_translations_ref_call_topics ON public.translations (ref_call_topics) WHERE ref_call_topics IS NOT NULL;
CREATE INDEX ix_translations_ref_cash_transaction_types ON public.translations (ref_cash_transaction_types) WHERE ref_cash_transaction_types IS NOT NULL;
CREATE INDEX ix_translations_ref_currencies ON public.translations (ref_currencies) WHERE ref_currencies IS NOT NULL;
CREATE INDEX ix_translations_ref_clubhouse_statuses ON public.translations (ref_clubhouse_statuses) WHERE ref_clubhouse_statuses IS NOT NULL;
CREATE INDEX ix_translations_ref_countries ON public.translations (ref_countries) WHERE ref_countries IS NOT NULL;
CREATE INDEX ix_translations_ref_languages ON public.translations (ref_languages) WHERE ref_languages IS NOT NULL;
COMMENT ON TABLE public.clubhouses IS 'Root table. One row per physical clubhouse; every member and staff record belongs to exactly one. / true only for members, see sheets staff A2 and staff_clubhouses A2';
COMMENT ON COLUMN public.clubhouses.clubhouse_id IS 'Unique identifier for the clubhouse.';
COMMENT ON COLUMN public.clubhouses.name IS 'Clubhouse name, e.g. ''Clubhaus München Geising''.';
COMMENT ON COLUMN public.clubhouses.street_address IS 'Street and house number.';
COMMENT ON COLUMN public.clubhouses.postal_code IS 'Postal code.';
COMMENT ON COLUMN public.clubhouses.city IS 'City.';
COMMENT ON COLUMN public.clubhouses.country IS 'ISO country code. Needed once more than one country is in play.';
COMMENT ON COLUMN public.clubhouses.timezone IS 'IANA timezone identifier, e.g. ''Europe/Berlin''. Lets attendance/call times recorded locally be interpreted correctly across clubhouses.';
COMMENT ON COLUMN public.clubhouses.primary_language IS 'Default UI/communication language for this clubhouse.';
COMMENT ON COLUMN public.clubhouses.clubhouse_status IS 'Whether the clubhouse is currently operating.';
COMMENT ON COLUMN public.clubhouses.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN public.clubhouses.updated_at IS 'Last modified timestamp (needs an update trigger).';
COMMENT ON TABLE public.members IS 'One row per clubhouse member.';
COMMENT ON COLUMN public.members.member_id IS 'Unique identifier for the member.';
COMMENT ON COLUMN public.members.clubhouse_id IS 'Which clubhouse this member belongs to.';
COMMENT ON COLUMN public.members.member_code IS 'Human-readable code generated once at creation from the member''s name, e.g. MUELLERJ01 for Jasmin Mueller. Deliberately independent of clubhouse_id — see note below.';
COMMENT ON COLUMN public.members.first_name IS 'First name.';
COMMENT ON COLUMN public.members.last_name IS 'Last name.';
COMMENT ON COLUMN public.members.date_of_birth IS 'Date of birth.';
COMMENT ON COLUMN public.members.join_date IS 'Date the member joined.';
COMMENT ON COLUMN public.members.membership_status IS '''mo'' = member in observation, ''m'' = full member.';
COMMENT ON COLUMN public.members.salutation IS 'Optional, not required at registration.';
COMMENT ON COLUMN public.members.gender IS 'Optional, not required at registration.';
COMMENT ON COLUMN public.members.phone IS 'Phone number.';
COMMENT ON COLUMN public.members.email IS 'Email address.';
COMMENT ON COLUMN public.members.street_address IS 'Street and house number.';
COMMENT ON COLUMN public.members.postal_code IS 'Postal code.';
COMMENT ON COLUMN public.members.city IS 'City.';
COMMENT ON COLUMN public.members.country IS 'ISO country code.';
COMMENT ON COLUMN public.members.activity_status IS 'Blank until the member''s first attendance entry.';
COMMENT ON COLUMN public.members.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN public.members.updated_at IS 'Last modified timestamp (needs an update trigger).';
COMMENT ON TABLE public.staff IS 'One row per staff member. A staff member can work at more than one clubhouse — see staff_clubhouses.';
COMMENT ON COLUMN public.staff.staff_id IS 'Unique identifier for the staff member.';
COMMENT ON COLUMN public.staff.staff_code IS 'Human-readable code generated once at creation from the staff member''s name, same scheme as member_code, e.g. SCHMIDTA01.';
COMMENT ON COLUMN public.staff.first_name IS 'First name.';
COMMENT ON COLUMN public.staff.last_name IS 'Last name.';
COMMENT ON COLUMN public.staff.role IS 'Job role / title.';
COMMENT ON COLUMN public.staff.email IS 'Email address.';
COMMENT ON COLUMN public.staff.active IS 'Whether the staff member is currently active.';
COMMENT ON COLUMN public.staff.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN public.staff.updated_at IS 'Last modified timestamp (needs an update trigger).';
COMMENT ON TABLE public.staff_clubhouses IS 'Connection table between staff and clubhouses (many-to-many). Replaces the single clubhouse_id that used to sit on staff.';
COMMENT ON COLUMN public.staff_clubhouses.staff_id IS 'Part of the composite primary key with clubhouse_id.';
COMMENT ON COLUMN public.staff_clubhouses.clubhouse_id IS 'Part of the composite primary key with staff_id.';
COMMENT ON COLUMN public.staff_clubhouses.is_primary IS 'Marks the staff member''s home clubhouse. Partial unique index enforces at most one primary per staff member.';
COMMENT ON COLUMN public.staff_clubhouses.assigned_at IS 'When this staff member was assigned to this clubhouse.';
COMMENT ON TABLE public.attendance IS 'Time-in / time-out log for members.';
COMMENT ON COLUMN public.attendance.attendance_id IS 'Unique identifier for the attendance entry.';
COMMENT ON COLUMN public.attendance.member_id IS 'Which member this entry belongs to. A member with attendance history cannot be hard-deleted.';
COMMENT ON COLUMN public.attendance.attendance_date IS 'Date of the visit.';
COMMENT ON COLUMN public.attendance.time_in IS 'Arrival time.';
COMMENT ON COLUMN public.attendance.time_out IS 'Departure time. Blank until the member checks out.';
COMMENT ON COLUMN public.attendance.created_at IS 'Row creation timestamp.';
COMMENT ON TABLE public.emergency_contacts IS 'Emergency contacts for a member.';
COMMENT ON COLUMN public.emergency_contacts.contact_id IS 'Unique identifier for the contact.';
COMMENT ON COLUMN public.emergency_contacts.member_id IS 'Which member this contact belongs to. Deleting the member deletes their contacts too.';
COMMENT ON COLUMN public.emergency_contacts.name IS 'Contact''s full name.';
COMMENT ON COLUMN public.emergency_contacts.phone IS 'Contact''s phone number.';
COMMENT ON COLUMN public.emergency_contacts.relationship IS 'Relationship to the member.';
COMMENT ON COLUMN public.emergency_contacts.created_at IS 'Row creation timestamp.';
COMMENT ON TABLE public.phone_calls IS 'Phone call log. The caller can be a member or a staff person — person_id + person_type together identify who called, instead of two separate id columns.';
COMMENT ON COLUMN public.phone_calls.call_id IS 'Unique identifier for the call.';
COMMENT ON COLUMN public.phone_calls.person_id IS 'References members.member_id when person_type = ''member'', or staff.staff_id when person_type = ''staff''. Combines the two former columns into one.';
COMMENT ON COLUMN public.phone_calls.person_type IS 'Which table person_id points into: ''member'' or ''staff''.';
COMMENT ON COLUMN public.phone_calls.call_date IS 'Date of the call.';
COMMENT ON COLUMN public.phone_calls.duration_minutes IS 'Call duration in minutes.';
COMMENT ON COLUMN public.phone_calls.topic_code IS 'Reason/category code for the call.';
COMMENT ON COLUMN public.phone_calls.note IS 'Free-text note.';
COMMENT ON COLUMN public.phone_calls.created_at IS 'Row creation timestamp.';
COMMENT ON TABLE public.cash_transactions IS 'Daily cash movements for a member: deposits (cash in) and purchases (cash out). One row per movement, not a daily total.';
COMMENT ON COLUMN public.cash_transactions.transaction_id IS 'Unique identifier for the transaction.';
COMMENT ON COLUMN public.cash_transactions.member_id IS 'Which member this cash movement belongs to. A member with transaction history cannot be hard-deleted.';
COMMENT ON COLUMN public.cash_transactions.transaction_date IS 'Calendar day the cash movement happened.';
COMMENT ON COLUMN public.cash_transactions.transaction_type IS '''deposit'' (cash in) or ''purchase'' (cash out).';
COMMENT ON COLUMN public.cash_transactions.amount IS 'Always positive; transaction_type determines the direction, not the sign.';
COMMENT ON COLUMN public.cash_transactions.currency IS 'ISO 4217 currency code for this transaction — matters once clubhouses span currencies (EUR/CHF/GBP/NOK/GIP).';
COMMENT ON COLUMN public.cash_transactions.recorded_by IS 'Staff member who processed/recorded the transaction. A staff member with recorded transactions cannot be hard-deleted.';
COMMENT ON COLUMN public.cash_transactions.note IS 'Free-text note.';
COMMENT ON COLUMN public.cash_transactions.created_at IS 'Row creation timestamp.';
COMMENT ON TABLE public.cash_transactions_deleted IS 'Deletion history for ''cash_transactions''. Populated automatically by an AFTER DELETE trigger — every deleted cash row lands here as a backup before it is gone for good. Not a foreign key back to the source table, since the source row no longer exists once this fires.';
COMMENT ON COLUMN public.cash_transactions_deleted.archive_id IS 'Unique identifier for this archive row.';
COMMENT ON COLUMN public.cash_transactions_deleted.deleted_at IS 'When the deletion happened.';
COMMENT ON COLUMN public.cash_transactions_deleted.deleted_by IS 'Which staff member performed the delete. Blank if it happened as part of an automated/cascade process.';
COMMENT ON COLUMN public.cash_transactions_deleted.deletion_reason IS 'Optional free-text reason.';
COMMENT ON COLUMN public.cash_transactions_deleted.transaction_id IS 'Original transaction_id. No longer a live foreign key.';
COMMENT ON COLUMN public.cash_transactions_deleted.member_id IS 'Copy of member_id at time of deletion.';
COMMENT ON COLUMN public.cash_transactions_deleted.transaction_date IS 'Copy of transaction_date at time of deletion.';
COMMENT ON COLUMN public.cash_transactions_deleted.transaction_type IS 'Copy of transaction_type at time of deletion.';
COMMENT ON COLUMN public.cash_transactions_deleted.amount IS 'Copy of amount at time of deletion.';
COMMENT ON COLUMN public.cash_transactions_deleted.currency IS 'Copy of currency at time of deletion.';
COMMENT ON COLUMN public.cash_transactions_deleted.recorded_by IS 'Copy of recorded_by at time of deletion.';
COMMENT ON COLUMN public.cash_transactions_deleted.note IS 'Copy of note at time of deletion.';
COMMENT ON COLUMN public.cash_transactions_deleted.original_created_at IS 'Copy of created_at from the original row.';
COMMENT ON TABLE public.salutations IS 'Lookup table for members.salutation. code is the primary key.';
COMMENT ON TABLE public.genders IS 'Lookup table for members.gender. code is the primary key.';
COMMENT ON TABLE public.activity_statuses IS 'Lookup table for members.activity_status. code is the primary key.';
COMMENT ON TABLE public.membership_statuses IS 'Lookup table for members.membership_status. code is the primary key.';
COMMENT ON TABLE public.contact_relationships IS 'Lookup table for emergency_contacts.relationship. code is the primary key.';
COMMENT ON TABLE public.caller_types IS 'Lookup table for phone_calls.person_type. code is the primary key.';
COMMENT ON TABLE public.call_topics IS 'Lookup table for phone_calls.topic_code. code is the primary key.';
COMMENT ON TABLE public.cash_transaction_types IS 'Lookup table for cash_transactions.transaction_type. code is the primary key.';
COMMENT ON TABLE public.currencies IS 'Lookup table for cash_transactions.currency. code is the primary key (ISO 4217). Matches the currencies used across the countries table.';
COMMENT ON TABLE public.clubhouse_statuses IS 'Lookup table for clubhouses.clubhouse_status. code is the primary key.';
COMMENT ON TABLE public.countries IS 'Lookup table for clubhouses.country and members.country. code is the primary key (ISO 3166-1 alpha-2). Europe-first, since the project starts there.';
COMMENT ON TABLE public.languages IS 'Lookup table for clubhouses.primary_language and translations.language_code. code is the primary key (ISO 639-1). Europe-first, matching the countries table.';
COMMENT ON TABLE public.translations IS 'Generic label translations for every lookup table. Not itself referenced by a strict foreign key on table_name, since Postgres cannot FK a column to ''whichever table this row names'' — validated at the application layer instead.';
COMMENT ON TABLE public.members_deleted IS 'Deletion history for ''members''. Populated automatically by an AFTER DELETE trigger on the source table — every deleted row lands here as a backup before it is gone for good. Not a foreign key back to the source table, since the source row no longer exists once this fires.';
COMMENT ON COLUMN public.members_deleted.archive_id IS 'Unique identifier for this archive row (not the original member_id).';
COMMENT ON COLUMN public.members_deleted.deleted_at IS 'When the deletion happened.';
COMMENT ON COLUMN public.members_deleted.deleted_by IS 'Which staff member performed the delete. Blank if it happened as part of an automated/cascade process.';
COMMENT ON COLUMN public.members_deleted.deletion_reason IS 'Optional free-text reason (useful for e.g. GDPR erasure requests).';
COMMENT ON COLUMN public.members_deleted.member_id IS 'Original member_id. No longer a live foreign key.';
COMMENT ON COLUMN public.members_deleted.clubhouse_id IS 'Copy of the member''s clubhouse_id at time of deletion.';
COMMENT ON COLUMN public.members_deleted.member_code IS 'Copy of member_code at time of deletion.';
COMMENT ON COLUMN public.members_deleted.first_name IS 'Copy of first_name at time of deletion.';
COMMENT ON COLUMN public.members_deleted.last_name IS 'Copy of last_name at time of deletion.';
COMMENT ON COLUMN public.members_deleted.date_of_birth IS 'Copy of date_of_birth at time of deletion.';
COMMENT ON COLUMN public.members_deleted.join_date IS 'Copy of join_date at time of deletion.';
COMMENT ON COLUMN public.members_deleted.membership_status IS 'Copy of membership_status at time of deletion.';
COMMENT ON COLUMN public.members_deleted.salutation IS 'Copy of salutation at time of deletion.';
COMMENT ON COLUMN public.members_deleted.gender IS 'Copy of gender at time of deletion.';
COMMENT ON COLUMN public.members_deleted.phone IS 'Copy of phone at time of deletion.';
COMMENT ON COLUMN public.members_deleted.email IS 'Copy of email at time of deletion.';
COMMENT ON COLUMN public.members_deleted.street_address IS 'Copy of street_address at time of deletion.';
COMMENT ON COLUMN public.members_deleted.postal_code IS 'Copy of postal_code at time of deletion.';
COMMENT ON COLUMN public.members_deleted.city IS 'Copy of city at time of deletion.';
COMMENT ON COLUMN public.members_deleted.activity_status IS 'Copy of activity_status at time of deletion.';
COMMENT ON COLUMN public.members_deleted.original_created_at IS 'Copy of created_at from the original row.';
COMMENT ON COLUMN public.members_deleted.original_updated_at IS 'Copy of updated_at from the original row.';
COMMENT ON COLUMN public.members_deleted.country IS 'Copy of country; missing typed row in client sheet (country? at A27).';
COMMENT ON TABLE public.staff_deleted IS 'Deletion history for ''staff''. Populated automatically by an AFTER DELETE trigger on the source table — every deleted row lands here as a backup before it is gone for good. Not a foreign key back to the source table, since the source row no longer exists once this fires.';
COMMENT ON COLUMN public.staff_deleted.archive_id IS 'Unique identifier for this archive row (not the original staff_id).';
COMMENT ON COLUMN public.staff_deleted.deleted_at IS 'When the deletion happened.';
COMMENT ON COLUMN public.staff_deleted.deleted_by IS 'Which staff member performed the delete (e.g. an admin removing a colleague).';
COMMENT ON COLUMN public.staff_deleted.deletion_reason IS 'Optional free-text reason.';
COMMENT ON COLUMN public.staff_deleted.staff_id IS 'Original staff_id. No longer a live foreign key.';
COMMENT ON COLUMN public.staff_deleted.staff_code IS 'Copy of staff_code at time of deletion.';
COMMENT ON COLUMN public.staff_deleted.first_name IS 'Copy of first_name at time of deletion.';
COMMENT ON COLUMN public.staff_deleted.last_name IS 'Copy of last_name at time of deletion.';
COMMENT ON COLUMN public.staff_deleted.role IS 'Copy of role at time of deletion.';
COMMENT ON COLUMN public.staff_deleted.email IS 'Copy of email at time of deletion.';
COMMENT ON COLUMN public.staff_deleted.active IS 'Copy of active at time of deletion.';
COMMENT ON COLUMN public.staff_deleted.original_created_at IS 'Copy of created_at from the original row.';
COMMENT ON COLUMN public.staff_deleted.original_updated_at IS 'Copy of updated_at from the original row.';
COMMENT ON TABLE public.attendance_deleted IS 'Deletion history for ''attendance''. Populated automatically by an AFTER DELETE trigger on the source table — every deleted row lands here as a backup before it is gone for good. Not a foreign key back to the source table, since the source row no longer exists once this fires.';
COMMENT ON COLUMN public.attendance_deleted.archive_id IS 'Unique identifier for this archive row.';
COMMENT ON COLUMN public.attendance_deleted.deleted_at IS 'When the deletion happened.';
COMMENT ON COLUMN public.attendance_deleted.deleted_by IS 'Which staff member performed the delete.';
COMMENT ON COLUMN public.attendance_deleted.deletion_reason IS 'Optional free-text reason.';
COMMENT ON COLUMN public.attendance_deleted.attendance_id IS 'Original attendance_id.';
COMMENT ON COLUMN public.attendance_deleted.member_id IS 'Copy of member_id at time of deletion (also caught here if a member delete cascaded... see note below). Attendance E6 and F6, relationship row 14  - restrict delete';
COMMENT ON COLUMN public.attendance_deleted.attendance_date IS 'Copy of attendance_date.';
COMMENT ON COLUMN public.attendance_deleted.time_in IS 'Copy of time_in.';
COMMENT ON COLUMN public.attendance_deleted.time_out IS 'Copy of time_out.';
COMMENT ON COLUMN public.attendance_deleted.original_created_at IS 'Copy of created_at from the original row.';
COMMENT ON TABLE public.emergency_contacts_deleted IS 'Deletion history for ''emergency_contacts''. Populated automatically by an AFTER DELETE trigger on the source table — every deleted row lands here as a backup before it is gone for good. Not a foreign key back to the source table, since the source row no longer exists once this fires. Note: since member -> emergency_contacts cascades, most rows here will come from a member deletion, not a direct delete.';
COMMENT ON COLUMN public.emergency_contacts_deleted.archive_id IS 'Unique identifier for this archive row.';
COMMENT ON COLUMN public.emergency_contacts_deleted.deleted_at IS 'When the deletion happened.';
COMMENT ON COLUMN public.emergency_contacts_deleted.deleted_by IS 'Usually blank here, since cascade deletes have no direct actor on this table.';
COMMENT ON COLUMN public.emergency_contacts_deleted.deletion_reason IS 'Optional free-text reason.';
COMMENT ON COLUMN public.emergency_contacts_deleted.contact_id IS 'Original contact_id.';
COMMENT ON COLUMN public.emergency_contacts_deleted.member_id IS 'Copy of member_id at time of deletion.';
COMMENT ON COLUMN public.emergency_contacts_deleted.name IS 'Copy of name.';
COMMENT ON COLUMN public.emergency_contacts_deleted.phone IS 'Copy of phone.';
COMMENT ON COLUMN public.emergency_contacts_deleted.relationship IS 'Copy of relationship.';
COMMENT ON COLUMN public.emergency_contacts_deleted.original_created_at IS 'Copy of created_at from the original row.';
COMMENT ON TABLE public.phone_calls_deleted IS 'Deletion history for ''phone_calls''. Populated automatically by an AFTER DELETE trigger on the source table — every deleted row lands here as a backup before it is gone for good. Not a foreign key back to the source table, since the source row no longer exists once this fires.';
COMMENT ON COLUMN public.phone_calls_deleted.archive_id IS 'Unique identifier for this archive row.';
COMMENT ON COLUMN public.phone_calls_deleted.deleted_at IS 'When the deletion happened.';
COMMENT ON COLUMN public.phone_calls_deleted.deleted_by IS 'Which staff member performed the delete.';
COMMENT ON COLUMN public.phone_calls_deleted.deletion_reason IS 'Optional free-text reason.';
COMMENT ON COLUMN public.phone_calls_deleted.call_id IS 'Original call_id.';
COMMENT ON COLUMN public.phone_calls_deleted.person_id IS 'Copy of person_id at time of deletion.';
COMMENT ON COLUMN public.phone_calls_deleted.person_type IS 'Copy of person_type at time of deletion.';
COMMENT ON COLUMN public.phone_calls_deleted.call_date IS 'Copy of call_date.';
COMMENT ON COLUMN public.phone_calls_deleted.duration_minutes IS 'Copy of duration_minutes.';
COMMENT ON COLUMN public.phone_calls_deleted.topic_code IS 'Copy of topic_code.';
COMMENT ON COLUMN public.phone_calls_deleted.note IS 'Copy of note.';
COMMENT ON COLUMN public.phone_calls_deleted.original_created_at IS 'Copy of created_at from the original row.';

COMMENT ON COLUMN public.members.membership_status IS
    'Automatically maintained cache; read members_current for the status on the current local date. MO through day 42, M from day 43.';
COMMENT ON COLUMN public.members.activity_status IS
    'Automatically maintained cache; read members_current. NULL before first visit, active through day 90, inactive from day 91.';
COMMENT ON COLUMN public.phone_calls.member_reference_id IS
    'Internal generated FK; omit from INSERT/UPDATE and UI.';
COMMENT ON COLUMN public.phone_calls.staff_reference_id IS
    'Internal generated FK; omit from INSERT/UPDATE and UI.';
COMMENT ON VIEW public.members_current IS
    'Read-only application projection with live calculated statuses in the clubhouse timezone.';
COMMENT ON VIEW public.lookup_labels IS
    'Public localization projection; omits internal generated FK columns.';
COMMENT ON PROCEDURE public.refresh_member_status_cache() IS
    'Optional scheduler task. members_current remains accurate without running this task.';
COMMIT;

