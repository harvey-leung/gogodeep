import { useEffect, useState } from "react";

type Spotlight = "upload" | "sidebar" | null;

type StepDef = {
  x: string;
  y: string;
  bubbleUp: boolean;
  title: string;
  message: string;
  nextLabel: string;
  showNext: boolean;
  spotlight: Spotlight;
};

const STEPS: StepDef[] = [
  {
    x: "50%", y: "40%", bubbleUp: false,
    title: "Hey there! 👋",
    message: "I'm Blue! I'll give you a quick tour of Gogodeep — just a few steps, I promise.",
    nextLabel: "Let's go →", showNext: true, spotlight: null,
  },
  {
    x: "65%", y: "50%", bubbleUp: false,
    title: "Your upload zone",
    message: "Drop a photo of a question you're stuck on, or your working for a tough problem. Gogodeep diagnoses exactly where things went wrong and walks you through it.",
    nextLabel: "Got it →", showNext: true, spotlight: "upload",
  },
  {
    x: "65%", y: "50%", bubbleUp: false,
    title: "Upload to continue 📸",
    message: "Drop in your first image — a question you need to understand, or working you've already attempted. Pick any mode when the dialog pops up. I'll wait!",
    nextLabel: "", showNext: false, spotlight: "upload",
  },
  {
    x: "28%", y: "36%", bubbleUp: false,
    title: "Your scan history",
    message: "Your scan is saved right here in the sidebar. Open it anytime to see the step-by-step guide, the underlying concept, and practice questions tailored to your gap.",
    nextLabel: "Nice! →", showNext: true, spotlight: "sidebar",
  },
  {
    x: "78%", y: "80%", bubbleUp: true,
    title: "All set! 🎯",
    message: "I'll be right down here whenever you need a hand. Good luck!",
    nextLabel: "Let's go!", showNext: true, spotlight: null,
  },
];

export default function WhaleTutorial({
  step,
  onNext,
  onSkip,
  uploadZoneRef,
}: {
  step: number;
  onNext: () => void;
  onSkip: () => void;
  uploadZoneRef: React.RefObject<HTMLElement | null>;
}) {
  const cfg = STEPS[step];
  if (!cfg) return null;

  const [spot, setSpot] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    function calc() {
      const PAD = 14;
      if (cfg.spotlight === "upload" && uploadZoneRef.current) {
        const r = uploadZoneRef.current.getBoundingClientRect();
        setSpot({ x: r.x - PAD, y: r.y - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });
      } else if (cfg.spotlight === "sidebar") {
        setSpot({ x: 0, y: 56, w: 242, h: window.innerHeight - 56 });
      } else {
        setSpot(null);
      }
    }
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [step, cfg.spotlight, uploadZoneRef]);

  const bubble = (
    <div className="w-72 rounded-2xl border border-border bg-card p-4 shadow-2xl">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">{cfg.title}</p>
      <p className="text-sm leading-relaxed text-foreground">{cfg.message}</p>
      {cfg.showNext && (
        <button
          onClick={onNext}
          className="mt-3 w-full rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {cfg.nextLabel}
        </button>
      )}
    </div>
  );

  const whale = (
    <span
      aria-hidden
      style={{
        display: "block",
        fontSize: 52,
        lineHeight: 1,
        userSelect: "none",
        animation: "whalE-bob 2.2s ease-in-out infinite",
      }}
    >
      🐋
    </span>
  );

  return (
    <div className="fixed inset-0 z-50">
      {/* Dark overlay with spotlight cutout */}
      <svg
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <defs>
          <mask id="whal-e-spot">
            <rect width="100%" height="100%" fill="white" />
            {spot && <rect x={spot.x} y={spot.y} width={spot.w} height={spot.h} rx="16" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.82)" mask="url(#whal-e-spot)" />
        {spot && (
          <rect
            x={spot.x} y={spot.y} width={spot.w} height={spot.h} rx="16"
            fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.65"
          />
        )}
      </svg>

      {/* On step 2 the upload zone is promoted above z-50, so the blocker is transparent.
          All other steps block clicks to the page behind. */}
      <div
        className="absolute inset-0"
        style={{ pointerEvents: step === 2 ? "none" : "auto" }}
      />

      {/* Skip */}
      <button
        onClick={onSkip}
        className="absolute right-5 top-5 z-20 text-xs text-white/40 transition-colors hover:text-white/70"
        style={{ pointerEvents: "auto" }}
      >
        Skip tutorial
      </button>

      {/* Animated whale + bubble */}
      <div
        className="absolute z-20"
        style={{
          left: cfg.x,
          top: cfg.y,
          transform: "translate(-50%, -50%)",
          transition: "left 0.6s cubic-bezier(0.34,1.56,0.64,1), top 0.6s cubic-bezier(0.34,1.56,0.64,1)",
          pointerEvents: "auto",
        }}
      >
        <div className="flex items-center gap-4">
          {whale}
          {bubble}
        </div>
      </div>

      <style>{`
        @keyframes whalE-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-9px); }
        }
      `}</style>
    </div>
  );
}
