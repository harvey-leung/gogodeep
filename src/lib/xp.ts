export function calcScanXP(label: string | null, errorCategory: string | null): number {
  const t = (label ?? "").toLowerCase();
  const isVeryHard = /differential equation|fourier|laplace|eigenvalue|tensor|manifold|topology|complex analysis/.test(t);
  const isHard = /integral|integrat|calculus|derivative|matrix|vector|circuit|electromagnetic|induction/.test(t);
  const isMedium = /quadratic|trig|logarithm|probability|statistics|binomial|kinematics|momentum|equilibrium|stoichiometry|titration/.test(t);
  const isConceptual = errorCategory?.toLowerCase() === "conceptual";
  let xp = isVeryHard ? 160 : isHard ? 130 : isMedium ? 100 : 80;
  if (isConceptual) xp += 15;
  return xp;
}

export const QUIZ_XP = 50;
export const CHALLENGE_BONUS_XP = 30;

export type BonusXPEntry = { date: string; xp: number; source: "quiz" | "challenge" };

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
