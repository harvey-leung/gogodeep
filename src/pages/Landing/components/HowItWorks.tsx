import { Card } from "@/components/ui/card";
import { ScreenshotKeys } from "./ScreenshotKeys";

const steps = [
  { renderIcon: () => <ScreenshotKeys />, step: "01", title: "Screenshot", desc: "Drop a screenshot of a difficult problem." },
  { renderIcon: () => <span className="text-2xl font-black text-primary leading-none">!</span>, step: "02", title: "Learn", desc: "Gogodeep breaks the question down, and you'll understand it within minutes." },
];

export function HowItWorks({
  sectionRef,
  highlightedStep,
}: {
  sectionRef: React.RefObject<HTMLElement>;
  highlightedStep: 0 | 1 | 2;
}) {
  return (
    <section ref={sectionRef} className="container pb-10">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">How it works</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {steps.map(({ renderIcon, step, title, desc }) => {
            const isHighlighted = (highlightedStep === 1 && step === "01") || (highlightedStep === 2 && step === "02");
            const sweepStyle = (opacity: number, delay = 0): React.CSSProperties => ({
              background: `linear-gradient(to right, hsl(var(--primary) / ${opacity}) 50%, transparent 50%)`,
              backgroundSize: "200% 100%",
              backgroundPosition: isHighlighted ? "0% 0%" : "100% 0%",
              transition: isHighlighted
                ? `background-position 0.3s ease-out ${delay}s`
                : "background-position 0.35s ease-in",
              WebkitBoxDecorationBreak: "clone",
              boxDecorationBreak: "clone" as React.CSSProperties["boxDecorationBreak"],
              borderRadius: "2px",
              padding: "1px 2px",
            });
            return (
              <Card key={step} className="border-border bg-card p-8 transition-colors hover:bg-accent/50">
                <div className="mb-6 inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-border bg-secondary text-primary px-2 py-2">
                  {renderIcon()}
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">{step}</p>
                <h3 className="mt-2 text-xl font-bold tracking-tight text-foreground">
                  <span style={sweepStyle(0.38)}>{title}</span>
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  <span style={sweepStyle(0.22, 0.06)}>{desc}</span>
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
