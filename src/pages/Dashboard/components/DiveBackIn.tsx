import { ChevronRight } from "lucide-react";
import type { Scan } from "@/types/domain";

export function DiveBackIn({
  loading,
  recentScans,
  onScanClick,
}: {
  loading: boolean;
  recentScans: Scan[];
  onScanClick: (scanId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Dive back in</p>
      </div>
      {!loading && recentScans.length > 0 ? (
        <div className="max-h-[176px] overflow-y-auto space-y-1.5">
          {recentScans.slice(0, 6).map((scan) => (
            <button
              key={scan.id}
              onClick={() => onScanClick(scan.id)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
            >
              <span className={`shrink-0 rounded-lg p-1.5 text-[10px] font-black uppercase leading-none ${
                scan.error_category?.toLowerCase() === "conceptual"
                  ? "bg-primary/10 text-primary"
                  : scan.error_category?.toLowerCase() === "calculation"
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-secondary text-muted-foreground"
              }`}>
                {scan.error_category?.slice(0, 3).toUpperCase() ?? "—"}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {scan.label}
              </span>
              {scan.created_at && (
                <span className="shrink-0 text-[10px] text-muted-foreground/60">
                  {new Date(scan.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
            </button>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">No scans yet — start your first one above.</p>
      )}
    </div>
  );
}
