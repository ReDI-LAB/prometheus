
-- Prometheus Redi VERSION 2 regression tests. Run ENTIRE file in prometheus_redi, stop on error.
-- Synthetic rows only. Final ROLLBACK removes ALL test rows and temporary helpers.
-- On any error, stop and execute ROLLBACK; before retrying. Never rerun the installer.
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'prometheus_redi' OR to_regclass('public.cashflow') IS NULL THEN
  RAISE EXCEPTION 'Connect to an installed prometheus_redi database first.'; END IF;
END $guard$;
CREATE TEMP TABLE redi_test_results(test_name text PRIMARY KEY,result text NOT NULL) ON COMMIT DROP;
CREATE FUNCTION pg_temp.check_redi(p_name text,p_pass boolean) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
 IF p_pass IS DISTINCT FROM true THEN RAISE EXCEPTION 'TEST FAILED: %',p_name; END IF;
 INSERT INTO redi_test_results VALUES(p_name,'PASS');
END $fn$;
CREATE FUNCTION pg_temp.expect_redi_error(p_name text,p_sql text,p_state text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE state text; msg text;
BEGIN
 BEGIN EXECUTE p_sql;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE,msg=MESSAGE_TEXT; END;
 IF state IS DISTINCT FROM p_state THEN
  RAISE EXCEPTION 'TEST FAILED: %, expected %, got % (%)',p_name,p_state,coalesce(state,'no error'),msg;
 END IF;
 INSERT INTO redi_test_results VALUES(p_name,'PASS');
END $fn$;
SELECT pg_temp.check_redi('35 logical public tables (monthly children excluded)',
 (SELECT count(*)=35 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relispartition));
SELECT pg_temp.check_redi('Removed tables/views are absent',
 to_regclass('public.translations') IS NULL AND to_regclass('public.staff_clubhouses') IS NULL
 AND to_regclass('public.lookup_labels') IS NULL AND to_regclass('public.cash_transactions') IS NULL);
SELECT pg_temp.check_redi('Five monthly partitioned parents',
 (SELECT count(*)=5 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='p'));
SELECT pg_temp.check_redi('Cash lookup labels retained',
 (SELECT count(*)=5 FROM public.currencies));
SELECT pg_temp.check_redi('Accounts lookup and live/archive account fields are absent',
 to_regclass('public.accounts') IS NULL
 AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND table_name IN ('clubhouse_cash_transactions','clubhouse_cash_transactions_deleted')
  AND column_name='account'));
SELECT pg_temp.check_redi('Only deposit and purchase transaction types are configured',
 (SELECT count(*)=2 AND bool_and(code IN ('deposit','purchase')) FROM public.cash_transaction_types));
SELECT pg_temp.expect_redi_error('Unsupported transaction type cannot be added to lookup',
 $$INSERT INTO public.cash_transaction_types(code,label,sort_order) VALUES('refund','Not supported',999)$$,'23514');
SELECT pg_temp.check_redi('Day 42 is_member is false (MO)',public.membership_status_on(DATE '2026-01-01',DATE '2026-02-11') IS FALSE);
SELECT pg_temp.check_redi('Day 43 is_member is true (M)',public.membership_status_on(DATE '2026-01-01',DATE '2026-02-12') IS TRUE);
SELECT pg_temp.check_redi('No attendance means NULL',public.activity_status_on(NULL,current_date) IS NULL);
SELECT pg_temp.check_redi('Activity day 90 is_active is true',public.activity_status_on(current_date-90,current_date) IS TRUE);
SELECT pg_temp.check_redi('Activity day 91 is_active is false',public.activity_status_on(current_date-91,current_date) IS FALSE);
SELECT pg_temp.check_redi('All five live/archive status columns are Boolean',
 (SELECT count(*)=5 AND bool_and(data_type='boolean') FROM information_schema.columns
  WHERE table_schema='public' AND (table_name,column_name) IN
  (('clubhouses','is_active'),('members','is_member'),('members','is_active'),
   ('members_deleted','is_member'),('members_deleted','is_active'))));
SELECT pg_temp.check_redi('Old text status columns are absent',
 NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
 AND table_name IN ('clubhouses','members','members_deleted')
 AND column_name IN ('clubhouse_status','membership_status','activity_status')));
SELECT pg_temp.check_redi('Private schema is not public',
 NOT has_schema_privilege('public','prometheus_private','USAGE'));
SELECT pg_temp.check_redi('Privacy procedure is not public',
 NOT has_function_privilege('public','public.redact_person(text,uuid,text,text)','EXECUTE'));
SELECT pg_temp.check_redi('Partition maintenance is not public',
 NOT has_function_privilege('public','public.ensure_monthly_partitions(date,date)','EXECUTE'));
SELECT pg_temp.check_redi('Retention candidates initially disabled',
 (SELECT count(*)=0 FROM public.retention_candidates));

INSERT INTO public.clubhouses(clubhouse_id,name,timezone) VALUES
 ('10000000-0000-0000-0000-000000000001','TEST_REDI_A','Europe/Berlin'),
 ('10000000-0000-0000-0000-000000000002','TEST_REDI_B','Europe/Berlin'),
 ('10000000-0000-0000-0000-000000000003','TEST_REDI_C','Europe/Berlin');
SELECT pg_temp.check_redi('Clubhouse is_active defaults to true',
 (SELECT is_active IS TRUE FROM public.clubhouses WHERE clubhouse_id='10000000-0000-0000-0000-000000000001'));
UPDATE public.clubhouses SET is_active=false WHERE clubhouse_id='10000000-0000-0000-0000-000000000003';
SELECT pg_temp.check_redi('Clubhouse is_active can be false',
 (SELECT is_active IS FALSE FROM public.clubhouses WHERE clubhouse_id='10000000-0000-0000-0000-000000000003'));
SELECT pg_temp.expect_redi_error('Clubhouse is_active cannot be NULL',
 $$UPDATE public.clubhouses SET is_active=NULL WHERE clubhouse_id='10000000-0000-0000-0000-000000000003'$$,'23502');
SELECT pg_temp.expect_redi_error('Invalid timezone rejected',
 $$INSERT INTO public.clubhouses(name,timezone) VALUES('TEST_BAD_TZ','Not/A_Timezone')$$,'23514');
INSERT INTO public.staff(staff_id,first_name,last_name,role,clubhouse_id,email) VALUES
 ('20000000-0000-0000-0000-000000000001','Test','Worker','staff',
 '10000000-0000-0000-0000-000000000001','test-redi@example.invalid');
SELECT pg_temp.expect_redi_error('Staff must belong to a clubhouse',
 $$INSERT INTO public.staff(first_name,last_name,role) VALUES('Test','MissingClub','staff')$$,'23502');
SELECT pg_temp.expect_redi_error('Unknown staff status rejected',
 $$UPDATE public.staff SET staff_status='invented' WHERE staff_id='20000000-0000-0000-0000-000000000001'$$,'23503');
INSERT INTO public.members(member_id,clubhouse_id,first_name,last_name,date_of_birth,join_date) VALUES
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Test','Müller',DATE '1990-01-01',current_date-100),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Test','Müller',DATE '1991-01-01',current_date-100),
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','Test','UnknownBalance',DATE '1992-01-01',current_date-100);
SELECT pg_temp.check_redi('Name codes generated and incremented',
 (SELECT member_code='MUELLERT01' FROM public.members WHERE member_id='30000000-0000-0000-0000-000000000001')
 AND (SELECT member_code='MUELLERT02' FROM public.members WHERE member_id='30000000-0000-0000-0000-000000000002'));
SELECT pg_temp.check_redi('Membership computed automatically',
 (SELECT is_member IS TRUE AND is_active IS NULL FROM public.members_current
 WHERE member_id='30000000-0000-0000-0000-000000000001'));
SELECT pg_temp.expect_redi_error('Manual membership change rejected',
 $$UPDATE public.members SET is_member=false WHERE member_id='30000000-0000-0000-0000-000000000001'$$,'23514');
SELECT pg_temp.expect_redi_error('Manual activity change rejected',
 $$UPDATE public.members SET is_active=false WHERE member_id='30000000-0000-0000-0000-000000000001'$$,'23514');
SELECT pg_temp.expect_redi_error('Ordinary member needs DOB',
 $$UPDATE public.members SET date_of_birth=NULL WHERE member_id='30000000-0000-0000-0000-000000000001'$$,'23514');
SELECT pg_temp.expect_redi_error('Invalid member departure date rejected',
 $$UPDATE public.members SET leave_date=join_date-1 WHERE member_id='30000000-0000-0000-0000-000000000001'$$,'23514');
SELECT pg_temp.expect_redi_error('Invalid staff date range rejected',
 $$UPDATE public.staff SET start_date=current_date,end_date=current_date-1
 WHERE staff_id='20000000-0000-0000-0000-000000000001'$$,'23514');
SELECT pg_temp.expect_redi_error('Manual person code rejected',
 $$UPDATE public.members SET member_code='MANUAL01' WHERE member_id='30000000-0000-0000-0000-000000000001'$$,'23514');
SELECT pg_temp.expect_redi_error('Orphan attendance rejected',
 $$INSERT INTO public.attendance(member_id,attendance_date,time_in)
 VALUES('39999999-0000-0000-0000-000000000000',current_date,'09:00')$$,'23503');
INSERT INTO public.attendance(attendance_id,member_id,attendance_date,time_in,time_out) VALUES
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',current_date-1,'09:00','15:00');
SELECT pg_temp.check_redi('Attendance refreshes live activity',
 (SELECT is_active IS TRUE FROM public.members_current WHERE member_id='30000000-0000-0000-0000-000000000001'));
UPDATE public.attendance SET attendance_date=(date_trunc('month',current_date)-interval '1 month')::date
 WHERE attendance_id='40000000-0000-0000-0000-000000000001';
SELECT pg_temp.check_redi('Cross-month correction does not create false deletion archive',
 (SELECT count(*)=0 FROM public.attendance_deleted WHERE attendance_id='40000000-0000-0000-0000-000000000001'));
DELETE FROM public.attendance WHERE attendance_id='40000000-0000-0000-0000-000000000001';
SELECT pg_temp.check_redi('Parent attendance deletion is archived once',
 (SELECT count(*)=1 FROM public.attendance_deleted WHERE attendance_id='40000000-0000-0000-0000-000000000001'));
SELECT pg_temp.check_redi('Deleting the only visit restores NULL activity',
 (SELECT is_active IS NULL FROM public.members_current WHERE member_id='30000000-0000-0000-0000-000000000001')
 AND (SELECT is_active IS NULL FROM public.members WHERE member_id='30000000-0000-0000-0000-000000000001'));
SELECT pg_temp.expect_redi_error('Archived attendance cannot be edited',
 $$UPDATE public.attendance_deleted SET time_in='10:00' WHERE attendance_id='40000000-0000-0000-0000-000000000001'$$,'23514');
SELECT pg_temp.expect_redi_error('Archived event UUID cannot be reused',
 $$INSERT INTO public.attendance(attendance_id,member_id,attendance_date,time_in)
 VALUES('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',current_date,'09:00')$$,'23514');

-- Opening balances are start-of-day, transactions/cashflow tested on current_date-5.
INSERT INTO public.cash_opening_balances(clubhouse_id,member_id,balance_date,currency,amount,recorded_by,source_reference) VALUES
 ('10000000-0000-0000-0000-000000000001',NULL,current_date-60,'EUR',200,'20000000-0000-0000-0000-000000000001','TEST opening'),
 (NULL,'30000000-0000-0000-0000-000000000001',current_date-60,'EUR',100,'20000000-0000-0000-0000-000000000001','TEST opening'),
 (NULL,'30000000-0000-0000-0000-000000000002',current_date-60,'EUR',0,'20000000-0000-0000-0000-000000000001','TEST explicit zero');
SELECT pg_temp.expect_redi_error('Opening balance requires exactly one real owner',
 $$INSERT INTO public.cash_opening_balances(balance_date,currency,amount,recorded_by,source_reference)
 VALUES(current_date,'EUR',0,'20000000-0000-0000-0000-000000000001','TEST')$$,'23514');
SELECT pg_temp.expect_redi_error('Duplicate initial balance rejected',
 $$INSERT INTO public.cash_opening_balances(member_id,balance_date,currency,amount,recorded_by,source_reference)
 VALUES('30000000-0000-0000-0000-000000000001',current_date-60,'EUR',100,'20000000-0000-0000-0000-000000000001','TEST')$$,'23505');
INSERT INTO public.member_cash_transactions(member_transaction_id,member_id,transaction_date,transaction_type,amount,currency,recorded_by,note) VALUES
 ('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',current_date-5,'deposit',20,'EUR','20000000-0000-0000-0000-000000000001','TEST PRIVATE member note'),
 ('50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001',current_date-5,'purchase',5,'EUR','20000000-0000-0000-0000-000000000001',NULL),
 ('50000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003',current_date-5,'deposit',10,'EUR','20000000-0000-0000-0000-000000000001',NULL);
SELECT pg_temp.expect_redi_error('Transactions before known baseline rejected',
 $$INSERT INTO public.member_cash_transactions(member_id,transaction_date,transaction_type,amount,currency,recorded_by)
 VALUES('30000000-0000-0000-0000-000000000001',current_date-61,'deposit',1,'EUR','20000000-0000-0000-0000-000000000001')$$,'23514');
SELECT pg_temp.expect_redi_error('Late baseline cannot conceal imported history',
 $$INSERT INTO public.cash_opening_balances(member_id,balance_date,currency,amount,recorded_by,source_reference)
 VALUES('30000000-0000-0000-0000-000000000003',current_date,'EUR',0,'20000000-0000-0000-0000-000000000001','TEST')$$,'23514');
SELECT pg_temp.expect_redi_error('Non-positive payment rejected',
 $$INSERT INTO public.member_cash_transactions(member_id,transaction_date,transaction_type,amount,currency,recorded_by)
 VALUES('30000000-0000-0000-0000-000000000001',current_date,'deposit',0,'EUR','20000000-0000-0000-0000-000000000001')$$,'23514');
SELECT pg_temp.expect_redi_error('NaN payment rejected',
 $$INSERT INTO public.member_cash_transactions(member_id,transaction_date,transaction_type,amount,currency,recorded_by)
 VALUES('30000000-0000-0000-0000-000000000001',current_date,'deposit','NaN','EUR','20000000-0000-0000-0000-000000000001')$$,'23514');
SELECT pg_temp.expect_redi_error('Clubhouse operation rejects unsupported transaction type',
 $$INSERT INTO public.clubhouse_cash_transactions(clubhouse_id,transaction_date,transaction_type,amount,currency,recorded_by)
 VALUES('10000000-0000-0000-0000-000000000001',current_date-5,'refund',50,'EUR','20000000-0000-0000-0000-000000000001')$$,'23514');
INSERT INTO public.clubhouse_cash_transactions(clubhouse_transaction_id,clubhouse_id,transaction_date,transaction_type,amount,currency,recorded_by,note) VALUES
 ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_date-5,'deposit',50,'EUR','20000000-0000-0000-0000-000000000001','TEST PRIVATE staff note'),
 ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',current_date-5,'purchase',20,'EUR','20000000-0000-0000-0000-000000000001',NULL);
SELECT pg_temp.check_redi('Generated month is first day',
 (SELECT month=date_trunc('month',transaction_date)::date FROM public.clubhouse_cash_transactions
 WHERE clubhouse_transaction_id='60000000-0000-0000-0000-000000000001'));
INSERT INTO public.cashflow(cashflow_id,clubhouse_id,cashflow_date,cash_total_id,amount,currency,recorded_by) VALUES
 ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_date-5,1,230,'EUR','20000000-0000-0000-0000-000000000001'),
 ('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',current_date-5,2,115,'EUR','20000000-0000-0000-0000-000000000001'),
 ('70000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003',current_date-5,2,10,'EUR','20000000-0000-0000-0000-000000000001');
SELECT pg_temp.check_redi('Clubhouse balance opening+deposit-purchase=230',
 (SELECT computed_balance=230 AND difference=0 AND reconciliation_status='ok' FROM public.finance_reconciliation
 WHERE clubhouse_id='10000000-0000-0000-0000-000000000001' AND cash_total_id=1 AND currency='EUR' AND balance_date=current_date-5));
SELECT pg_temp.check_redi('Member balances reconciled separately=115',
 (SELECT computed_balance=115 AND reconciliation_status='ok' AND owners_count=2 FROM public.finance_reconciliation
 WHERE clubhouse_id='10000000-0000-0000-0000-000000000001' AND cash_total_id=2 AND currency='EUR' AND balance_date=current_date-5));
SELECT pg_temp.check_redi('Unknown opening is NULL, not zero',
 (SELECT computed_balance IS NULL AND difference IS NULL AND reconciliation_status='missing_opening_balance'
 FROM public.finance_reconciliation WHERE clubhouse_id='10000000-0000-0000-0000-000000000003'
 AND cash_total_id=2 AND currency='EUR' AND balance_date=current_date-5));
SELECT pg_temp.check_redi('Different currency does not inherit EUR balance',
 (SELECT computed_balance IS NULL AND missing_openings=1
 FROM public.calculated_cash_balance('10000000-0000-0000-0000-000000000001',1::smallint,'CHF',current_date)));
SELECT pg_temp.expect_redi_error('Duplicate daily cashflow rejected',
 $$INSERT INTO public.cashflow(clubhouse_id,cashflow_date,cash_total_id,amount,currency,recorded_by)
 VALUES('10000000-0000-0000-0000-000000000001',current_date-5,1,230,'EUR','20000000-0000-0000-0000-000000000001')$$,'23505');
UPDATE public.members SET clubhouse_id='10000000-0000-0000-0000-000000000002'
 WHERE member_id='30000000-0000-0000-0000-000000000001';
SELECT pg_temp.check_redi('Transfer does not move historical report points to the new clubhouse',
 NOT EXISTS(SELECT 1 FROM public.finance_reconciliation WHERE clubhouse_id='10000000-0000-0000-0000-000000000002'
 AND cash_total_id=2 AND currency='EUR' AND balance_date=current_date-5));
SELECT pg_temp.check_redi('Old clubhouse keeps its transactions, opening and reconciled balance',
 (SELECT recorded_balance=115 AND computed_balance=115 AND reconciliation_status='ok' AND NOT transfer_may_affect_history
 FROM public.finance_reconciliation WHERE clubhouse_id='10000000-0000-0000-0000-000000000001'
 AND cash_total_id=2 AND currency='EUR' AND balance_date=current_date-5));
SELECT pg_temp.check_redi('Transaction clubhouse defaults on insert and survives a member transfer',
 (SELECT count(*)=2 AND bool_and(clubhouse_id='10000000-0000-0000-0000-000000000001')
 FROM public.member_cash_transactions WHERE member_id='30000000-0000-0000-0000-000000000001'));
SELECT pg_temp.check_redi('Member opening retains its original clubhouse',
 (SELECT clubhouse_id='10000000-0000-0000-0000-000000000001' FROM public.cash_opening_balances
 WHERE member_id='30000000-0000-0000-0000-000000000001'));
UPDATE public.member_cash_transactions SET amount=21 WHERE member_transaction_id='50000000-0000-0000-0000-000000000001';
SELECT pg_temp.check_redi('App correction after transfer changes the saved clubhouse report only',
 (SELECT computed_balance=116 FROM public.calculated_cash_balance('10000000-0000-0000-0000-000000000001',2::smallint,'EUR',current_date-5))
 AND (SELECT clubhouse_id='10000000-0000-0000-0000-000000000001' FROM public.member_cash_transactions
 WHERE member_transaction_id='50000000-0000-0000-0000-000000000001'));
UPDATE public.member_cash_transactions SET amount=20 WHERE member_transaction_id='50000000-0000-0000-0000-000000000001';
SELECT pg_temp.check_redi('Corrections do not create an audit of old values',
 NOT EXISTS(SELECT 1 FROM public.member_cash_transactions_deleted WHERE member_transaction_id='50000000-0000-0000-0000-000000000001'));
SELECT pg_temp.expect_redi_error('Update cannot silently recapture a NULL clubhouse',
 $$UPDATE public.member_cash_transactions SET clubhouse_id=NULL WHERE member_transaction_id='50000000-0000-0000-0000-000000000001'$$,'23502');
SELECT pg_temp.expect_redi_error('Transaction clubhouse has a real foreign key',
 $$UPDATE public.member_cash_transactions SET clubhouse_id='19999999-0000-0000-0000-000000000000'
 WHERE member_transaction_id='50000000-0000-0000-0000-000000000001'$$,'23503');
INSERT INTO public.member_cash_transactions(member_transaction_id,member_id,transaction_date,transaction_type,amount,currency,recorded_by)
VALUES('50000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000001',current_date-4,'deposit',7,'EUR','20000000-0000-0000-0000-000000000001');
SELECT pg_temp.check_redi('New operation defaults to the new clubhouse without carrying old funds',
 (SELECT clubhouse_id='10000000-0000-0000-0000-000000000002' FROM public.member_cash_transactions
 WHERE member_transaction_id='50000000-0000-0000-0000-000000000005')
 AND (SELECT computed_balance=7 FROM public.calculated_cash_balance('10000000-0000-0000-0000-000000000002',2::smallint,'EUR',current_date-4))
 AND (SELECT computed_balance=115 FROM public.calculated_cash_balance('10000000-0000-0000-0000-000000000001',2::smallint,'EUR',current_date-4)));
DELETE FROM public.member_cash_transactions WHERE member_transaction_id='50000000-0000-0000-0000-000000000005';
SELECT pg_temp.check_redi('Deletion archive retains the operation clubhouse',
 (SELECT clubhouse_id='10000000-0000-0000-0000-000000000002' FROM public.member_cash_transactions_deleted
 WHERE member_transaction_id='50000000-0000-0000-0000-000000000005'));
INSERT INTO public.member_cash_transactions(member_transaction_id,member_id,clubhouse_id,transaction_date,transaction_type,amount,currency,recorded_by)
VALUES('50000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_date-5,'deposit',3,'EUR','20000000-0000-0000-0000-000000000001');
SELECT pg_temp.check_redi('Historical import can explicitly name its original clubhouse',
 (SELECT computed_balance=118 FROM public.calculated_cash_balance('10000000-0000-0000-0000-000000000001',2::smallint,'EUR',current_date-5)));
DELETE FROM public.member_cash_transactions WHERE member_transaction_id='50000000-0000-0000-0000-000000000006';

INSERT INTO public.emergency_contacts(contact_id,member_id,name,phone) VALUES
 ('80000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','TEST PRIVATE contact','123'),
 ('80000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','TEST PRIVATE oldcontact','456');
DELETE FROM public.emergency_contacts WHERE contact_id='80000000-0000-0000-0000-000000000002';
INSERT INTO public.phone_calls(call_id,person_id,person_type,call_date,duration_minutes,topic_code,note) VALUES
 ('90000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','member',current_date-5,5,3,'TEST PRIVATE call'),
 ('90000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','member',current_date-5,5,3,'TEST PRIVATE deleted call');
DELETE FROM public.phone_calls WHERE call_id='90000000-0000-0000-0000-000000000002';
SELECT pg_temp.expect_redi_error('Polymorphic call still has real FK',
 $$INSERT INTO public.phone_calls(person_id,person_type,call_date,duration_minutes,topic_code)
 VALUES('39999999-0000-0000-0000-000000000000','member',current_date,5,3)$$,'23503');
SELECT set_config('prometheus.allow_redaction','true',true);
SELECT pg_temp.expect_redi_error('Custom setting cannot authorize direct redaction',
 $$UPDATE public.members SET anonymized_at=now() WHERE member_id='30000000-0000-0000-0000-000000000001'$$,'23514');
SELECT pg_temp.expect_redi_error('Privacy action requires explicit confirmation',
 $$CALL public.redact_person('members','30000000-0000-0000-0000-000000000001','no')$$,'23514');
SELECT pg_temp.expect_redi_error('Active person cannot be redacted accidentally',
 $$CALL public.redact_person('members','30000000-0000-0000-0000-000000000001','CONFIRM_PSEUDONYMIZATION')$$,'23514');
UPDATE public.members SET leave_date=current_date WHERE member_id='30000000-0000-0000-0000-000000000001';
INSERT INTO public.member_cash_transactions(member_transaction_id,member_id,transaction_date,transaction_type,amount,currency,recorded_by,note)
VALUES('50000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000001',current_date-5,
 'deposit',1,'EUR','20000000-0000-0000-0000-000000000001','TEST PRIVATE archived money');
DELETE FROM public.member_cash_transactions WHERE member_transaction_id='50000000-0000-0000-0000-000000000004';
SELECT pg_temp.check_redi('Member transaction deletion creates renamed archive',
 (SELECT count(*)=1 FROM public.member_cash_transactions_deleted WHERE member_transaction_id='50000000-0000-0000-0000-000000000004'));
CALL public.redact_person('members','30000000-0000-0000-0000-000000000001','CONFIRM_PSEUDONYMIZATION');
SELECT pg_temp.check_redi('Person fields cleared and name-derived code replaced',
 (SELECT first_name IS NULL AND last_name IS NULL AND date_of_birth IS NULL AND member_code~'^ANON_[0-9a-f]{32}$'
 AND anonymized_at IS NOT NULL FROM public.members WHERE member_id='30000000-0000-0000-0000-000000000001'));
SELECT pg_temp.check_redi('Departed member excluded by is_current flag',
 (SELECT NOT is_current FROM public.members_current WHERE member_id='30000000-0000-0000-0000-000000000001'));
SELECT pg_temp.check_redi('Live contacts removed; both new and old archives scrubbed',
 NOT EXISTS(SELECT 1 FROM public.emergency_contacts WHERE member_id='30000000-0000-0000-0000-000000000001')
 AND (SELECT count(*)=2 AND bool_and(name IS NULL AND phone IS NULL) FROM public.emergency_contacts_deleted
 WHERE member_id='30000000-0000-0000-0000-000000000001'));
SELECT pg_temp.check_redi('Call notes cleared in live and archived rows',
 NOT EXISTS(SELECT 1 FROM public.phone_calls WHERE person_id='30000000-0000-0000-0000-000000000001' AND note IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM public.phone_calls_deleted WHERE person_id='30000000-0000-0000-0000-000000000001' AND note IS NOT NULL));
SELECT pg_temp.check_redi('Financial amount and links preserved after privacy action',
 (SELECT computed_balance=115 FROM public.calculated_cash_balance('10000000-0000-0000-0000-000000000001',2::smallint,'EUR',current_date-5))
 AND NOT EXISTS(SELECT 1 FROM public.member_cash_transactions WHERE member_id='30000000-0000-0000-0000-000000000001' AND note IS NOT NULL));
SELECT pg_temp.expect_redi_error('Redacted person cannot regain a name',
 $$UPDATE public.members SET first_name='Private Again' WHERE member_id='30000000-0000-0000-0000-000000000001'$$,'23514');
SELECT pg_temp.expect_redi_error('New contact for redacted member rejected',
 $$INSERT INTO public.emergency_contacts(member_id,name,phone) VALUES('30000000-0000-0000-0000-000000000001','Private','123')$$,'23514');
SELECT pg_temp.expect_redi_error('New personal note for redacted member rejected',
 $$INSERT INTO public.phone_calls(person_id,person_type,call_date,duration_minutes,topic_code,note)
 VALUES('30000000-0000-0000-0000-000000000001','member',current_date,5,3,'Private Again')$$,'23514');
SELECT pg_temp.check_redi('Privacy capability is cleaned up',
 (SELECT count(*)=0 FROM prometheus_private.redaction_context));
SELECT pg_temp.check_redi('Archived member money keeps amount but loses note',
 (SELECT amount=1 AND note IS NULL FROM public.member_cash_transactions_deleted
 WHERE member_transaction_id='50000000-0000-0000-0000-000000000004'));
SELECT pg_temp.expect_redi_error('Redaction capability cannot edit monetary history later',
 $$UPDATE public.member_cash_transactions_deleted SET amount=999 WHERE member_transaction_id='50000000-0000-0000-0000-000000000004'$$,'23514');
CALL public.redact_person('members','30000000-0000-0000-0000-000000000001','CONFIRM_PSEUDONYMIZATION');
SELECT pg_temp.check_redi('Repeated redaction retains the opaque code and cleans context',
 (SELECT member_code~'^ANON_[0-9a-f]{32}$' FROM public.members WHERE member_id='30000000-0000-0000-0000-000000000001')
 AND (SELECT count(*)=0 FROM prometheus_private.redaction_context));
INSERT INTO public.members(member_id,clubhouse_id,first_name,last_name,date_of_birth,join_date) VALUES
 ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Test','Müller',DATE '1990-01-01',current_date);
SELECT pg_temp.check_redi('Redaction never releases name-code counter',
 (SELECT member_code='MUELLERT03' FROM public.members WHERE member_id='30000000-0000-0000-0000-000000000004'));
UPDATE public.members SET leave_date=current_date WHERE member_id='30000000-0000-0000-0000-000000000004';
DELETE FROM public.members WHERE member_id='30000000-0000-0000-0000-000000000004';
CALL public.redact_person('members','30000000-0000-0000-0000-000000000004','CONFIRM_PSEUDONYMIZATION');
SELECT pg_temp.check_redi('Already-deleted member archive can be privacy-scrubbed',
 (SELECT first_name IS NULL AND last_name IS NULL AND date_of_birth IS NULL AND anonymized_at IS NOT NULL
 FROM public.members_deleted WHERE member_id='30000000-0000-0000-0000-000000000004'));
SELECT pg_temp.expect_redi_error('Deleted person UUID remains reserved after redaction',
 $$INSERT INTO public.members(member_id,clubhouse_id,first_name,last_name,date_of_birth,join_date)
 VALUES('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Other','Person',DATE '1990-01-01',current_date)$$,'23505');
INSERT INTO public.clubhouse_cash_transactions(clubhouse_transaction_id,clubhouse_id,transaction_date,transaction_type,amount,currency,recorded_by,note)
VALUES('60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',current_date-5,
 'deposit',1,'EUR','20000000-0000-0000-0000-000000000001','TEST PRIVATE archived staff money');
DELETE FROM public.clubhouse_cash_transactions WHERE clubhouse_transaction_id='60000000-0000-0000-0000-000000000003';
UPDATE public.cashflow SET note='TEST PRIVATE archived snapshot' WHERE cashflow_id='70000000-0000-0000-0000-000000000003';
DELETE FROM public.cashflow WHERE cashflow_id='70000000-0000-0000-0000-000000000003';
SELECT pg_temp.check_redi('Both new financial tables archive deletions',
 (SELECT count(*)=1 FROM public.clubhouse_cash_transactions_deleted WHERE clubhouse_transaction_id='60000000-0000-0000-0000-000000000003')
 AND (SELECT count(*)=1 FROM public.cashflow_deleted WHERE cashflow_id='70000000-0000-0000-0000-000000000003'));
UPDATE public.staff SET end_date=current_date WHERE staff_id='20000000-0000-0000-0000-000000000001';
CALL public.redact_person('staff','20000000-0000-0000-0000-000000000001','CONFIRM_PSEUDONYMIZATION');
SELECT pg_temp.check_redi('Staff privacy fields cleared but actor UUID retained',
 (SELECT email IS NULL AND first_name IS NULL AND last_name IS NULL AND staff_status='inactive' AND anonymized_at IS NOT NULL
 FROM public.staff WHERE staff_id='20000000-0000-0000-0000-000000000001')
 AND (SELECT recorded_by='20000000-0000-0000-0000-000000000001' AND note IS NULL FROM public.clubhouse_cash_transactions
 WHERE clubhouse_transaction_id='60000000-0000-0000-0000-000000000001'));
SELECT pg_temp.check_redi('New financial archives participate in staff privacy cleanup',
 (SELECT amount=1 AND note IS NULL FROM public.clubhouse_cash_transactions_deleted
 WHERE clubhouse_transaction_id='60000000-0000-0000-0000-000000000003')
 AND (SELECT amount=10 AND note IS NULL FROM public.cashflow_deleted WHERE cashflow_id='70000000-0000-0000-0000-000000000003'));
INSERT INTO public.staff(staff_id,clubhouse_id,first_name,last_name,role,start_date,end_date) VALUES
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Test','Former','staff',current_date-10,current_date);
SELECT set_config('prometheus.deleted_by','20000000-0000-0000-0000-000000000002',true);
DELETE FROM public.emergency_contacts WHERE contact_id='89999999-0000-0000-0000-000000000000';
-- Create an actor-linked archive using a non-redacted member.
INSERT INTO public.emergency_contacts(contact_id,member_id,name,phone) VALUES
 ('80000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','Test','123');
DELETE FROM public.emergency_contacts WHERE contact_id='80000000-0000-0000-0000-000000000003';
DELETE FROM public.staff WHERE staff_id='20000000-0000-0000-0000-000000000002';
SELECT set_config('prometheus.deleted_by','',true);
SELECT pg_temp.check_redi('Deleting unused staff cleans archive actor FK',
 (SELECT deleted_by IS NULL FROM public.emergency_contacts_deleted WHERE contact_id='80000000-0000-0000-0000-000000000003'));
CALL public.redact_person('staff','20000000-0000-0000-0000-000000000002','CONFIRM_PSEUDONYMIZATION');
SELECT pg_temp.check_redi('Already-deleted staff archive can be privacy-scrubbed',
 (SELECT first_name IS NULL AND last_name IS NULL AND email IS NULL AND anonymized_at IS NOT NULL
 FROM public.staff_deleted WHERE staff_id='20000000-0000-0000-0000-000000000002'));
SELECT pg_temp.expect_redi_error('Archive deletion is not automatic',
 $$DELETE FROM public.phone_calls_deleted WHERE call_id='90000000-0000-0000-0000-000000000002'$$,'23514');
SELECT pg_temp.expect_redi_error('TRUNCATE cannot bypass audit',
 $$TRUNCATE public.cashflow$$,'23514');
SELECT pg_temp.expect_redi_error('Approval requires a reference and period',
 $$UPDATE public.retention_policy SET approved=true WHERE entity='members'$$,'23514');
UPDATE public.members SET leave_date=current_date WHERE member_id='30000000-0000-0000-0000-000000000002';
UPDATE public.retention_policy SET approved=true,retention_months=0,approval_reference='TEST_ONLY_NO_LEGAL_POLICY'
WHERE entity='members';
SELECT pg_temp.check_redi('Approved retention shows a candidate but performs no deletion',
 EXISTS(SELECT 1 FROM public.retention_candidates WHERE entity='members'
 AND person_id='30000000-0000-0000-0000-000000000002')
 AND (SELECT first_name IS NOT NULL AND anonymized_at IS NULL FROM public.members
 WHERE member_id='30000000-0000-0000-0000-000000000002'));

INSERT INTO public.members(member_id,clubhouse_id,first_name,last_name,date_of_birth,join_date,is_member,is_active)
VALUES('30000000-0000-0000-0000-000000000099','10000000-0000-0000-0000-000000000001',
       'Boolean','Observer',DATE '1990-01-01',current_date-5,true,false);
SELECT pg_temp.check_redi('New observation member is false with NULL activity despite supplied flags',
 (SELECT is_member IS FALSE AND is_active IS NULL FROM public.members
  WHERE member_id='30000000-0000-0000-0000-000000000099')
 AND (SELECT is_member IS FALSE AND is_active IS NULL FROM public.members_current
  WHERE member_id='30000000-0000-0000-0000-000000000099'));
DELETE FROM public.members WHERE member_id='30000000-0000-0000-0000-000000000099';
SELECT pg_temp.check_redi('Member deletion archives Boolean false and NULL without text conversion',
 (SELECT is_member IS FALSE AND is_active IS NULL FROM public.members_deleted
  WHERE member_id='30000000-0000-0000-0000-000000000099'));

SELECT count(*) AS passed_tests,'ALL TESTS PASSED; test data will now be rolled back' AS result FROM redi_test_results;
SELECT * FROM redi_test_results ORDER BY test_name;
ROLLBACK;
-- Test rows, private counters/contexts and event log entries are rolled back.

