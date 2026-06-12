-- Phase 1 / Part B (item 7a) — server-side length caps on user-supplied text.
--
-- Defense-in-depth backstop to the client maxLength + the (separate) edge-function
-- zod caps: a malicious client can write directly to these tables via PostgREST,
-- so the database itself enforces the ceiling.
--
-- Constraints are added NOT VALID so the migration never fails on pre-existing
-- over-long rows; new and updated rows are enforced immediately. Run
-- `VALIDATE CONSTRAINT` later once any legacy rows are cleaned up if desired.
--
-- Chosen limits (mirror the client):
--   error_logs.topic             500  (concept/topic label)
--   error_logs.specific_error_tag 200 (short error label)
--   contact_messages.name        80
--   contact_messages.email       254  (RFC 5321 max)
--   contact_messages.message     2000
-- The display name is not stored on profiles (it's in auth.users metadata), and
-- stream/program names are client/localStorage only — so neither has a DB column
-- to constrain; both are capped on the client.

alter table public.error_logs
  add constraint error_logs_topic_len
  check (char_length(topic) <= 500) not valid;

alter table public.error_logs
  add constraint error_logs_specific_error_tag_len
  check (char_length(specific_error_tag) <= 200) not valid;

alter table public.contact_messages
  add constraint contact_messages_name_len
  check (char_length(name) <= 80) not valid;

alter table public.contact_messages
  add constraint contact_messages_email_len
  check (char_length(email) <= 254) not valid;

alter table public.contact_messages
  add constraint contact_messages_message_len
  check (char_length(message) <= 2000) not valid;
