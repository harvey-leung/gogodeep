/** Backwards-compat wrappers used by dashboard XP history calculations. */
export function calcScanXP(topic: string | null, errorCategory: string | null): number {
  const score = scoreDifficulty(topic, errorCategory);
  return Math.max(50, Math.min(190, Math.round(65 + score * 9)));
}

export function calcRelativeScanXP(
  topic: string | null,
  errorCategory: string | null,
  allLabels: (string | null)[],
): number {
  return calcDynamicScanXP(topic, errorCategory, allLabels.map(l => ({ topic: l, error_category: null })));
}

export const QUIZ_XP = 50;
export const CHALLENGE_BONUS_XP = 30;
export const PRACTICE_CORRECT_XP = 15;

export type BonusXPEntry = { date: string; xp: number; source: "quiz" | "challenge" | "practice" };

function bonusKey(userId: string) { return `gogodeep_bxp_${userId}`; }

export function addBonusXP(userId: string, xp: number, source: BonusXPEntry["source"]): void {
  try {
    const entries: BonusXPEntry[] = JSON.parse(localStorage.getItem(bonusKey(userId)) ?? "[]");
    entries.push({ date: new Date().toISOString().split("T")[0], xp, source });
    localStorage.setItem(bonusKey(userId), JSON.stringify(entries.slice(-500)));
  } catch {}
}

export function getBonusXPEntries(userId: string): BonusXPEntry[] {
  try { return JSON.parse(localStorage.getItem(bonusKey(userId)) ?? "[]"); } catch { return []; }
}

/**
 * Scores a scan's inherent difficulty on a continuous 0–10 scale.
 * Uses keyword signals + error category, with ±1.5 noise so identical
 * topics don't always produce the same number.
 */
export function scoreDifficulty(topic: string | null, errorCategory: string | null): number {
  const t = (topic ?? "").toLowerCase();

  let base =
    /differential equation|fourier|laplace|eigenvalue|tensor|manifold|complex analysis|multivariable|group theory|number theory/.test(t) ? 8.5 :
    /integral|integrat|calculus|derivative|vector calculus|matrix|electromagnetic|quantum|induction|wave equation/.test(t) ? 6.5 :
    /quadratic|trig|sine|cosine|logarithm|probability|statistics|binomial|kinematics|momentum|thermodynamics|stoichiometry|titration|equilibrium/.test(t) ? 4.5 :
    /linear equation|arithmetic|fraction|percentage|ratio|proportion|basic algebra/.test(t) ? 2.0 :
    3.5; // unknown topic — lean slightly below average

  if (errorCategory?.toLowerCase() === "conceptual") base = Math.min(10, base + 0.8);

  return Math.max(0, Math.min(10, base));
}

/**
 * Calculates XP for a scan relative to the user's personal difficulty baseline.
 * history: array of { topic, error_category } from the user's last ~20 scans (excluding current).
 */
export function calcDynamicScanXP(
  topic: string | null,
  errorCategory: string | null,
  history: { topic: string | null; error_category: string | null }[],
): number {
  // add per-scan noise here, not in scoreDifficulty, so display calls stay stable
  const thisScore = Math.max(0, Math.min(10, scoreDifficulty(topic, errorCategory) + (Math.random() - 0.5) * 3));

  // personal baseline: mean difficulty of recent scans
  const baseline = history.length >= 3
    ? history.map(r => scoreDifficulty(r.topic, r.error_category)).reduce((a, b) => a + b, 0) / history.length
    : 4.0; // new user default

  // base XP scales linearly with raw difficulty: score 0 → 65 XP, score 10 → 155 XP
  const base = 65 + thisScore * 9;

  // relative bonus: doing something harder than usual gives up to +35; easier gives up to -25
  const delta = thisScore - baseline;
  const relBonus = delta > 0
    ? Math.round(delta * 14)   // reward harder work more generously
    : Math.round(delta * 10);  // small penalty for well-trodden ground

  return Math.max(50, Math.min(190, Math.round(base + relBonus)));
}
