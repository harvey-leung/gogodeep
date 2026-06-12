import type { DashboardData } from "@/types/dashboard";
import { AchievementBadge } from "./LevelBadge";

export function StatsGrid({
  loading,
  data,
  dailyGoal,
  editingGoal,
  goalDraft,
  setGoalDraft,
  beginEdit,
  cancel,
  commit,
  onNavigate,
}: {
  loading: boolean;
  data: DashboardData | null;
  dailyGoal: number;
  editingGoal: boolean;
  goalDraft: string;
  setGoalDraft: (v: string) => void;
  beginEdit: () => void;
  cancel: () => void;
  commit: () => void;
  onNavigate: (to: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">

      {/* Problems Crushed — blue */}
      <div className="relative overflow-hidden rounded-2xl border-l-4 border-primary bg-primary/10 p-5">
        <div className="pointer-events-none absolute -right-5 -bottom-5 opacity-[0.07]">
          <svg viewBox="0 0 80 80" className="h-28 w-28 text-primary" fill="none" stroke="currentColor" strokeWidth="4">
            <circle cx="40" cy="40" r="12"/><circle cx="40" cy="40" r="26" strokeDasharray="8 4"/>
            <line x1="40" y1="4" x2="40" y2="22"/><line x1="40" y1="58" x2="40" y2="76"/>
            <line x1="4" y1="40" x2="22" y2="40"/><line x1="58" y1="40" x2="76" y2="40"/>
          </svg>
        </div>
        <div className="flex items-start justify-between gap-1">
          <span className="text-xs font-black uppercase tracking-[0.15em] text-primary/80">Problems Crushed</span>
          <AchievementBadge xp={data?.totalXP ?? 0} />
        </div>
        <p className="mt-1 text-[3.5rem] font-black leading-none tracking-tighter text-primary">
          {loading ? "—" : data?.totalScans ?? 0}
        </p>
        <p className="text-[11px] font-semibold text-primary/70">all-time</p>
        {!loading && data?.plan !== "deep" && data?.dailyLimit !== null && (
          <div className="group/bar relative mt-3">
            <div className="flex gap-1">
              {Array.from({ length: Math.min(data.dailyLimit as number, 10) }).map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i < data.usedToday ? "bg-primary" : "bg-primary/15"}`} />
              ))}
            </div>
            <p className="pointer-events-none absolute -top-6 left-0 whitespace-nowrap rounded-md border border-border bg-card px-2 py-0.5 text-[10px] text-foreground shadow-md opacity-0 transition-opacity group-hover/bar:opacity-100 z-10">
              {data.usedToday} / {data.dailyLimit} used today
            </p>
          </div>
        )}
        {data?.plan !== "deep" && (
          <div className="mt-3">
            <button onClick={() => onNavigate("/pricing")} className="text-[9px] font-black uppercase tracking-wider text-primary/60 underline underline-offset-2 hover:text-primary">Unlock unlimited →</button>
          </div>
        )}
      </div>

      {/* Current Streak — amber */}
      <div className="relative overflow-hidden rounded-2xl border-l-4 border-amber-500 bg-amber-500/10 p-5">
        <div className="pointer-events-none absolute -right-3 -bottom-4 opacity-[0.10]">
          <svg viewBox="0 0 60 80" className="h-24 w-20 text-amber-500" fill="currentColor">
            <path d="M38 2L14 42H28L26 78L52 34H38L38 2Z"/>
          </svg>
        </div>
        <span className="text-xs font-black uppercase tracking-[0.15em] text-amber-700 dark:text-amber-400/70">Current Streak</span>
        <div className="mt-1 flex items-end gap-2">
          <p className="text-[3.5rem] font-black leading-none tracking-tighter text-amber-600 dark:text-amber-400">
            {loading ? "—" : data?.loginStreak ?? 0}
          </p>
          <p className="mb-1.5 text-sm font-black text-amber-600/60 dark:text-amber-400/50">{(data?.loginStreak ?? 0) !== 1 ? "days" : "day"}</p>
        </div>
        {!loading && (() => {
          const s = data?.loginStreak ?? 0;
          if (s === 0) return <p className="text-[11px] font-semibold text-amber-700/60 dark:text-amber-400/50">Start today</p>;
          if (s >= 30) return <span className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase" style={{background:"#b8860b",color:"#fff"}}>Gold earned</span>;
          if (s >= 14) return <p className="text-[11px] font-semibold text-amber-700/70 dark:text-amber-400/60">{30-s} more → gold</p>;
          if (s >= 7) return <span className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase" style={{background:"#9a5b1e",color:"#fff"}}>Bronze · {14-s} → silver</span>;
          return null;
        })()}
      </div>

      {/* Today's Goal — emerald */}
      <div className="relative overflow-hidden rounded-2xl border-l-4 border-emerald-600 bg-emerald-600/10 p-5">
        <div className="pointer-events-none absolute -right-3 -bottom-3 opacity-[0.08]">
          <svg viewBox="0 0 24 24" className="h-20 w-20 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
          </svg>
        </div>
        <span className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400/60">Today's Goal</span>
        <div className="mt-1 flex items-end gap-2">
          <p className="text-[3.5rem] font-black leading-none tracking-tighter text-emerald-700 dark:text-emerald-400">
            {loading ? "—" : data?.usedToday ?? 0}
          </p>
          {!editingGoal ? (
            <div className="mb-1.5 flex items-center gap-1">
              <p className="text-sm font-black text-emerald-700/50 dark:text-emerald-400/50">/ {dailyGoal}</p>
              <button
                onClick={beginEdit}
                className="rounded-md p-0.5 text-emerald-400/40 transition-colors hover:text-emerald-400"
                title="Edit goal"
              >
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z"/>
                </svg>
              </button>
            </div>
          ) : (
            <div className="mb-1.5 flex items-center gap-1">
              <span className="text-sm font-black text-emerald-700/50 dark:text-emerald-400/50">/</span>
              <input
                autoFocus
                type="number"
                min={1}
                max={99}
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") cancel();
                }}
                onBlur={commit}
                className="w-10 rounded-md bg-emerald-400/20 px-1.5 py-0.5 text-center text-xs font-black text-emerald-400 outline-none focus:bg-emerald-400/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          )}
        </div>
        <p className="text-[11px] font-semibold text-emerald-700/60 dark:text-emerald-400/60">
          {!loading && data
            ? (data.usedToday >= dailyGoal) ? "Goal smashed!"
            : data.usedToday === 0 ? "Let's get started"
            : `${dailyGoal - data.usedToday} more to go`
            : ""}
        </p>
      </div>

      {/* All-Time Best Day — violet, shown in XP */}
      <div className="relative overflow-hidden rounded-2xl border-l-4 border-violet-600 bg-violet-600/10 p-5">
        <div className="pointer-events-none absolute -right-3 -bottom-2 opacity-[0.08]">
          <svg viewBox="0 0 24 24" className="h-20 w-20 text-violet-600" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 3h10v7a5 5 0 0 1-10 0V3z"/>
            <path d="M7 5H4a2 2 0 0 0-2 2v1a3 3 0 0 0 3 3h2"/><path d="M17 5h3a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3h-2"/>
            <line x1="12" y1="15" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/>
          </svg>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-[0.15em] text-violet-700 dark:text-violet-400/60">Best Day Ever</span>
          {!loading && (data?.todayXP ?? 0) > 0 && (
            <span className="text-sm font-black text-violet-700/80 dark:text-violet-400">Today {(data!.todayXP).toLocaleString()} XP</span>
          )}
        </div>
        <div className="mt-1 flex items-end gap-1">
          <p className="text-[3.5rem] font-black leading-none tracking-tighter text-violet-700 dark:text-violet-400">
            {loading ? "—" : (data?.bestDayXP ?? 0).toLocaleString()}
          </p>
          {!loading && (data?.bestDayXP ?? 0) > 0 && (
            <p className="mb-1.5 text-sm font-black text-violet-700/50 dark:text-violet-400/60">XP</p>
          )}
        </div>
        <p className="text-[11px] font-semibold text-violet-700/60 dark:text-violet-400/60">in a single day</p>
      </div>

    </div>
  );
}
