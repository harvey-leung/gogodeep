import { useState } from "react";
import { addBonusXP } from "@/lib/xp";
import { storageKeys } from "@/lib/storageKeys";

type DailyClaim = { date: string; amount: number; claimed: boolean };

/**
 * Daily XP claim (random 40–80 XP, resets each day). `onXp` lets the caller
 * apply the optimistic XP bump to dashboard data when claimed.
 */
export function useDailyClaim(userId: string, onXp: (amount: number) => void) {
  const key = storageKeys.dailyClaim(userId);
  const [dailyClaim, setDailyClaim] = useState<DailyClaim>(() => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const stored = JSON.parse(localStorage.getItem(key) ?? "null");
      if (stored?.date === today) return stored;
    } catch { /* ignore */ }
    const today = new Date().toISOString().split("T")[0];
    const amount = 40 + Math.floor(Math.random() * 41);
    const claim = { date: today, amount, claimed: false };
    try { localStorage.setItem(key, JSON.stringify(claim)); } catch { /* ignore */ }
    return claim;
  });

  const claim = () => {
    if (dailyClaim.claimed) return;
    addBonusXP(userId, dailyClaim.amount, "challenge");
    const updated = { ...dailyClaim, claimed: true };
    setDailyClaim(updated);
    try { localStorage.setItem(key, JSON.stringify(updated)); } catch { /* ignore */ }
    onXp(dailyClaim.amount);
    window.dispatchEvent(new CustomEvent("whale-notify", {
      detail: { message: `+${dailyClaim.amount} XP claimed!`, type: "success" },
    }));
  };

  return { dailyClaim, claim };
}
