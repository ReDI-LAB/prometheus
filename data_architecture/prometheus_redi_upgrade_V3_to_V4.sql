-- Prometheus Redi V3 -> V4 upgrade. PostgreSQL 17+, database owner only.
-- Run the ENTIRE file with stop-on-error in the installed prometheus_redi database.
-- Existing rows, phone values, IDs, financial records and lookup rows are preserved.
-- New optional fields start as NULL. No API code is changed by this script.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL lock_timeout='15s';
DO $guard$
BEGIN
 IF current_database()<>'prometheus_redi' OR current_setting('server_version_num')::integer<170000
    OR to_regclass('public.sectors') IS NULL OR to_regclass('public.members_deleted') IS NULL
    OR to_regprocedure('public.redact_person(text,uuid,text,text)') IS NULL THEN
  RAISE EXCEPTION 'Connect as database owner to the installed V3 prometheus_redi database on PostgreSQL 17+.';
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND ((table_name IN ('members','members_deleted') AND column_name IN ('landline_phone','ori_interviewer_id'))
        OR (table_name IN ('attendance','attendance_deleted') AND column_name='note'))) THEN
  RAISE EXCEPTION 'V4 fields already exist (or the schema is partly changed). This upgrade was not applied.';
 END IF;
END $guard$;
LOCK TABLE public.members,public.members_deleted,public.attendance,public.attendance_deleted,public.staff IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.members ADD COLUMN landline_phone text, ADD COLUMN ori_interviewer_id uuid;
ALTER TABLE public.members_deleted ADD COLUMN landline_phone text, ADD COLUMN ori_interviewer_id uuid;
ALTER TABLE public.attendance ADD COLUMN note text;
ALTER TABLE public.attendance_deleted ADD COLUMN note text;
ALTER TABLE public.members ADD CONSTRAINT fk_members_ori_interviewer
 FOREIGN KEY(ori_interviewer_id) REFERENCES public.staff(staff_id) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE public.members DROP CONSTRAINT ck_members_personal_fields;
ALTER TABLE public.members ADD CONSTRAINT ck_members_personal_fields CHECK (
        (anonymized_at IS NULL AND first_name IS NOT NULL AND btrim(first_name) <> ''
         AND last_name IS NOT NULL AND btrim(last_name) <> '' AND date_of_birth IS NOT NULL)
        OR (anonymized_at IS NOT NULL AND first_name IS NULL AND last_name IS NULL
            AND date_of_birth IS NULL AND salutation IS NULL AND gender IS NULL
            AND phone IS NULL AND landline_phone IS NULL AND ori_interviewer_id IS NULL AND email IS NULL AND street_address IS NULL
            AND postal_code IS NULL AND city IS NULL AND country IS NULL));
COMMENT ON COLUMN public.members.phone IS 'Mobile contact number in the V4 form. Legacy phone column and values are retained; existing numbers are not automatically reclassified.';
COMMENT ON COLUMN public.members.landline_phone IS 'Optional landline contact number, entered separately from Mobile.';
COMMENT ON COLUMN public.members.ori_interviewer_id IS 'Optional staff member selected in ORI Closing Interview Conducted By. Not inferred from the logged-in user.';
CREATE OR REPLACE VIEW public.members_current AS
SELECT
    m.member_id, m.clubhouse_id, m.member_code, m.first_name, m.last_name,
    m.date_of_birth, m.join_date, m.leave_date, m.anonymized_at,
    (m.leave_date IS NULL AND m.anonymized_at IS NULL) AS is_current,
    public.membership_status_on(m.join_date, d.local_date) AS is_member,
    m.salutation, m.gender, m.phone, m.email, m.street_address,
    m.postal_code, m.city, m.country, s.sector,
    public.activity_status_on(v.last_visit_date, d.local_date) AS is_active,
    m.created_at, m.updated_at,
    v.last_visit_date,
    d.local_date AS status_as_of,
    m.landline_phone, m.ori_interviewer_id
FROM public.members AS m
JOIN public.clubhouses AS c ON c.clubhouse_id = m.clubhouse_id
LEFT JOIN public.sectors AS s ON s.postal_code = m.postal_code
CROSS JOIN LATERAL (
    SELECT (statement_timestamp() AT TIME ZONE c.timezone)::date AS local_date
) AS d
LEFT JOIN LATERAL (
    SELECT max(a.attendance_date) AS last_visit_date
    FROM public.attendance AS a
    WHERE a.member_id = m.member_id AND a.attendance_date <= d.local_date
) AS v ON true;
CREATE OR REPLACE FUNCTION public.guard_archive_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,prometheus_private AS $fn$
DECLARE j jsonb:=to_jsonb(OLD); n jsonb:=to_jsonb(NEW); authorized boolean;
        private_fields text[]:=ARRAY['first_name','last_name','date_of_birth','salutation','gender',
         'phone','landline_phone','ori_interviewer_id','email','street_address','postal_code','city','country','name','relationship',
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
CREATE OR REPLACE FUNCTION public.guard_redacted_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE redacted timestamptz; member_owner uuid; staff_owner uuid;
BEGIN
    IF TG_ARGV[0] IN ('emergency_contacts','attendance') THEN member_owner:=NEW.member_id;
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
CREATE TRIGGER c_guard_redacted_content BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.guard_redacted_content('attendance');
CREATE OR REPLACE PROCEDURE public.redact_person(p_kind text,p_id uuid,p_confirmation text,p_reason_code text DEFAULT 'manual_request')
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
          gender=NULL,phone=NULL,landline_phone=NULL,ori_interviewer_id=NULL,email=NULL,street_address=NULL,postal_code=NULL,city=NULL,country=NULL,
          member_code=opaque_code,anonymized_at=coalesce(anonymized_at,clock_timestamp()) WHERE member_id=p_id;
        DELETE FROM public.emergency_contacts WHERE member_id=p_id;
        UPDATE public.members_deleted SET first_name=NULL,last_name=NULL,date_of_birth=NULL,salutation=NULL,
          gender=NULL,phone=NULL,landline_phone=NULL,ori_interviewer_id=NULL,email=NULL,street_address=NULL,postal_code=NULL,city=NULL,country=NULL,
          member_code=opaque_code,anonymized_at=coalesce(anonymized_at,clock_timestamp()),deletion_reason=NULL WHERE member_id=p_id;
        UPDATE public.emergency_contacts_deleted SET name=NULL,phone=NULL,relationship=NULL,
          deletion_reason=NULL WHERE member_id=p_id;
        UPDATE public.attendance SET note=NULL WHERE member_id=p_id;
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
        IF archive_name IN ('attendance_deleted','phone_calls_deleted','member_cash_transactions_deleted','clubhouse_cash_transactions_deleted','cashflow_deleted')
        THEN sets:=sets||',note=NULL'; END IF;
        EXECUTE format('UPDATE public.%I SET %s WHERE %s',archive_name,sets,cond) USING p_id;
    END LOOP;
    INSERT INTO public.privacy_events(entity,person_id,reason_code) VALUES(p_kind,p_id,p_reason_code);
    DELETE FROM prometheus_private.redaction_context
    WHERE transaction_id=txid_current() AND person_kind=p_kind AND person_id=p_id;
END $fn$;
COMMIT;
SELECT current_database() AS database_name,'Prometheus Redi V3 to V4 upgrade complete' AS result;
