-- One egg-collection row per (flock, day). Any duplicates were getting created by
-- repeated taps on "Log egg collection" before the app switched to upsert, and they
-- broke the Today screen because getTodaysCollection() uses .maybeSingle() which
-- throws PGRST116 ("multiple rows returned") when more than one row matches.
--
-- Step 1 dedupes any existing duplicates: for each (flock_id, collection_date) group,
-- keep only the most recent row (highest created_at). The user can re-enter today's
-- count if the surviving row is wrong.
--
-- Step 2 adds the unique constraint so the DB enforces this from now on, and so that
-- the upsert in logEggCollection has something to conflict on.

with ranked as (
  select
    id,
    row_number() over (
      partition by flock_id, collection_date
      order by created_at desc
    ) as rn
  from egg_collections
)
delete from egg_collections
where id in (select id from ranked where rn > 1);

alter table egg_collections
  add constraint egg_collections_flock_date_unique
  unique (flock_id, collection_date);
