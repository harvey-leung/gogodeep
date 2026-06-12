// Central registry of localStorage / sessionStorage keys.
//
// Keys were previously defined per-file as template strings; collecting them
// here keeps naming consistent and makes it obvious what we persist. Only the
// keys touched by the pages refactored so far live here — others will move as
// their files are refactored.

export const storageKeys = {
  // ── per-user (localStorage) ──
  dailyClaim: (uid: string) => `gogodeep_claim_${uid}`,
  quizSave: (uid: string) => `gogodeep_qs_${uid}`,
  quizHistory: (uid: string) => `gogodeep_qh_${uid}`,
  recapQuizQuestions: (uid: string) => `gogodeep_rq_q_${uid}`,
  recapQuizDate: (uid: string) => `gogodeep_rq_d_${uid}`,
  recapQuizDone: (uid: string) => `gogodeep_rq_done_${uid}`,
  dailyGoal: (uid: string) => `gogodeep_daily_goal_${uid}`,

  // ── static (localStorage) ──
  quizDay: "gogodeep_quiz_day",
  quizCount: "gogodeep_quiz_count",
  sidebarCollapsed: "main_sidebar_collapsed",
} as const;

export const sessionKeys = {
  challenge: "gogodeep_challenge",
  challengeBonus: "gogodeep_challenge_bonus",
  challengeXp: "gogodeep_challenge_xp",
} as const;

// Re-exported for a single import site; the canonical definition still lives in
// lib/supabase.ts (also used by pages not yet refactored).
export { SCAN_CACHE_KEY } from "@/lib/supabase";
