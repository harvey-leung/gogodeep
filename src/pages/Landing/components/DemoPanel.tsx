import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, ScanLine, Send, X } from "lucide-react";
import { RichText } from "@/components/RichText";
import { cn } from "@/lib/utils";
import { LOADING_MSGS, PERCENT_PRACTICE, PERCENT_STEPS, type DemoTab } from "../data";
import { ScreenshotCard } from "./ScreenshotCard";

export const DemoPanel = () => {
  const [phase, setPhase] = useState(0);
  const [tab, setTab] = useState<DemoTab>("steps");
  const [stepIdx, setStepIdx] = useState(0);
  const [stepViewMode, setStepViewMode] = useState<"deck" | "reveal">("deck");
  const [revealedCount, setRevealedCount] = useState(1);
  const stepAnimDir = useRef<1 | -1>(1);
  const [blueOpenStep, setBlueOpenStep] = useState<number | null>(null);
  const [blueQuestion, setBlueQuestion] = useState("");
  const [blueReplied, setBlueReplied] = useState(false);
  const [blueTyping, setBlueTyping] = useState(true);
  const [bluePos, setBluePos] = useState({ x: 0, y: 0 });
  const blueDrag = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number }>({
    dragging: false, startX: 0, startY: 0, origX: 0, origY: 0,
  });
  const onBlueDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    blueDrag.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: bluePos.x, origY: bluePos.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onBlueDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!blueDrag.current.dragging) return;
    setBluePos({
      x: blueDrag.current.origX + (e.clientX - blueDrag.current.startX),
      y: blueDrag.current.origY + (e.clientY - blueDrag.current.startY),
    });
  };
  const onBlueDragEnd = () => { blueDrag.current.dragging = false; };
  const [practiceAnswers, setPracticeAnswers] = useState<Record<number, number>>({});
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const lastInteractionRef = useRef<number>(Date.now());
  const isHoveredRef = useRef(false);

  useEffect(() => {
    if (blueOpenStep === null) return;
    setBlueTyping(true);
    setBluePos({ x: 0, y: 0 });
    const t = setTimeout(() => setBlueTyping(false), 1100);
    return () => clearTimeout(t);
  }, [blueOpenStep]);

  useEffect(() => {
    if (phase === 0) {
      const t = setTimeout(() => setPhase(1), 1200);
      return () => clearTimeout(t);
    }
    if (phase === 1) {
      const t = setTimeout(() => setPhase(2), 1800);
      return () => clearTimeout(t);
    }
    if (phase === 2) {
      setLoadingMsgIdx(0);
      const cycle = setInterval(() => setLoadingMsgIdx((i) => Math.min(i + 1, LOADING_MSGS.length - 1)), 500);
      const t = setTimeout(() => { clearInterval(cycle); setPhase(3); }, 1900);
      return () => { clearTimeout(t); clearInterval(cycle); };
    }
    // Auto-reset after 13 s if user hasn't interacted, otherwise 33 s
    const check = setInterval(() => {
      const idle = Date.now() - lastInteractionRef.current;
      if (!isHoveredRef.current && idle > 33000) {
        setPhase(0); setTab("steps"); setStepIdx(0); setStepViewMode("deck"); setRevealedCount(1); setBlueOpenStep(null); setBlueQuestion(""); setBlueReplied(false); setBlueTyping(true); setBluePos({ x: 0, y: 0 }); setPracticeAnswers({});
      }
    }, 5000);
    const autoReset = setTimeout(() => {
      if (!isHoveredRef.current && Date.now() - lastInteractionRef.current > 5000) {
        setPhase(0); setTab("steps"); setStepIdx(0); setStepViewMode("deck"); setRevealedCount(1); setBlueOpenStep(null); setBlueQuestion(""); setBlueReplied(false); setBlueTyping(true); setBluePos({ x: 0, y: 0 }); setPracticeAnswers({});
      }
    }, 18000);
    return () => { clearInterval(check); clearTimeout(autoReset); };
  }, [phase]);

  return (
    <div
      className="relative h-[440px] scale-[0.93] origin-top"
      onMouseEnter={() => { isHoveredRef.current = true; lastInteractionRef.current = Date.now(); }}
      onMouseLeave={() => { isHoveredRef.current = false; lastInteractionRef.current = Date.now(); }}
      onMouseMove={() => { lastInteractionRef.current = Date.now(); }}
    >
      <div className="absolute inset-0 overflow-y-auto rounded-2xl border border-primary/30 bg-card shadow-[0_0_40px_hsl(225,75%,55%,0.18),0_0_80px_hsl(225,75%,55%,0.08)]">
      <div className="relative min-h-full">

        {/* Phase 0: empty state */}
        {phase === 0 && (
          <div className="flex h-[440px] items-center justify-center select-none">
            <div className="flex flex-col items-center gap-3">
              <p className="text-2xl font-extrabold tracking-tight text-foreground">Drop a screenshot</p>
              <p className="text-sm text-muted-foreground">of any problem</p>
              {/* Simple curved arrow pointing down */}
              <svg width="28" height="40" viewBox="0 0 28 40" fill="none" className="text-primary mt-1">
                <path d="M14 2 C14 2 14 28 14 30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M6 24 L14 34 L22 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}

        {/* Phase 1: screenshot drops into center */}
        {phase === 1 && (
          <div className="flex h-[440px] items-center justify-center">
            <div className="animate-slide-in-paper">
              <ScreenshotCard />
            </div>
          </div>
        )}

        {/* Phase 2: loading */}
        {phase === 2 && (
          <div className="flex h-[440px] flex-col items-center justify-center gap-5 p-8">
            <ScreenshotCard dimmed />
            <div className="w-48">
              <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary animate-loading-fill" />
              </div>
            </div>
          </div>
        )}

        {/* Phase 3: results */}
        {phase === 3 && (
          <div className="animate-fade-up flex min-h-full flex-col p-4">
            {/* 2-tab bar */}
            {(() => {
              const demoTabs: { value: DemoTab; label: string }[] = [
                { value: "steps", label: "Step by Step" },
                { value: "practice", label: "Practice" },
              ];
              const demoTabIdx = demoTabs.findIndex((t) => t.value === tab);
              return (
                <div className="relative mb-3 flex gap-1 rounded-lg border border-border bg-secondary p-1">
                  <div
                    className="absolute bottom-1 top-1 rounded-md bg-card shadow-sm transition-transform duration-200 ease-out"
                    style={{ width: "calc((100% - 8px) / 2)", transform: `translateX(calc(${demoTabIdx} * 100%))` }}
                  />
                  {demoTabs.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => { setTab(value); lastInteractionRef.current = Date.now(); }}
                      className={`relative z-10 flex flex-1 items-center justify-center rounded-md py-1.5 text-sm font-semibold transition-colors duration-200 ${
                        tab === value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              );
            })()}

            {tab === "steps" && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-base font-black text-primary">Solve 2x² − 5x − 3 = 0</p>
                  <button
                    onClick={() => {
                      setStepViewMode((v) => {
                        const next = v === "deck" ? "reveal" : "deck";
                        if (next === "reveal") setRevealedCount(1);
                        return next;
                      });
                      lastInteractionRef.current = Date.now();
                    }}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {stepViewMode === "deck" ? (
                      <><ChevronRight className="h-3.5 w-3.5" /> Reveal steps</>
                    ) : (
                      <><ScanLine className="h-3.5 w-3.5" /> One by one</>
                    )}
                  </button>
                </div>

                {stepViewMode === "reveal" ? (
                  <div className="flex-1 space-y-2.5 overflow-y-auto pr-0.5 animate-in fade-in duration-200">
                    {PERCENT_STEPS.slice(0, revealedCount).map(({ step }, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>
                        <div className="text-sm leading-relaxed text-foreground"><RichText text={step} /></div>
                      </div>
                    ))}
                    {revealedCount < PERCENT_STEPS.length ? (
                      <button
                        onClick={() => { setRevealedCount((v) => v + 1); lastInteractionRef.current = Date.now(); }}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                      >
                        Show next step <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <p className="pt-1 text-center text-[10px] text-muted-foreground/50">All steps revealed.</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col">
                    <div className="flex-1 overflow-hidden rounded-2xl border border-primary/25 bg-card p-4 shadow-[0_0_24px_hsl(var(--primary)/0.08)]">
                      <div
                        key={stepIdx}
                        className={cn(
                          "h-full overflow-y-auto animate-in fade-in duration-200 fill-mode-both",
                          stepAnimDir.current === 1 ? "slide-in-from-right-4" : "slide-in-from-left-4"
                        )}
                      >
                      <div className="mb-3 flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-base font-black text-primary-foreground shadow-[0_0_16px_hsl(var(--primary)/0.4)]">
                          {stepIdx + 1}
                        </span>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                          Step {stepIdx + 1} of {PERCENT_STEPS.length}
                        </p>
                      </div>
                      <div className="text-sm leading-relaxed text-foreground">
                        <RichText text={PERCENT_STEPS[stepIdx].step} />
                      </div>
                      </div>
                    </div>

                    {/* Ask Blue — stays at fixed position below step card */}
                    <button
                      onClick={() => {
                        setBlueOpenStep((cur) => {
                          const next = cur === stepIdx ? null : stepIdx;
                          if (next !== null) { setBlueQuestion(""); setBlueReplied(false); }
                          return next;
                        });
                        lastInteractionRef.current = Date.now();
                      }}
                      className="mt-2 flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <img src="/blue.png" alt="" draggable={false} className="h-4 w-4 rounded-full object-cover shrink-0" />
                      Ask Blue about this step
                    </button>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        disabled={stepIdx === 0}
                        onClick={() => {
                          stepAnimDir.current = -1;
                          setStepIdx((i) => Math.max(0, i - 1));
                          lastInteractionRef.current = Date.now();
                        }}
                        className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Back
                      </button>
                      <div className="flex items-center gap-1">
                        {PERCENT_STEPS.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              stepAnimDir.current = i > stepIdx ? 1 : -1;
                              setStepIdx(i);
                              lastInteractionRef.current = Date.now();
                            }}
                            aria-label={`Go to step ${i + 1}`}
                            className={`h-1.5 rounded-full transition-all duration-200 ${i === stepIdx ? "w-5 bg-primary" : "w-1.5 bg-border hover:bg-primary/40"}`}
                          />
                        ))}
                      </div>
                      <button
                        disabled={stepIdx === PERCENT_STEPS.length - 1}
                        onClick={() => {
                          stepAnimDir.current = 1;
                          setStepIdx((i) => Math.min(PERCENT_STEPS.length - 1, i + 1));
                          lastInteractionRef.current = Date.now();
                        }}
                        className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {stepIdx === PERCENT_STEPS.length - 1 && (
                      <button
                        onClick={() => { setTab("practice"); lastInteractionRef.current = Date.now(); }}
                        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 animate-in fade-in duration-300"
                      >
                        Practice this step <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "practice" && (
              <div className="flex-1 space-y-3 overflow-y-auto">
                {PERCENT_PRACTICE.map((item, i) => {
                  const chosen = practiceAnswers[i];
                  const answered = chosen !== undefined;
                  return (
                    <div key={i} className="rounded-xl border border-border bg-card p-3.5">
                      <p className="mb-3 text-base font-semibold text-foreground">{item.q}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {item.options.map((opt, j) => {
                          const isCorrect = j === item.correct;
                          const isChosen = chosen === j;
                          return (
                            <button
                              key={j}
                              disabled={answered}
                              onClick={() => { setPracticeAnswers((p) => ({ ...p, [i]: j })); lastInteractionRef.current = Date.now(); }}
                              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                                !answered
                                  ? "border-border text-foreground hover:border-primary/50 hover:bg-primary/5"
                                  : isCorrect
                                  ? "border-green-500/50 bg-green-500/10 text-green-400"
                                  : isChosen
                                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                                  : "border-border text-muted-foreground opacity-50"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      {answered && (
                        <p className="mt-2.5 text-xs text-muted-foreground">{item.explanation}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </div>
      </div>
      {blueOpenStep !== null && (
        <div
          className="absolute z-10 bottom-4 right-4 w-64 select-none overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-2xl animate-in fade-in duration-150"
          style={{ transform: `translate(${bluePos.x}px, ${bluePos.y}px)`, transition: 'none' }}
        >
          <div
            onPointerDown={onBlueDragStart}
            onPointerMove={onBlueDragMove}
            onPointerUp={onBlueDragEnd}
            onPointerCancel={onBlueDragEnd}
            className="flex items-center gap-2.5 border-b border-border bg-secondary/40 px-3.5 py-2.5 cursor-grab touch-none active:cursor-grabbing"
          >
            <img src="/blue.png" alt="" draggable={false} className="h-7 w-7 rounded-full object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Blue</p>
              <p className="truncate text-[10px] text-muted-foreground">drag to move</p>
            </div>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => { setBlueOpenStep(null); lastInteractionRef.current = Date.now(); }}
              className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2.5 p-3.5">
            {blueTyping ? (
              <div className="flex w-fit items-center gap-1.5 rounded-xl rounded-tl-sm border border-border bg-secondary/40 px-3.5 py-2.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
              </div>
            ) : (
              <div className="rounded-xl rounded-tl-sm border border-border bg-secondary/40 px-3.5 py-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <p className="text-xs leading-relaxed text-foreground/85">I understand your step now. What question do you have?</p>
              </div>
            )}
            {blueReplied && (
              <div className="rounded-xl rounded-tl-sm border border-primary/30 bg-primary/5 px-3.5 py-2.5 animate-in fade-in duration-300">
                <p className="text-xs leading-relaxed text-foreground/80">
                  Great question — this is exactly the kind of back-and-forth you'd get with the real Blue. Sign up free and ask away on any step →
                </p>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!blueQuestion.trim() || blueReplied || blueTyping) return;
                setBlueReplied(true);
                lastInteractionRef.current = Date.now();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={blueQuestion}
                onChange={(e) => { setBlueQuestion(e.target.value); lastInteractionRef.current = Date.now(); }}
                placeholder="Ask Blue a question…"
                disabled={blueReplied || blueTyping}
                className="flex-1 min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!blueQuestion.trim() || blueReplied || blueTyping}
                className="shrink-0 flex items-center justify-center rounded-lg bg-primary p-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30 disabled:pointer-events-none"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
