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
 * Applies the once-per-day scan-count reset and login-streak bookkeeping,
 * writing back to profiles. Ported verbatim from the old Index `load()` so
 * behaviour is identical.
 *
 * TODO(phase0): this client-side write to rate-limit/credit columns is replaced
 * by a SECURITY DEFINER claim_daily_login() on the phase-0-security branch. Kept
 * as-is here to avoid behaviour changes during the refactor.
 */
export async function applyDailyResetAndStreak(
  userId: string,
  profile: DashboardProfile | null,
): Promise<DailyResetResult> {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const plan = profile?.plan ?? "free";

  const isNewDay = (profile?.scan_reset_date ?? "") < today;
  if (isNewDay) {
    await (supabase as any).from("profiles").update({ daily_scan_count: 0, scan_reset_date: today }).eq("id", userId);
  }
  const used = isNewDay ? 0 : (profile?.daily_scan_count ?? 0);
  let bonusScans: number = profile?.bonus_scans ?? 0;

  const lastLogin: string = profile?.last_login_date ?? "";
  let loginStreak: number = profile?.login_streak ?? 0;
  let bonusAwarded = 0;
  if (lastLogin < today) {
    loginStreak = lastLogin === yesterday ? loginStreak + 1 : 1;
    const streakUpdates: Record<string, unknown> = { last_login_date: today, login_streak: loginStreak };
    if (plan !== "deep" && loginStreak % 7 === 0) {
      bonusAwarded = plan === "intermediate" ? 20 : 10;
      bonusScans += bonusAwarded;
      streakUpdates.bonus_scans = bonusScans;
    }
    await (supabase as any).from("profiles").update(streakUpdates).eq("id", userId);
  }

  return { used, bonusScans, loginStreak, plan, bonusAwarded };
}
