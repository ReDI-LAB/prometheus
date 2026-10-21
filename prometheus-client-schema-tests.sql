-- PostgreSQL regression tests. Run AFTER prometheus-client-schema.sql.
-- All test rows and temporary functions are rolled back at the end.
-- DBeaver: Execute SQL Script, with stop-on-error enabled.
BEGIN;
SET LOCAL search_path = pg_catalog, public;

CREATE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
    IF p_condition IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: %', p_message;
    END IF;
END;
$fn$;

CREATE FUNCTION pg_temp.expect_error(p_sql text, p_sqlstate text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v_state text;
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
        IF v_state <> p_sqlstate THEN
            RAISE EXCEPTION 'Wrong error: expected %, got %. SQL: %', p_sqlstate, v_state, p_sql;
        END IF;
        RETURN;
    END;
    RAISE EXCEPTION 'Expected error %, but SQL succeeded: %', p_sqlstate, p_sql;
END;
$fn$;

DO $tests$
DECLARE
    v_house uuid := gen_random_uuid();
    v_house2 uuid := gen_random_uuid();
    v_member uuid := gen_random_uuid();
    v_member2 uuid := gen_random_uuid();
    v_staff uuid := gen_random_uuid();
    v_actor uuid := gen_random_uuid();
    v_call uuid := gen_random_uuid();
    v_staff_call uuid := gen_random_uuid();
    v_visit uuid := gen_random_uuid();
    v_contact uuid := gen_random_uuid();
    v_cash uuid := gen_random_uuid();
    v_day date := (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date;
    v_code text;
    v_initial_code text;
    v_created timestamptz;
    v_status text;
    v_latest uuid;
    v_count integer;
    v_i integer;
BEGIN
    PERFORM pg_temp.assert_true(public.membership_status_on(DATE '2026-01-01', DATE '2026-02-11') = 'mo', 'day 42 is MO');
    PERFORM pg_temp.assert_true(public.membership_status_on(DATE '2026-01-01', DATE '2026-02-12') = 'm', 'day 43 is M');
    PERFORM pg_temp.assert_true(public.membership_status_on(DATE '2026-01-01', DATE '2026-01-01') = 'mo', 'joining day is MO');
    PERFORM pg_temp.assert_true(public.activity_status_on(NULL, v_day) IS NULL, 'no attendance means no activity');
    PERFORM pg_temp.assert_true(public.activity_status_on(v_day - 90, v_day) = 'active', 'day 90 is active');
    PERFORM pg_temp.assert_true(public.activity_status_on(v_day - 91, v_day) = 'inactive', 'day 91 is inactive');
    PERFORM pg_temp.assert_true(public.code_name_part('Müller') = 'MUELLER', 'German umlaut transliteration');
    PERFORM pg_temp.assert_true(public.code_name_part('Groß-Ébert') = 'GROSSEBERT', 'sharp s, accents and punctuation');

    INSERT INTO public.clubhouses (clubhouse_id, name, timezone, country, primary_language)
    VALUES (v_house, '__schema_test__' || v_house, 'Europe/Berlin', 'DE', 'de'),
           (v_house2, '__schema_test__' || v_house2, 'Pacific/Auckland', 'DE', 'en');
    PERFORM pg_temp.expect_error(
        'INSERT INTO public.clubhouses(name,timezone) VALUES (''__invalid_tz__'', ''Mars/Olympus'')', '23514');

    INSERT INTO public.staff (staff_id, first_name, last_name, role)
    VALUES (v_staff, 'Ada', 'SchemaStaff', 'Test'), (v_actor, 'Alex', 'SchemaActor', 'Test');
    SELECT staff_code INTO v_code FROM public.staff WHERE staff_id = v_staff;
    PERFORM pg_temp.assert_true(v_code = 'SCHEMASTAFFA01', 'staff code generated');
    INSERT INTO public.staff_clubhouses (staff_id, clubhouse_id, is_primary)
    VALUES (v_staff, v_house, true), (v_staff, v_house2, false);
    PERFORM pg_temp.expect_error(format(
        'UPDATE public.staff_clubhouses SET is_primary=true WHERE staff_id=%L AND clubhouse_id=%L', v_staff, v_house2), '23505');
    UPDATE public.staff_clubhouses SET is_primary = false WHERE staff_id = v_staff AND clubhouse_id = v_house;
    UPDATE public.staff_clubhouses SET is_primary = true WHERE staff_id = v_staff AND clubhouse_id = v_house2;

    INSERT INTO public.members (member_id, clubhouse_id, first_name, last_name, date_of_birth, join_date, country)
    VALUES (v_member, v_house, 'Jasmin', 'Müller', DATE '1990-01-01', v_day - 41, 'DE'),
           (v_member2, v_house, 'Jonas', 'Mueller', DATE '1991-01-01', v_day - 42, 'DE');
    SELECT member_code, created_at INTO v_initial_code, v_created FROM public.members WHERE member_id = v_member;
    PERFORM pg_temp.assert_true(v_initial_code = 'MUELLERJ01', 'member code generated from client example');
    PERFORM pg_temp.assert_true((SELECT member_code = 'MUELLERJ02' FROM public.members WHERE member_id = v_member2), 'code collision increments suffix');
    PERFORM pg_temp.assert_true((SELECT membership_status = 'mo' AND activity_status IS NULL FROM public.members_current WHERE member_id=v_member), 'MO on day 42, activity NULL');
    PERFORM pg_temp.assert_true((SELECT membership_status = 'm' FROM public.members_current WHERE member_id=v_member2), 'M on day 43');
    PERFORM pg_temp.expect_error(format('UPDATE public.members SET membership_status=''m'' WHERE member_id=%L', v_member), '23514');
    PERFORM pg_temp.expect_error(format('UPDATE public.members SET activity_status=''active'' WHERE member_id=%L', v_member), '23514');
    PERFORM pg_temp.expect_error(format('UPDATE public.members SET member_code=''OTHER01'' WHERE member_id=%L', v_member), '23514');
    PERFORM pg_temp.expect_error(format('UPDATE public.members SET member_id=gen_random_uuid() WHERE member_id=%L', v_member), '23514');
    PERFORM pg_temp.expect_error(format('UPDATE public.staff SET staff_code=''OTHER01'' WHERE staff_id=%L', v_staff), '23514');
    PERFORM pg_temp.expect_error(format('UPDATE public.staff SET staff_id=gen_random_uuid() WHERE staff_id=%L', v_staff), '23514');
    PERFORM pg_temp.expect_error(format(
        'INSERT INTO public.members(clubhouse_id,member_code,first_name,last_name,date_of_birth,join_date) VALUES (%L,''MANUAL01'',''A'',''B'',''1990-01-01'',%L)', v_house, v_day), '23514');
    UPDATE public.members SET first_name = 'Changed', last_name = 'Changed', created_at = now() - interval '1 day'
    WHERE member_id = v_member;
    PERFORM pg_temp.assert_true((SELECT member_code=v_initial_code AND created_at=v_created AND updated_at>created_at FROM public.members WHERE member_id=v_member), 'code stable after name change, timestamps maintained');
    UPDATE public.members SET join_date=v_day-42 WHERE member_id=v_member;
    PERFORM pg_temp.assert_true((SELECT membership_status='m' FROM public.members WHERE member_id=v_member), 'join-date edit recalculates status');
    PERFORM pg_temp.expect_error(format('UPDATE public.members SET membership_status=''mo'' WHERE member_id=%L', v_member), '23514');

    INSERT INTO public.phone_calls(call_id,person_id,person_type,call_date,duration_minutes,topic_code)
    VALUES (v_call,v_member,'member',v_day,1,3), (v_staff_call,v_staff,'staff',v_day,5,1);
    PERFORM pg_temp.assert_true((SELECT member_reference_id=v_member AND staff_reference_id IS NULL FROM public.phone_calls WHERE call_id=v_call), 'generated member FK');
    PERFORM pg_temp.assert_true((SELECT staff_reference_id=v_staff AND member_reference_id IS NULL FROM public.phone_calls WHERE call_id=v_staff_call), 'generated staff FK');
    PERFORM pg_temp.expect_error(format('DELETE FROM public.members WHERE member_id=%L', v_member), '23503');
    PERFORM pg_temp.expect_error(format('DELETE FROM public.staff WHERE staff_id=%L', v_staff), '23503');
    PERFORM pg_temp.expect_error(format(
        'INSERT INTO public.phone_calls(person_id,person_type,call_date,duration_minutes,topic_code) VALUES (%L,''member'',%L,1,1)', v_staff, v_day), '23503');
    PERFORM pg_temp.expect_error(format('UPDATE public.phone_calls SET person_type=''staff'' WHERE call_id=%L', v_call), '23503');
    PERFORM pg_temp.expect_error(format('UPDATE public.phone_calls SET duration_minutes=0 WHERE call_id=%L', v_call), '23514');
    PERFORM pg_temp.expect_error(format('UPDATE public.phone_calls SET topic_code=999 WHERE call_id=%L', v_call), '23503');
    PERFORM pg_temp.expect_error(format('UPDATE public.phone_calls SET call_id=gen_random_uuid() WHERE call_id=%L', v_call), '23514');

    PERFORM set_config('prometheus.deleted_by', v_actor::text, true);
    PERFORM set_config('prometheus.deletion_reason', 'Regression test', true);
    DELETE FROM public.phone_calls WHERE call_id IN (v_call,v_staff_call);
    PERFORM pg_temp.assert_true((SELECT count(*)=2 FROM public.phone_calls_deleted WHERE call_id IN(v_call,v_staff_call) AND deleted_by=v_actor AND deletion_reason='Regression test'), 'call archives and actor');

    INSERT INTO public.attendance(attendance_id,member_id,attendance_date,time_in,time_out)
    VALUES (v_visit,v_member,v_day-90,TIME '09:00',NULL);
    PERFORM pg_temp.assert_true((SELECT activity_status='active' FROM public.members WHERE member_id=v_member), 'attendance inserts refresh cached status');
    UPDATE public.attendance SET attendance_date=v_day-91, time_out=TIME '10:00' WHERE attendance_id=v_visit;
    PERFORM pg_temp.assert_true((SELECT activity_status='inactive' FROM public.members_current WHERE member_id=v_member), 'old visit gives inactive status');
    PERFORM pg_temp.assert_true((SELECT activity_status='inactive' FROM public.members WHERE member_id=v_member), 'attendance updates refresh cache');
    PERFORM pg_temp.expect_error(format('UPDATE public.attendance SET time_out=''08:00'' WHERE attendance_id=%L', v_visit), '23514');
    PERFORM pg_temp.expect_error(format('DELETE FROM public.members WHERE member_id=%L', v_member), '23503');
    UPDATE public.attendance SET member_id=v_member2 WHERE attendance_id=v_visit;
    PERFORM pg_temp.assert_true((SELECT activity_status IS NULL FROM public.members WHERE member_id=v_member), 'moving attendance resets old member');
    PERFORM pg_temp.assert_true((SELECT activity_status='inactive' FROM public.members WHERE member_id=v_member2), 'moving attendance updates new member');
    DELETE FROM public.attendance WHERE attendance_id=v_visit;
    PERFORM pg_temp.assert_true((SELECT activity_status IS NULL FROM public.members WHERE member_id=v_member2), 'deleting last visit resets activity');
    PERFORM pg_temp.assert_true((SELECT member_id=v_member2 AND time_out=TIME '10:00' AND deleted_by=v_actor FROM public.attendance_deleted WHERE attendance_id=v_visit), 'attendance archive snapshot');
    INSERT INTO public.attendance(member_id,attendance_date,time_in)
    VALUES (v_member,v_day+1,TIME '09:00');
    PERFORM pg_temp.assert_true((SELECT activity_status IS NULL FROM public.members_current WHERE member_id=v_member), 'future-dated visit is ignored until its day');
    DELETE FROM public.attendance WHERE member_id=v_member;

    INSERT INTO public.cash_transactions(transaction_id,member_id,transaction_date,transaction_type,amount,currency,recorded_by)
    VALUES (v_cash,v_member,v_day,'deposit',10.25,'EUR',v_staff);
    PERFORM pg_temp.expect_error(format('UPDATE public.cash_transactions SET amount=0 WHERE transaction_id=%L', v_cash), '23514');
    PERFORM pg_temp.expect_error(format('UPDATE public.cash_transactions SET amount=''NaN'' WHERE transaction_id=%L', v_cash), '23514');
    PERFORM pg_temp.expect_error(format('UPDATE public.cash_transactions SET currency=''XXX'' WHERE transaction_id=%L', v_cash), '23503');
    PERFORM pg_temp.expect_error(format('DELETE FROM public.members WHERE member_id=%L', v_member), '23503');
    PERFORM pg_temp.expect_error(format('DELETE FROM public.staff WHERE staff_id=%L', v_staff), '23503');
    DELETE FROM public.cash_transactions WHERE transaction_id=v_cash;
    PERFORM pg_temp.assert_true((SELECT amount=10.25 AND recorded_by=v_staff AND deleted_by=v_actor FROM public.cash_transactions_deleted WHERE transaction_id=v_cash), 'cash archive retains financial snapshot');

    INSERT INTO public.translations(table_name,code,language_code,label)
    VALUES ('salutations','ms','fr','Madame');
    PERFORM pg_temp.expect_error('INSERT INTO public.translations(table_name,code,language_code,label) VALUES (''salutations'',''missing'',''fr'',''Unknown'')', '23503');
    PERFORM pg_temp.expect_error('INSERT INTO public.translations(table_name,code,language_code,label) VALUES (''unknown_table'',''ms'',''fr'',''Unknown'')', '23514');
    PERFORM pg_temp.expect_error('INSERT INTO public.translations(table_name,code,language_code,label) VALUES (''call_topics'',''999'',''fr'',''Unknown'')', '23503');
    PERFORM pg_temp.expect_error('INSERT INTO public.translations(table_name,code,language_code,label) VALUES (''call_topics'',''03'',''fr'',''Unknown'')', '23514');
    PERFORM pg_temp.expect_error('DELETE FROM public.salutations WHERE code=''ms''', '23503');
    PERFORM pg_temp.expect_error('INSERT INTO public.translations(table_name,code,language_code,label) VALUES (''salutations'',''ms'',''en'',''Duplicate'')', '23505');

    INSERT INTO public.emergency_contacts(contact_id,member_id,name,phone,relationship)
    VALUES (v_contact,v_member,'Contact','+49 123','mother');
    PERFORM pg_temp.expect_error(format('UPDATE public.emergency_contacts SET phone='''' WHERE contact_id=%L', v_contact), '23514');
    PERFORM pg_temp.expect_error(format('UPDATE public.emergency_contacts SET relationship=''missing'' WHERE contact_id=%L', v_contact), '23503');
    DELETE FROM public.members WHERE member_id=v_member;
    PERFORM pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.emergency_contacts WHERE contact_id=v_contact), 'contact cascades on member delete');
    PERFORM pg_temp.assert_true((SELECT deleted_by=v_actor AND member_id=v_member FROM public.emergency_contacts_deleted WHERE contact_id=v_contact), 'cascade archive preserves transaction actor');
    PERFORM pg_temp.assert_true((SELECT country='DE' AND member_code=v_initial_code AND first_name='Changed' FROM public.members_deleted WHERE member_id=v_member), 'member archive includes missing country field');
    PERFORM pg_temp.expect_error(format('UPDATE public.members_deleted SET first_name=''EDIT'' WHERE member_id=%L', v_member), '23514');
    PERFORM pg_temp.expect_error(format(
        'INSERT INTO public.members(member_id,clubhouse_id,first_name,last_name,date_of_birth,join_date) VALUES (%L,%L,''Jasmin'',''Mueller'',''1990-01-01'',%L)', v_member,v_house,v_day), '23514');
    INSERT INTO public.members(clubhouse_id,first_name,last_name,date_of_birth,join_date)
    VALUES (v_house,'Jasmin','Mueller',DATE '1990-01-01',v_day) RETURNING member_code INTO v_code;
    PERFORM pg_temp.assert_true(v_code='MUELLERJ03', 'archived code is not reused');

    DELETE FROM public.staff WHERE staff_id=v_staff;
    PERFORM pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.staff_clubhouses WHERE staff_id=v_staff), 'staff assignments cascade');
    PERFORM pg_temp.assert_true((SELECT staff_code='SCHEMASTAFFA01' AND deleted_by=v_actor FROM public.staff_deleted WHERE staff_id=v_staff), 'staff archive generated');
    DELETE FROM public.staff WHERE staff_id=v_actor;
    PERFORM pg_temp.assert_true((SELECT deleted_by IS NULL FROM public.staff_deleted WHERE staff_id=v_actor), 'self-deletion safely clears live actor FK');
    PERFORM pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.phone_calls_deleted WHERE deleted_by=v_actor), 'actor deletion clears history actor via SET NULL');
    PERFORM pg_temp.assert_true((SELECT deletion_reason='Regression test' AND country='DE' FROM public.members_deleted WHERE member_id=v_member), 'actor cleanup preserves archived payload');
    PERFORM set_config('prometheus.deleted_by', '', true);

    -- Verify three-digit suffixes and code reservation after deletion.
    FOR v_i IN 1..101 LOOP
        INSERT INTO public.members(clubhouse_id,first_name,last_name,date_of_birth,join_date)
        VALUES (v_house,'Test','SchemaOverflow',DATE '1990-01-01',v_day)
        RETURNING member_id, member_code INTO v_latest,v_code;
    END LOOP;
    PERFORM pg_temp.assert_true(v_code='SCHEMAOVERFLOWT101', 'suffix grows beyond 99 without truncation');
    DELETE FROM public.members WHERE member_id=v_latest;
    INSERT INTO public.members(clubhouse_id,first_name,last_name,date_of_birth,join_date)
    VALUES (v_house,'Test','SchemaOverflow',DATE '1990-01-01',v_day) RETURNING member_code INTO v_code;
    PERFORM pg_temp.assert_true(v_code='SCHEMAOVERFLOWT102', 'deleted highest suffix remains reserved');
    CALL public.refresh_member_status_cache();
    SELECT count(*) INTO v_count FROM public.members AS m JOIN public.members_current AS c USING(member_id)
    WHERE m.membership_status IS DISTINCT FROM c.membership_status OR m.activity_status IS DISTINCT FROM c.activity_status;
    PERFORM pg_temp.assert_true(v_count=0, 'cache refresh agrees with current view');
    RAISE NOTICE 'PASS: business rules, codes, FKs, archives, localization and boundaries.';
END;
$tests$;

-- Simulate obsolete cache values; verify the view still computes the correct result.
-- Only test-created rows exist here; the whole transaction is rolled back.
ALTER TABLE public.members DISABLE TRIGGER b_refresh_member;
INSERT INTO public.clubhouses(clubhouse_id,name,timezone)
VALUES ('00000000-0000-0000-0000-000000000901','__cache_test_901__','Pacific/Auckland');
INSERT INTO public.members(member_id,clubhouse_id,first_name,last_name,date_of_birth,join_date,membership_status,activity_status)
VALUES ('00000000-0000-0000-0000-000000000902','00000000-0000-0000-0000-000000000901','Cache','SchemaCache',DATE '1990-01-01',DATE '2020-01-01','mo','active');
ALTER TABLE public.members ENABLE TRIGGER b_refresh_member;
SELECT pg_temp.assert_true(
    (SELECT membership_status='m' AND activity_status IS NULL
     AND status_as_of=(statement_timestamp() AT TIME ZONE 'Pacific/Auckland')::date
     FROM public.members_current WHERE member_id='00000000-0000-0000-0000-000000000902'),
    'view calculates current statuses and local date despite obsolete cache');
CALL public.refresh_member_status_cache();
SELECT pg_temp.assert_true(
    (SELECT membership_status='m' AND activity_status IS NULL FROM public.members
     WHERE member_id='00000000-0000-0000-0000-000000000902'), 'cache repaired');

ROLLBACK;
SELECT 'PASS: all tests completed; all test data rolled back.' AS result;
