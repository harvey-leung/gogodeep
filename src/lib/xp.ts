export function calcScanXP(label: string | null, errorCategory: string | null): number {
  const t = (label ?? "").toLowerCase();
  const isVeryHard = /differential equation|fourier|laplace|eigenvalue|tensor|manifold|topology|complex analysis/.test(t);
  const isHard = /integral|integrat|calculus|derivative|matrix|vector|circuit|electromagnetic|induction/.test(t);
  const isMedium = /quadratic|trig|sine|cosine|tangent|logarithm|probability|statistics|binomial|kinematics|momentum|equilibrium|stoichiometry|titration/.test(t);
  const isConceptual = errorCategory?.toLowerCase() === "conceptual";
  let xp = isVeryHard ? 160 : isHard ? 130 : isMedium ? 100 : 80;
  if (isConceptual) xp += 15;
  return xp;
}

function scanDifficultyLevel(label: string | null): number {
  const t = (label ?? "").toLowerCase();
  if (/differential equation|fourier|laplace|eigenvalue|tensor|manifold|topology|complex analysis/.test(t)) return 3;
  if (/integral|integrat|calculus|derivative|matrix|vector|circuit|electromagnetic|induction/.test(t)) return 2;
  if (/quadratic|trig|sine|cosine|tangent|logarithm|probability|statistics|binomial|kinematics|momentum|equilibrium|stoichiometry|titration/.test(t)) return 1;
  return 0;
}

/** Adjusts scan XP relative to the user's personal difficulty baseline. */
export function calcRelativeScanXP(
  label: string | null,
  errorCategory: string | null,
  allLabels: (string | null)[],
): number {
  const base = calcScanXP(label, errorCategory);
  if (allLabels.length < 3) return base;
  const level = scanDifficultyLevel(label);
  const meanLevel = allLabels.reduce((s, l) => s + scanDifficultyLevel(l), 0) / allLabels.length;
  const bonus = Math.round((level - meanLevel) * 20);
  return Math.max(60, Math.min(200, base + bonus));
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
