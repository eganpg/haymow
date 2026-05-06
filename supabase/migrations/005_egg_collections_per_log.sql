-- Drop the unique (flock_id, collection_date) constraint added in 004.
-- Each call to logEggCollection now inserts a new row representing a single
-- collection event ("at 7am I collected 5"; "at 11am I collected 4 more").
-- Today's total is computed by summing all rows for the day in
-- getTodaysEggSummary(). This matches how Pete actually collects eggs —
-- multiple trips to the coop on a single day add up rather than overwrite.
--
-- The Today screen now reads via .select() (no .maybeSingle()), so multiple
-- rows per day no longer break the load (which was the original reason for
-- the constraint).

alter table egg_collections
  drop constraint if exists egg_collections_flock_date_unique;
