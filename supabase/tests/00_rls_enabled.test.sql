-- Every table in exposed schemas must have RLS enabled (SECURITY.md §4).
begin;
select plan(1);

select is(
  (select array_agg(format('%I.%I', n.nspname, c.relname) order by 1)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname in ('public', 'private') and not c.relrowsecurity),
  null,
  'all tables in public/private have row level security enabled'
);

select * from finish();
rollback;
