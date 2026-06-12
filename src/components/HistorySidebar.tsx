import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { Pencil, Search, X, Pin, MoreHorizontal, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SCAN_CACHE_KEY } from "@/lib/supabase";
import { whaleToast } from "@/lib/whaleToast";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type Scan = {
  id: string;
  subject: string | null;
  topic: string | null;
  specific_error_tag: string | null;
  error_category: string | null;
  created_at: string | null;
};

type LabState = {
  names: Record<string, string>; // scanId → custom name
  pins: string[];                // pinned scan IDs (shown at top)
};

// ── Persistence ───────────────────────────────────────────────────────────────

const LS_KEY = "gogodeep_lab_v1";
const EMPTY_STATE: LabState = { names: {}, pins: [] };

function loadLocalState(): LabState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<LabState> & { assignments?: unknown; folders?: unknown };
    return {
      names: parsed.names ?? {},
      pins: Array.isArray(parsed.pins) ? parsed.pins : [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

function saveLocal(s: LabState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* quota */ }
}

async function saveRemote(s: LabState) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await (supabase as any).from("profiles").update({ lab_state: s }).eq("id", user.id);
}

async function loadRemote(): Promise<LabState | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await (supabase as any)
    .from("profiles")
    .select("lab_state")
    .eq("id", user.id)
    .single();
  const raw = data?.lab_state;
  if (!raw || typeof raw !== "object") return null;
  return {
    names: raw.names ?? {},
    pins: Array.isArray(raw.pins) ? raw.pins : [],
  };
}

// ── Scan display name ─────────────────────────────────────────────────────────

function scanLabel(scan: Scan, names: Record<string, string>): string {
  return names[scan.id] || scan.topic || scan.specific_error_tag || scan.subject || "Untitled scan";
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HistorySidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeScanId = (location.state as any)?.scanId as string | undefined;
  const [state, setState] = useState<LabState>(loadLocalState);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Scan | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Sync with Supabase on mount — remote wins
  useEffect(() => {
    loadRemote().then((remote) => {
      if (!remote) return;
      setState(remote);
      saveLocal(remote);
    });
  }, []);

  // Keep in sync with inline title renames done from the report page
  useEffect(() => {
    function handler(e: Event) {
      const { scanId, name } = (e as CustomEvent).detail as { scanId: string; name: string };
      setState((prev) => {
        const names = { ...prev.names, [scanId]: name };
        const next = { ...prev, names };
        saveLocal(next);
        return next;
      });
    }
    window.addEventListener("gogodeep-scan-renamed", handler);
    return () => window.removeEventListener("gogodeep-scan-renamed", handler);
  }, []);

  const update = useCallback((next: LabState) => {
    setState(next);
    saveLocal(next);
    saveRemote(next);
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["history", "error_logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("error_logs")
        .select("id, subject, topic, specific_error_tag, error_category, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Scan[];
    },
    staleTime: 0,
  });

  const scans = useMemo(() => data ?? [], [data]);

  function renameScan(scanId: string, name: string) {
    const names = { ...state.names };
    if (name) names[scanId] = name;
    else delete names[scanId];
    update({ ...state, names });
  }

  function togglePin(scanId: string) {
    const pins = state.pins.includes(scanId)
      ? state.pins.filter((id) => id !== scanId)
      : [scanId, ...state.pins];
    update({ ...state, pins });
  }

  async function deleteScan(scanId: string) {
    await (supabase as any).from("error_logs").delete().eq("id", scanId);
    try { localStorage.removeItem(SCAN_CACHE_KEY(scanId)); } catch { /* ignore */ }
    const names = { ...state.names };
    delete names[scanId];
    const pins = state.pins.filter((id) => id !== scanId);
    update({ names, pins });
    queryClient.invalidateQueries({ queryKey: ["history", "error_logs"] });
    if (activeScanId === scanId) navigate("/dive");
  }

  // Sort: pinned first, then rest in original order
  const sortedScans = useMemo(() => {
    const pinSet = new Set(state.pins);
    const pinned = state.pins.map((id) => scans.find((s) => s.id === id)).filter(Boolean) as Scan[];
    const rest = scans.filter((s) => !pinSet.has(s.id));
    return [...pinned, ...rest];
  }, [scans, state.pins]);

  const filteredScans = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return sortedScans.filter((s) => scanLabel(s, state.names).toLowerCase().includes(q));
  }, [searchQuery, sortedScans, state.names]);

  const displayScans = filteredScans ?? sortedScans;

  return (
    <>
    <div className="flex flex-col py-2">

      {/* ── Search ── */}
      <div className="px-2 pb-2">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3 w-3 text-muted-foreground/50" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search  /"
            className="w-full rounded-md border border-border bg-secondary/50 py-1.5 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 text-muted-foreground/50 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Scan list ── */}
      <div className="px-2">
        {isLoading ? (
          <div className="space-y-1 px-1 pt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 w-full animate-pulse rounded bg-secondary/60" />
            ))}
          </div>
        ) : isError ? (
          <p className="px-1 py-1 text-[11px] text-muted-foreground/70">Couldn't load history.</p>
        ) : displayScans.length === 0 ? (
          searchQuery
            ? <p className="px-1 py-2 text-[11px] text-muted-foreground/50">No scans match.</p>
            : <p className="px-1 py-2 text-[11px] text-muted-foreground/50">Your scans will show up here.</p>
        ) : (
          <div className="space-y-0.5">
            {displayScans.map((scan) => (
              <ScanRow
                key={scan.id}
                scan={scan}
                customName={state.names[scan.id] ?? null}
                isPinned={state.pins.includes(scan.id)}
                onRename={renameScan}
                onTogglePin={togglePin}
                onDelete={(s) => setDeleteTarget(s)}
                isActive={scan.id === activeScanId}
              />
            ))}
          </div>
        )}
      </div>

    </div>
    <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this scan?</AlertDialogTitle>
          <AlertDialogDescription>
            This can't be undone. The scan and all its data will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => { if (deleteTarget) { deleteScan(deleteTarget.id); setDeleteTarget(null); } }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ── ScanRow ───────────────────────────────────────────────────────────────────

function ScanRow({
  scan,
  customName,
  isPinned,
  onRename,
  onTogglePin,
  onDelete,
  isActive = false,
}: {
  scan: Scan;
  customName: string | null;
  isPinned: boolean;
  onRename: (scanId: string, name: string) => void;
  onTogglePin: (scanId: string) => void;
  onDelete: (scan: Scan) => void;
  isActive?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (editing) {
      const label = customName || scan.topic || scan.specific_error_tag || scan.subject || "";
      setDraft(label);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing]);

  function commitRename() {
    const trimmed = draft.trim();
    onRename(scan.id, trimmed);
    setEditing(false);
  }

  async function handleRowClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-action-btn]")) return;
    if (editing) return;

    const raw = localStorage.getItem(SCAN_CACHE_KEY(scan.id));
    if (raw) {
      try {
        const stored = JSON.parse(raw);
        navigate("/report", { state: { ...stored, scanId: scan.id } });
        return;
      } catch { /* fall through */ }
    }

    const { data, error } = await (supabase as any)
      .from("error_logs")
      .select("diagnosis")
      .eq("id", scan.id)
      .single();

    if (error || !data?.diagnosis) {
      whaleToast.error("Could not load this scan.");
      return;
    }

    navigate("/report", { state: { diagnosis: data.diagnosis, mode: (data.diagnosis as any)?.mode ?? "guide", scanId: scan.id } });
  }

  const label = customName || scan.topic || scan.specific_error_tag || scan.subject || "Untitled scan";

  return (
    <div
      onClick={handleRowClick}
      className={cn(
        "group relative flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 hover:bg-secondary/50",
        isActive && "bg-primary/10 ring-1 ring-inset ring-primary/25"
      )}
    >
      {isPinned && !editing && (
        <Pin className="h-2.5 w-2.5 shrink-0 text-primary/60 fill-primary/40" />
      )}

      {editing ? (
        <input
          ref={inputRef}
          data-action-btn
          value={draft}
          maxLength={80}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded border border-primary bg-card px-1.5 py-0.5 text-xs text-foreground outline-none"
        />
      ) : (
        <p className={cn("min-w-0 flex-1 truncate text-[13px] font-medium leading-snug", isActive ? "text-primary" : "text-foreground")}>{label}</p>
      )}

      <div data-action-btn className="shrink-0 w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-150">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              title="Options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-36 border border-border bg-card text-xs">
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-xs"
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            >
              <Pencil className="h-3 w-3" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-xs"
              onClick={(e) => { e.stopPropagation(); onTogglePin(scan.id); }}
            >
              <Pin className={cn("h-3 w-3", isPinned && "fill-current text-primary")} />
              {isPinned ? "Unpin" : "Pin to top"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-xs text-destructive focus:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(scan); }}
            >
              <Trash2 className="h-3 w-3" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
