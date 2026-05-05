-- Link feed_entries to the milking_session they were logged alongside.
-- Nullable: existing rows + non-dairy feed logs (flock/batch) stay null.
-- ON DELETE SET NULL — we handle inventory restoration explicitly in app code
-- (deleteMilkingSession) before deleting the session, so cascade-delete is
-- not what we want. SET NULL is the safe default if a session is deleted
-- through some other path.

alter table feed_entries
  add column milking_session_id uuid references milking_sessions(id) on delete set null;

create index feed_entries_milking_session_id_idx
  on feed_entries (milking_session_id);
