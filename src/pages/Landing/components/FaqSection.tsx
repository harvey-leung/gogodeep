import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ_ITEMS } from "../data";

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
      {FAQ_ITEMS.map((item, i) => (
        <div key={i}>
          <button
            className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-foreground hover:bg-accent/40 transition-colors"
            onClick={() => setOpen(open === i ? null : i)}
          >
            {item.q}
            <ChevronDown className={`ml-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open === i ? "rotate-180" : ""}`} />
          </button>
          {open === i && (
            <div className="px-5 pt-1 pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</div>
          )}
        </div>
      ))}
    </div>
  );
}
