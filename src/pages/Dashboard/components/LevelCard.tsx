import type { DashboardData } from "@/types/dashboard";
import { LEVELS, LevelBadge } from "./LevelBadge";

type DailyClaim = { date: string; amount: number; claimed: boolean };

export function LevelCard({
  data,
  dailyClaim,
  onClaim,
  onScan,
}: {
  data: DashboardData;
  dailyClaim: DailyClaim;
  onClaim: () => void;
  onScan: () => void;
}) {
  const xp = data.totalXP;
  const currentLvl = [...LEVELS].reverse().find((l) => xp >= l.xpReq) ?? LEVELS[0];
  const nextLvl = LEVELS.find((l) => l.xpReq > xp);
  const progress = nextLvl
    ? Math.min(100, ((xp - currentLvl.xpReq) / (nextLvl.xpReq - currentLvl.xpReq)) * 100)
    : 100;

  return (
    <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <LevelBadge lvl={currentLvl} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-foreground">{currentLvl.name}</span>
              {nextLvl && <span className="text-[10px] font-semibold text-muted-foreground">→ ???</span>}
            </div>
            <span className="text-sm font-black tabular-nums" style={{ color: currentLvl.color }}>
              {xp.toLocaleString()} XP
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${currentLvl.color}cc, ${currentLvl.inner})` }} />
          </div>
          {nextLvl && <p className="mt-0.5 text-[9px] text-muted-foreground">{(nextLvl.xpReq - xp).toLocaleString()} XP to next</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onScan}
          className="flex-1 rounded-xl bg-amber-400 px-4 py-1.5 text-sm font-black text-black shadow-sm shadow-amber-400/30 transition-all hover:bg-amber-300 hover:scale-[1.02]">
          Scan now →
        </button>
        <button
          onClick={onClaim}
          disabled={dailyClaim.claimed}
          className="flex-1 rounded-xl border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-black text-primary transition-all hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {dailyClaim.claimed ? (() => { const now = new Date(); const secsLeft = (24 - now.getHours() - 1) * 3600 + (59 - now.getMinutes()) * 60 + (59 - now.getSeconds()); const h = Math.floor(secsLeft / 3600); const m = Math.floor((secsLeft % 3600) / 60); return h > 0 ? `Next in ${h}h ${m}m` : `Next in ${m}m`; })() : `Claim +${dailyClaim.amount} XP`}
        </button>
      </div>
    </div>
  );
}
