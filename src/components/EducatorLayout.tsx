import * as React from "react";
import { ScanLine, ChevronsLeft, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

import HistorySidebar from "@/components/HistorySidebar";
import { cn } from "@/lib/utils";

export default function EducatorLayout({
  title,
  subtitle,
  headerContent,
  children,
  className,
  noSidebar = false,
  fullBleed = false,
  noBorder = false,
}: {
  title?: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noSidebar?: boolean;
  fullBleed?: boolean;
  noBorder?: boolean;
}) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = React.useState(
    () => localStorage.getItem("dive_sidebar_collapsed") === "true"
  );

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("dive_sidebar_collapsed", String(next));
  }

  return (
    <div className="relative z-10 flex h-screen overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      {!noSidebar && <aside className={cn(
        "hidden lg:flex h-full flex-shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-200",
        collapsed ? "w-12" : "w-60"
      )}>

        {collapsed ? (
          /* Collapsed: hamburger only */
          <div className="flex flex-col items-center pt-3">
            <button
              onClick={toggleCollapsed}
              title="Expand sidebar"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Dive
              </span>
              <button
                onClick={toggleCollapsed}
                title="Collapse sidebar"
                className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* New scan button */}
            <div className="p-2">
              <button
                onClick={() => navigate("/dive")}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-primary/70 transition-colors hover:bg-primary/5 hover:text-primary"
              >
                <ScanLine className="h-3.5 w-3.5 shrink-0" />
                New scan
              </button>
            </div>

            <div className="border-t border-border" />

            {/* Scrollable scan history */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <HistorySidebar />
            </div>
          </>
        )}
      </aside>}

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", className)}>
        {/* Sticky top bar */}
        {(title || headerContent) && (
          <div className={cn("sticky top-0 z-10 flex items-center gap-3 bg-card/80 px-6 py-4 backdrop-blur-sm", !noBorder && "border-b border-border")}>
            {headerContent ?? (
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
              </div>
            )}
          </div>
        )}

        {/* Page content */}
        {fullBleed ? (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {children}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
            <div className="container max-w-6xl py-6 sm:py-8">
              {children}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
