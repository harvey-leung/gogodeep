-- Phase 0 / Item 4 — atomic rate limiting for chat-assistant and generate-quiz.
--
-- Both functions previously did read-then-write on profiles columns, so two
-- concurrent requests could both pass the check before either wrote. These
-- SECURITY DEFINER functions lock the profile row and check-and-update in one
-- transaction. The edge functions reserve the credit BEFORE the AI call (so the
-- limit holds under concurrency); the cost of that is a reserved credit is not
-- refunded if the downstream AI call fails.

-- ── Whale chat: per-minute throttle + daily credit budget ────────────────────
-- Returns one of: 'rate_limited' (too many msgs this minute),
-- 'daily_limit_reached' (out of daily credits), or 'ok' (reserved p_cost).
create or replace function public.consume_whale_chat(
  p_user_id      uuid,
  p_cost         integer,
  p_minute       bigint,
  p_today        text,
  p_minute_limit integer,
  p_credit_limit integer
)
returns table (status text, credits_used integer, minute_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_date    text;
  v_minute  bigint;
  v_mcount  integer;
begin
  select coalesce(pr.whale_chat_credits, 0), pr.whale_chat_date,
         coalesce(pr.whale_chat_minute, 0), coalesce(pr.whale_chat_minute_count, 0)
    into v_credits, v_date, v_minute, v_mcount
    from public.profiles pr
   where pr.id = p_user_id
   for update;

  if not found then
    return query select 'daily_limit_reached'::text, 0, 0;
    return;
  end if;

  -- Day / minute window resets.
  if v_date is distinct from p_today then v_credits := 0; end if;
  if v_minute is distinct from p_minute then v_mcount := 0; end if;

  -- Per-minute throttle.
  if v_mcount >= p_minute_limit then
    return query select 'rate_limited'::text, v_credits, v_mcount;
    return;
  end if;

  -- Daily credit budget.
  if v_credits >= p_credit_limit then
    return query select 'daily_limit_reached'::text, v_credits, v_mcount;
    return;
  end if;

  v_credits := v_credits + p_cost;
  v_mcount  := v_mcount + 1;

  update public.profiles
     set whale_chat_credits      = v_credits,
         whale_chat_date         = p_today,
         whale_chat_minute       = p_minute,
         whale_chat_minute_count = v_mcount
   where id = p_user_id;

  return query select 'ok'::text, v_credits, v_mcount;
end;
$$;

revoke all on function public.consume_whale_chat(uuid, integer, bigint, text, integer, integer) from public;
revoke all on function public.consume_whale_chat(uuid, integer, bigint, text, integer, integer) from anon, authenticated;

-- ── Quiz: one generation per day ─────────────────────────────────────────────
-- Atomically claims today's quiz slot. Returns true if claimed (allowed),
-- false if already used today (or the user row is missing).
create or replace function public.consume_quiz_credit(
  p_user_id uuid,
  p_today   text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean;
begin
  update public.profiles
     set last_quiz_date = p_today
   where id = p_user_id
     and last_quiz_date is distinct from p_today
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.consume_quiz_credit(uuid, text) from public;
revoke all on function public.consume_quiz_credit(uuid, text) from anon, authenticated;
