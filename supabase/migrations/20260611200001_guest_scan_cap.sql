-- Phase 0 / Item 1 — server-side guest abuse cap for diagnose-image.
--
-- Guests (no JWT) are allowed a small number of free scans per day, enforced
-- server-side per IP (hashed) instead of via the trivially-bypassed localStorage
-- flag the client used before. The edge function calls consume_guest_scan() with
-- the service-role key; the table is RLS-locked so only the service role (which
-- bypasses RLS) can read or write it.

create table if not exists public.guest_scan_usage (
  ip_hash    text        not null,
  day        date        not null,
  count      integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (ip_hash, day)
);

alter table public.guest_scan_usage enable row level security;
-- Intentionally no policies: anon/authenticated have no access; only the
-- service role (used by the edge function) can touch this table.

-- Atomically claim one guest scan for (ip_hash, day) up to p_limit.
-- Returns allowed=true and the new count when under the limit, otherwise
-- allowed=false and the current count. The whole check-and-increment happens
-- in a single statement so concurrent requests cannot both slip past the cap.
create or replace function public.consume_guest_scan(
  p_ip_hash text,
  p_day     date,
  p_limit   integer
)
returns table (allowed boolean, used integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.guest_scan_usage as g (ip_hash, day, count)
  values (p_ip_hash, p_day, 1)
  on conflict (ip_hash, day)
    do update set count = g.count + 1, updated_at = now()
    where g.count < p_limit
  returning g.count into v_count;

  if v_count is null then
    -- Conflict existed but the WHERE excluded the update => limit already hit.
    select g.count into v_count
      from public.guest_scan_usage g
     where g.ip_hash = p_ip_hash and g.day = p_day;
    return query select false, coalesce(v_count, p_limit);
  else
    return query select true, v_count;
  end if;
end;
$$;

-- Only the service role may execute this; never expose it to clients.
revoke all on function public.consume_guest_scan(text, date, integer) from public;
revoke all on function public.consume_guest_scan(text, date, integer) from anon, authenticated;
