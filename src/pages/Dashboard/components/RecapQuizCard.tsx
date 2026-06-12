import { Loader2 } from "lucide-react";
import { whaleToast } from "@/lib/whaleToast";
import { cn } from "@/lib/utils";
import { QUIZ_XP } from "@/lib/xp";
import type { DashboardData } from "@/types/dashboard";
import type { QuizQuestion } from "@/types/quiz";

export function RecapQuizCard({
  data,
  quizDoneToday,
  quizLoading,
  quizQuestions,
  quizGenError,
  onStartQuiz,
  onNavigate,
  fetchRecapQuiz,
}: {
  data: DashboardData | null;
  quizDoneToday: boolean;
  quizLoading: boolean;
  quizQuestions: QuizQuestion[] | null;
  quizGenError: "limit" | "error" | null;
  onStartQuiz: () => void;
  onNavigate: (to: string) => void;
  fetchRecapQuiz: (topics: string[]) => void;
}) {
  const recentCount = data?.recentScans.length ?? 0;
  return (
    <div className="w-[130px] shrink-0 rounded-2xl border border-border bg-card p-3.5 flex flex-col gap-1.5">
      <span className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">Recap Quiz</span>
      <span className="text-sm font-black text-foreground leading-none">+{QUIZ_XP} XP</span>
      <span className="text-[10px] font-semibold text-muted-foreground/60">3–5 min</span>
      {quizDoneToday && data?.plan !== "deep" ? (
        <button onClick={() => onNavigate("/pricing")} className="mt-auto w-full rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5 text-xs font-black text-primary transition-all hover:bg-primary/10">
          Get Deep
        </button>
      ) : recentCount < 3 ? (
        <button
          onClick={() => whaleToast.error(`Make ${3 - recentCount} more scan${3 - recentCount === 1 ? "" : "s"} for a recap quiz!`)}
          className="mt-auto w-full rounded-lg bg-secondary px-2 py-1.5 text-[9px] font-bold text-muted-foreground text-left transition-colors hover:text-foreground"
        >
          Need {3 - recentCount} more scans
        </button>
      ) : quizLoading ? (
        <div className="mt-auto flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /></div>
      ) : (
        <button
          onClick={() => {
            if (!quizQuestions?.length) {
              if (quizGenError === "limit") {
                whaleToast.error("You've already done today's recap quiz — come back tomorrow!");
              } else if (quizGenError === "error") {
                whaleToast.error("Couldn't put together your recap quiz. Tap again to retry.");
                const topics = data?.recentScans.slice(0, 5).map((s) => s.label).filter(Boolean) ?? [];
                if (topics.length) fetchRecapQuiz(topics);
              } else {
                whaleToast.error("Still putting your recap quiz together — give me a moment and try again!");
              }
              return;
            }
            onStartQuiz();
          }}
          className={cn(
            "mt-auto w-full rounded-lg px-2 py-1.5 text-xs font-black transition-all active:scale-95",
            quizQuestions?.length
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          Start →
        </button>
      )}
    </div>
  );
}
