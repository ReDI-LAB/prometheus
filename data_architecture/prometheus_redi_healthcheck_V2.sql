-- VERSION 2 read-only check. Execute ENTIRE file in prometheus_redi with stop-on-error.
BEGIN READ ONLY;
DO $guard$ BEGIN
 IF current_database()<>'prometheus_redi' THEN
  RAISE EXCEPTION 'Wrong database: %. Select prometheus_redi first.',current_database(); END IF;
 IF to_regclass('public.finance_reconciliation') IS NULL THEN
  RAISE EXCEPTION 'Redi schema has not been installed in this database.'; END IF;
END $guard$;
SELECT current_database() AS database_name,version() AS postgresql_version;
SELECT table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND (table_name,column_name) IN
 (('clubhouses','is_active'),('members','is_member'),('members','is_active'),
  ('members_deleted','is_member'),('members_deleted','is_active'),
  ('member_cash_transactions','clubhouse_id'),('member_cash_transactions_deleted','clubhouse_id'),
  ('cash_opening_balances','clubhouse_id'))
ORDER BY table_name,column_name;
SELECT 'logical_public_tables' AS check_name,
 count(*) AS actual,35 AS expected,
 CASE WHEN count(*)=35 THEN 'PASS' ELSE 'REVIEW' END AS result
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relispartition;
SELECT 'monthly_partitioned_parents' AS check_name,
 count(*) AS actual,5 AS expected,
 CASE WHEN count(*)=5 THEN 'PASS' ELSE 'REVIEW' END AS result
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='p';
SELECT parent.relname AS parent_table,count(*) AS monthly_partitions,
 min(pg_get_expr(child.relpartbound,child.oid)) AS first_bound,
 max(pg_get_expr(child.relpartbound,child.oid)) AS last_bound
FROM pg_inherits i JOIN pg_class parent ON parent.oid=i.inhparent
JOIN pg_class child ON child.oid=i.inhrelid
JOIN pg_namespace n ON n.oid=parent.relnamespace
WHERE n.nspname='public' AND parent.relkind='p'
GROUP BY parent.relname ORDER BY parent.relname;
SELECT code,label,sort_order FROM public.currencies ORDER BY sort_order;
SELECT 'account_removed' AS check_name,
 CASE WHEN to_regclass('public.accounts') IS NULL
 AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                AND table_name IN ('clubhouse_cash_transactions','clubhouse_cash_transactions_deleted')
                AND column_name='account') THEN 'PASS' ELSE 'REVIEW' END AS result;
SELECT code,label FROM public.cash_transaction_types ORDER BY sort_order;
SELECT * FROM public.retention_policy ORDER BY entity;
SELECT reconciliation_status,count(*) AS rows FROM public.finance_reconciliation
GROUP BY reconciliation_status ORDER BY reconciliation_status;
SELECT * FROM public.finance_reconciliation_issues ORDER BY balance_date DESC LIMIT 50;
COMMIT;
