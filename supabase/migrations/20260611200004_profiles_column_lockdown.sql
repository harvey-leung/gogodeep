-- Phase 0 / Item 5 — lock down direct client writes to sensitive profiles columns.
--
-- Previously authenticated users could UPDATE their own profiles row from the
-- client, which means they could reset their own rate-limit counters
-- (daily_scan_count, scan_reset_date, whale_chat_*, last_quiz_date), grant
-- themselves bonus_scans / login_streak, or even change their plan. We now revoke
-- broad UPDATE and re-grant UPDATE only on the benign, user-owned columns the
-- client legitimately edits. Everything sensitive is written exclusively by
-- SECURITY DEFINER functions (consume_scan_credit, consume_whale_chat,
-- consume_quiz_credit — called by edge functions with the service role — and
-- claim_daily_login below, called by the client but keyed on auth.uid()).
--
-- IMPORTANT REVIEW NOTES:
--   * This assumes the default Supabase grant model where `authenticated` holds
--     table-level UPDATE on public.profiles and RLS restricts the row.
--   * lab_state is the ONLY column the client may write directly (history/report
--     UI state). The display name is NOT stored on profiles — it lives in
--     auth.users user_metadata and is updated via supabase.auth.updateUser().
--   * Row-level SELECT/UPDATE RLS policies are intentionally left unchanged.

revoke update on table public.profiles from anon, authenticated;

-- Re-grant UPDATE only on the single client-writable column.
grant update (lab_state) on table public.profiles to authenticated;

-- Daily login bookkeeping (scan-count reset + login streak + 7-day bonus credits),
-- moved server-side out of Index.tsx. Keyed on auth.uid() so a caller can only
-- ever affect their own row, even though it runs as definer.
create or replace function public.claim_daily_login()
returns table (
  plan             text,
  daily_scan_count integer,
  scan_reset_date  date,
  login_streak     integer,
  bonus_scans      integer,
  bonus_awarded    integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_plan      text;
  v_count     integer;
  v_reset     date;
  v_streak    integer;
  v_last      date;
  v_bonus     integer;
  v_today     date := (now() at time zone 'utc')::date;
  v_yesterday date := (now() at time zone 'utc')::date - 1;
  v_awarded   integer := 0;
begin
  if v_user is null then
    return; -- no authenticated caller
  end if;

  select pr.plan, coalesce(pr.daily_scan_count, 0), pr.scan_reset_date,
         coalesce(pr.login_streak, 0), pr.last_login_date, coalesce(pr.bonus_scans, 0)
    into v_plan, v_count, v_reset, v_streak, v_last, v_bonus
    from public.profiles pr
   where pr.id = v_user
   for update;

  if not found then
    return query select 'free'::text, 0, v_today, 0, 0, 0;
    return;
  end if;

  v_plan := coalesce(v_plan, 'free');

  -- Daily scan-count reset.
  if v_reset is null or v_reset < v_today then
    v_count := 0;
    v_reset := v_today;
  end if;

  -- Login streak (advance once per day).
  if v_last is null or v_last < v_today then
    if v_last = v_yesterday then
      v_streak := v_streak + 1;
    else
      v_streak := 1;
    end if;
    v_last := v_today;
    if v_plan <> 'deep' and v_streak % 7 = 0 then
      v_awarded := case v_plan when 'intermediate' then 20 else 10 end;
      v_bonus := v_bonus + v_awarded;
    end if;
  end if;

  update public.profiles
     set daily_scan_count = v_count,
         scan_reset_date  = v_reset,
         login_streak     = v_streak,
         last_login_date  = v_last,
         bonus_scans      = v_bonus
   where id = v_user;

  return query select v_plan, v_count, v_reset, v_streak, v_bonus, v_awarded;
end;
$$;

revoke all on function public.claim_daily_login() from public, anon;
grant execute on function public.claim_daily_login() to authenticated;
