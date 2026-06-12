import { useQuery } from "@tanstack/react-query";
import { SCAN_LIMITS } from "@/lib/supabase";
import { whaleToast } from "@/lib/whaleToast";
import { calcRelativeScanXP, getBonusXPEntries } from "@/lib/xp";
import type { DashboardData } from "@/types/dashboard";
import type { ErrorLog } from "@/types/domain";
import { queryKeys } from "./queryKeys";
import { fetchErrorLogs } from "./scans";
import { applyDailyResetAndStreak } from "./profile";

/**
 * Loads and derives everything the dashboard renders. Ported verbatim from the
 * old Index `load()` (same fetches, same side-effecting streak write + toast,
 * same derivations) so behaviour is identical — just relocated into the data
 * layer and run through React Query.
 */
export async function loadDashboardData(userId: string): Promise<DashboardData> {
  const [logs, daily] = await Promise.all([
    fetchErrorLogs(userId),
    applyDailyResetAndStreak(),
  ]);

  const { used, bonusScans, loginStreak, plan, bonusAwarded } = daily;
  if (bonusAwarded > 0) {
    whaleToast.success(`7-day streak! You've earned ${bonusAwarded} bonus credits.`);
  }

  const limit = plan in SCAN_LIMITS ? SCAN_LIMITS[plan] : SCAN_LIMITS.free;
  const creditsLeft = limit === null ? null : Math.max(0, (limit as number) - used) + bonusScans;

  const conceptualCount = logs.filter((l) => l.error_category?.toLowerCase() === "conceptual").length;
  const conceptsLearned = new Set(logs.map((l) => l.topic).filter(Boolean)).size;

  const tagCounts: Record<string, number> = {};
  for (const l of logs) {
    const tag = l.specific_error_tag ?? l.topic;
    if (tag) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  const recentTopics = logs.map((l) => l.topic).filter(Boolean).slice(0, 3) as string[];

  const recentScans = logs.map((l) => ({
    id: l.id,
    label: l.specific_error_tag ?? l.topic ?? "Unnamed scan",
    created_at: l.created_at,
    error_category: l.error_category,
  }));

  const allLabels = logs.map((l) => l.specific_error_tag ?? l.topic ?? null);
  const dayXP: Record<string, number> = {};
  for (let i = 0; i < logs.length; i++) {
    const l = logs[i];
    if (l.created_at) {
      const d = l.created_at.split("T")[0];
      dayXP[d] = (dayXP[d] ?? 0) + calcRelativeScanXP(l.specific_error_tag ?? l.topic, l.error_category, allLabels, l.id);
    }
  }
  const bonusEntries = getBonusXPEntries(userId);
  for (const e of bonusEntries) {
    dayXP[e.date] = (dayXP[e.date] ?? 0) + e.xp;
  }
  const todayStr = new Date().toISOString().split("T")[0];
  const todayXP = dayXP[todayStr] ?? 0;
  const totalXP = logs.reduce((sum, l) => sum + calcRelativeScanXP(l.specific_error_tag ?? l.topic, l.error_category, allLabels, l.id), 0)
    + bonusEntries.reduce((sum, e) => sum + e.xp, 0);
  const bestDayXP = Object.values(dayXP).length ? Math.max(...Object.values(dayXP)) : 0;

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyScans = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const dateStr = d.toISOString().split("T")[0];
    return { day: DAY_LABELS[d.getDay()], count: logs.filter((l: ErrorLog) => l.created_at?.startsWith(dateStr)).length };
  });

  return {
    totalScans: logs.length,
    creditsLeft,
    usedToday: used,
    dailyLimit: limit as number | null,
    plan,
    conceptualCount,
    conceptsLearned,
    topTags,
    recentTopics,
    recentScans,
    loginStreak,
    bonusScans,
    weeklyScans,
    totalXP,
    bestDayXP,
    todayXP,
  };
}

/**
 * Run-once dashboard query. Configured to behave like the old mount-time
 * useEffect (no refetch on focus, no retry) so the side-effecting load runs a
 * single time per mount.
 */
export function useDashboardData(userId: string) {
  return useQuery({
    queryKey: queryKeys.dashboard(userId),
    queryFn: () => loadDashboardData(userId),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}
