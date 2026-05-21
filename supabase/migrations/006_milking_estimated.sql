-- Mark a milking session as estimated when the user is backfilling a session
-- they forgot to log in the moment (e.g. logged the next morning from memory).
-- Defaults to false so every historical row reads as real-measured data.
--
-- Separate from health_tags because "estimated" is a property of the record
-- itself (data quality), not an event observed during milking. Keeping it as
-- its own boolean column makes it cheap to:
--   - filter out of feed→yield correlation (don't fit a curve to guesses)
--   - render with a visual marker on Trends (e.g. striped bar, "est." badge)
--   - query without doing array-membership checks against a text[]

alter table milking_sessions
  add column is_estimated boolean not null default false;
