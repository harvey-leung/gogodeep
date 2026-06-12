import { supabase } from "@/integrations/supabase/client";

export interface DashboardProfile {
  daily_scan_count: number | null;
  scan_reset_date: string | null;
  plan: string | null;
  login_streak: number | null;
  last_login_date: string | null;
  bonus_scans: number | null;
}

export async function fetchDashboardProfile(userId: string): Promise<DashboardProfile | null> {
  const { data } = await (supabase as any)
    .from("profiles")
    .select("daily_scan_count, scan_reset_date, plan, login_streak, last_login_date, bonus_scans")
    .eq("id", userId)
    .single();
  return (data ?? null) as DashboardProfile | null;
}

export interface DailyResetResult {
  used: number;
  bonusScans: number;
  loginStreak: number;
  plan: string;
  /** >0 when a 7-day streak bonus was granted this load (caller toasts). */
  bonusAwarded: number;
}

/**
 * Runs the once-per-day scan-count reset + login-streak bookkeeping server-side
 * via the claim_daily_login() SECURITY DEFINER function (keyed on auth.uid()).
 *
 * Phase 0 migration 200004 revokes direct client UPDATEs to the rate-limit /
 * credit / streak columns, so all the mutation happens inside the function; the
 * client only reads back the resulting state.
 */
export async function applyDailyResetAndStreak(): Promise<DailyResetResult> {
  const { data } = await (supabase as any).rpc("claim_daily_login");
  const claim = (Array.isArray(data) ? data[0] : data) ?? {};
  return {
    used: claim.daily_scan_count ?? 0,
    bonusScans: claim.bonus_scans ?? 0,
    loginStreak: claim.login_streak ?? 0,
    plan: claim.plan ?? "free",
    bonusAwarded: claim.bonus_awarded ?? 0,
  };
}
