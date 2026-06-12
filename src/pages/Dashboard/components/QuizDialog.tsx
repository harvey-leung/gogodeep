import { ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RichText } from "@/components/RichText";
import type { QuizConfig, QuizState } from "@/types/quiz";

function formatTime(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

export function QuizDialog({
  quiz,
  setQuiz,
  elapsedSecs,
  confirmRestart,
  setConfirmRestart,
  startQuiz,
  startQuizWithConfig,
  quizConfig,
}: {
  quiz: QuizState | null;
  setQuiz: React.Dispatch<React.SetStateAction<QuizState | null>>;
  elapsedSecs: number;
  confirmRestart: boolean;
  setConfirmRestart: (v: boolean) => void;
  startQuiz: () => void;
  startQuizWithConfig: (cfg: QuizConfig) => void;
  quizConfig: QuizConfig;
}) {
  return (
    <Dialog open={!!quiz} onOpenChange={(open) => { if (!open) setQuiz(null); }}>
      <DialogContent className="border border-border bg-card sm:max-w-2xl p-0 overflow-hidden gap-0">
        {quiz?.showStats ? (
          <div className="flex flex-col items-center px-8 py-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Quiz complete</p>
            <p className="mt-4 text-7xl font-extrabold text-foreground">
              {quiz.results.filter((r) => r === "correct").length}
              <span className="text-3xl font-medium text-muted-foreground"> / {quiz.questions.length}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{formatTime(elapsedSecs)}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-1.5">
              {quiz.results.map((r, i) => (
                <div key={i} title={`Q${i + 1}: ${r}`}
                  className={`h-3 w-3 rounded-full ${r === "correct" ? "bg-green-400" : "bg-red-400"}`} />
              ))}
            </div>
            <div className="mt-8 flex gap-3">
              <Button variant="outline" className="border-border" onClick={() => startQuizWithConfig(quizConfig)}>
                <RefreshCw className="mr-2 h-4 w-4" /> Try Again
              </Button>
              <Button className="bg-primary hover:bg-primary/90" onClick={() => setQuiz(null)}>Done</Button>
            </div>
          </div>
        ) : quiz ? (() => {
          const currentQ = quiz.questions[quiz.current];
          const advance = () => setQuiz((q) => {
            if (!q) return q;
            if (q.current >= q.questions.length - 1) return { ...q, showStats: true };
            return { ...q, current: q.current + 1, revealed: false, currentResult: null, userInput: "", selectedMcIdx: null };
          });
          const gradeAndAdvance = (grade: "correct" | "incorrect") => setQuiz((q) => {
            if (!q) return q;
            const results = [...q.results, grade];
            if (q.current >= q.questions.length - 1) return { ...q, results, showStats: true };
            return { ...q, results, current: q.current + 1, revealed: false, currentResult: null, userInput: "", selectedMcIdx: null };
          });
          return (
            <div className="flex flex-col">
              {/* Header — Reset on left, counter+timer centred, X from Dialog is top-right */}
              <div className="flex items-center border-b border-border px-4 py-3 pr-12">
                {confirmRestart ? (
                  <div className="flex items-center gap-1.5 mr-3 shrink-0">
                    <span className="text-xs text-muted-foreground">Restart?</span>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => { setConfirmRestart(false); startQuiz(); }}>Yes</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => setConfirmRestart(false)}>No</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground mr-3 shrink-0"
                    onClick={() => setConfirmRestart(true)}>
                    <RefreshCw className="mr-1.5 h-3 w-3" /> Reset
                  </Button>
                )}
                <div className="flex flex-1 items-center justify-center gap-4">
                  <span className="text-xs font-semibold text-muted-foreground">{quiz.current + 1} / {quiz.questions.length}</span>
                  <span className="font-mono text-sm font-semibold text-foreground">{formatTime(elapsedSecs)}</span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1 bg-secondary">
                <div className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(quiz.current / quiz.questions.length) * 100}%` }} />
              </div>
              {/* Body */}
              <div className="space-y-4 px-6 py-6">
                <p className="text-base font-medium text-foreground leading-relaxed"><RichText text={currentQ.question} /></p>

                {/* TF mode */}
                {currentQ.mode === "tf" && !quiz.revealed && (
                  <>
                    <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">Is this statement true or false?</span>
                      <RichText text={currentQ.tfStatement} />
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1 border-border" onClick={() => {
                        const correct = currentQ.tfCorrect === true;
                        setQuiz((q) => q && ({ ...q, revealed: true, currentResult: correct ? "correct" : "incorrect", results: [...q.results, correct ? "correct" : "incorrect"] }));
                      }}>True</Button>
                      <Button variant="outline" className="flex-1 border-border" onClick={() => {
                        const correct = currentQ.tfCorrect === false;
                        setQuiz((q) => q && ({ ...q, revealed: true, currentResult: correct ? "correct" : "incorrect", results: [...q.results, correct ? "correct" : "incorrect"] }));
                      }}>False</Button>
                    </div>
                  </>
                )}

                {/* MC mode */}
                {currentQ.mode === "mc" && !quiz.revealed && (
                  <div className="grid grid-cols-2 gap-2">
                    {currentQ.mcOptions?.map((opt, idx) => (
                      <button key={idx} onClick={() => {
                        const correct = idx === currentQ.mcCorrectIdx;
                        setQuiz((q) => q && ({ ...q, revealed: true, selectedMcIdx: idx, currentResult: correct ? "correct" : "incorrect", results: [...q.results, correct ? "correct" : "incorrect"] }));
                      }}
                        className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-secondary">
                        <span className="mr-2 font-bold text-primary">{String.fromCharCode(65 + idx)}.</span>
                        <RichText text={opt} />
                      </button>
                    ))}
                  </div>
                )}

                {/* Revealed state */}
                {quiz.revealed && (
                  <div className="space-y-3">
                    <div className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${quiz.currentResult === "correct" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                      {quiz.currentResult === "correct" ? "Correct ✓" : "Incorrect ✗"}
                    </div>
                    {currentQ.mode === "mc" && (
                      <div className="grid grid-cols-2 gap-2">
                        {currentQ.mcOptions?.map((opt, idx) => (
                          <div key={idx} className={`rounded-lg border px-4 py-3 text-sm ${idx === currentQ.mcCorrectIdx ? "border-green-500/40 bg-green-500/10 text-green-400 font-semibold" : idx === quiz.selectedMcIdx ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-border bg-secondary/30 text-muted-foreground"}`}>
                            <span className="mr-2 font-bold">{String.fromCharCode(65 + idx)}.</span>
                            <RichText text={opt} />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-primary block mb-1">Correct answer</span>
                      <RichText text={currentQ.answer} />
                    </div>
                    <Button className="w-full bg-primary hover:bg-primary/90" onClick={advance}>
                      {quiz.current < quiz.questions.length - 1 ? <>Next <ArrowRight className="ml-2 h-4 w-4" /></> : "Finish"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })() : null}
      </DialogContent>
    </Dialog>
  );
}
