import { Waves } from "lucide-react";

export function StreamCard({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-3">Stream</p>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Waves className="h-6 w-6" />
        </div>
        <div className="text-center">
          <p className="text-sm font-black text-foreground">Your personalised learning path</p>
          <p className="mt-1 text-xs text-muted-foreground">Blue maps out exactly what you need to study next, based on your scans.</p>
        </div>
        <button
          onClick={onStart}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-black text-primary-foreground transition-opacity hover:opacity-90"
        >
          Start a stream →
        </button>
      </div>
    </div>
  );
}
