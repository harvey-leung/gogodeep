// Aggregate shape the dashboard renders from.

export type DashboardData = {
  totalScans: number;
  creditsLeft: number | null;
  usedToday: number;
  dailyLimit: number | null;
  plan: string;
  conceptualCount: number;
  conceptsLearned: number;
  topTags: { tag: string; count: number }[];
  recentTopics: string[];
  recentScans: { id: string; label: string; created_at: string | null; error_category: string | null }[];
  loginStreak: number;
  bonusScans: number;
  weeklyScans: { day: string; count: number }[];
  totalXP: number;
  bestDayXP: number;
  todayXP: number;
};
