import { supabase } from "@/integrations/supabase/client";
import { FREE_FOR_ALL } from "@/lib/featureFlags";

export const SCAN_CACHE_KEY = (id: string) => `gogodeep_scan_${id}`;

export const SCAN_LIMITS: Record<string, number | null> = {
  free: 5,
  intermediate: 10,
  deep: null,
};

export type ScanCreditState = {
  allowed: boolean;
  credits: number | null;
  plan: string;
};


export async function checkScanCredits(): Promise<ScanCreditState> {
  if (FREE_FOR_ALL) return { allowed: true, credits: null, plan: "deep" };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { allowed: true, credits: null, plan: "free" };
  }

  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("daily_scan_count, scan_reset_date, plan, bonus_scans")
    .eq("id", user.id)
    .single();

  if (error) {
    return { allowed: true, credits: null, plan: "free" };
  }

  const plan = (data as any)?.plan ?? "free";
  const limit = plan in SCAN_LIMITS ? SCAN_LIMITS[plan] : SCAN_LIMITS.free;

  if (limit === null) return { allowed: true, credits: null, plan };

  const today = new Date().toISOString().split("T")[0];
  const resetDate = (data as any)?.scan_reset_date ?? "";
  const isNewDay = resetDate < today;

  // Advisory/UX check only — the server (consume_scan_credit) performs the
  // authoritative daily reset and decrement. These columns are no longer
  // client-writable, so we never write here.
  const used = isNewDay ? 0 : ((data as any)?.daily_scan_count ?? 0);
  const bonusScans = (data as any)?.bonus_scans ?? 0;
  const remaining = Math.max(0, limit - used) + bonusScans;
  return { allowed: remaining > 0, credits: remaining, plan };
}
