-- Phase 0 / Item 2 — server-side, atomic scan-credit enforcement.
--
-- The client checkScanCredits() in DiagnosticLab is advisory only. This function
-- is the authoritative check: diagnose-image calls it (with the service-role key)
-- before invoking the AI model. It checks the daily limit + bonus credits and
-- decrements in a SINGLE locked transaction, so two concurrent scans can't both
-- pass a stale read. It also folds in the day-reset and the increment that the
-- client previously did via increment_scan_count (now removed client-side to
-- avoid double counting).
--
-- Plan limits mirror SCAN_LIMITS in src/lib/supabase.ts:
--   free: 5/day, intermediate: 10/day, deep: unlimited.

create or replace function public.consume_scan_credit(p_user_id uuid)
returns table (allowed boolean, remaining integer, plan text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan      text;
  v_count     integer;
  v_reset     date;
  v_bonus     integer;
  v_limit     integer;
  v_used      integer;
  v_remaining integer;
  v_today     date := (now() at time zone 'utc')::date;
begin
  -- Lock the profile row so concurrent scans serialize on it.
  select pr.plan, coalesce(pr.daily_scan_count, 0), pr.scan_reset_date, coalesce(pr.bonus_scans, 0)
    into v_plan, v_count, v_reset, v_bonus
    from public.profiles pr
   where pr.id = p_user_id
   for update;

  if not found then
    return query select false, 0, 'free'::text;
    return;
  end if;

  v_plan := coalesce(v_plan, 'free');

  -- Unlimited plan: allow, nothing to decrement. remaining = NULL means unlimited.
  if v_plan = 'deep' then
    return query select true, null::integer, v_plan;
    return;
  end if;

  v_limit := case v_plan when 'intermediate' then 10 else 5 end;

  -- Daily reset.
  if v_reset is null or v_reset < v_today then
    v_count := 0;
    v_reset := v_today;
  end if;

  v_used      := v_count;
  v_remaining := greatest(0, v_limit - v_used) + v_bonus;

  if v_remaining <= 0 then
    -- Persist any reset even when rejecting.
    update public.profiles
       set daily_scan_count = v_count, scan_reset_date = v_reset
     where id = p_user_id;
    return query select false, 0, v_plan;
    return;
  end if;

  -- Consume a daily slot first, then fall back to bonus credits.
  if v_used < v_limit then
    v_count := v_count + 1;
  else
    v_bonus := v_bonus - 1;
  end if;

  update public.profiles
     set daily_scan_count = v_count,
         scan_reset_date  = v_reset,
         bonus_scans      = v_bonus
   where id = p_user_id;

  return query select true, (greatest(0, v_limit - v_count) + v_bonus), v_plan;
end;
$$;

revoke all on function public.consume_scan_credit(uuid) from public;
revoke all on function public.consume_scan_credit(uuid) from anon, authenticated;
