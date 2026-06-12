import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { QUOTES } from "../data";

export function QuoteCard() {
  const [offset, setOffset] = useState(0);
  const day = new Date().getUTCFullYear() * 1000 + Math.floor((Date.now() - new Date(new Date().getUTCFullYear(), 0, 0).getTime()) / 86400000);
  const q = QUOTES[(day + offset) % QUOTES.length];
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="text-center flex-1">
          <p className="text-sm italic text-muted-foreground">"{q.text}"</p>
          {q.author && q.author !== "Anonymous" && <p className="mt-2 text-xs font-semibold text-muted-foreground/60">— {q.author}</p>}
        </div>
        <button
          onClick={() => setOffset((v) => (v + 1) % QUOTES.length)}
          className="shrink-0 rounded-full p-1.5 text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-muted-foreground"
          title="New quote"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
