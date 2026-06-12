import { calcScanXP, CHALLENGE_BONUS_XP } from "@/lib/xp";

export function DailyChallengeCard({ todayChallenge, onStart }: { todayChallenge: string; onStart: () => void }) {
  return (
    <div className="w-[130px] shrink-0 rounded-2xl bg-amber-400 p-3.5 flex flex-col gap-1.5">
      <span className="text-[9px] font-black uppercase tracking-[0.1em] text-black/60 whitespace-nowrap">Daily Challenge</span>
      <span className="text-sm font-black text-black leading-none">+{calcScanXP(todayChallenge, null) + CHALLENGE_BONUS_XP} XP</span>
      <span className="text-[10px] font-semibold text-black/50">5 min</span>
      <button onClick={onStart}
        className="mt-auto w-full rounded-lg bg-black px-2 py-1.5 text-xs font-black text-amber-400 transition-all hover:bg-black/80 active:scale-95">
        Start →
      </button>
    </div>
  );
}
