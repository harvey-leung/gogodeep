import { useState } from "react";
import { storageKeys } from "@/lib/storageKeys";

/** Editable daily scan goal, persisted per user in localStorage. */
export function useDailyGoal(userId: string) {
  const key = storageKeys.dailyGoal(userId);
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(key) ?? "5", 10) || 5; } catch { return 5; }
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");

  const beginEdit = () => { setGoalDraft(String(dailyGoal)); setEditingGoal(true); };
  const cancel = () => setEditingGoal(false);
  const commit = () => {
    const v = Math.max(1, Math.min(99, parseInt(goalDraft) || 5));
    setDailyGoal(v);
    try { localStorage.setItem(key, String(v)); } catch { /* ignore */ }
    setEditingGoal(false);
  };

  return { dailyGoal, editingGoal, goalDraft, setGoalDraft, beginEdit, cancel, commit };
}
