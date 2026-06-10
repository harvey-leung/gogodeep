import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, LogOut, UserCircle2,
  Moon, Sun, SunMoon, Settings, Mail, Menu, ChevronsLeft, ChevronDown, ScanLine, Waves,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import gogodeepLogo from "@/assets/gogodeep-logo.png";
import { applyColorMode, getStoredColorMode, type ColorMode } from "@/lib/theme";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import HistorySidebar from "@/components/HistorySidebar";

const COLOR_MODE_CYCLE: ColorMode[] = ["dark", "white", "auto"];
const COLOR_MODE_ICONS: Record<ColorMode, React.ReactNode> = {
  dark:  <Moon className="h-4 w-4" />,
  white: <Sun className="h-4 w-4" />,
  auto:  <SunMoon className="h-4 w-4" />,
};
const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  dark: "Dark", white: "Light", auto: "System",
};

const isWorkspacePath = (p: string) => p.startsWith("/dive") || p.startsWith("/report");

export default function AppSidebar({ user }: { user: User | null; onUserUpdate?: (u: User) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [colorMode, setColorMode] = useState<ColorMode>(getStoredColorMode);
  const [plan, setPlan] = useState<string>("free");
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("main_sidebar_collapsed") === "true");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [diveExpanded, setDiveExpanded] = useState(
    () => isWorkspacePath(location.pathname)
  );

  useEffect(() => {
    if (isWorkspacePath(location.pathname)) setDiveExpanded(true);
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.id) return;
    (supabase as any).from("profiles").select("plan").eq("id", user.id).single()
      .then(({ data }: { data: any }) => { if (data?.plan) setPlan(data.plan); });
  }, [user?.id]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("main_sidebar_collapsed", String(next));
    window.dispatchEvent(new CustomEvent("main-sidebar-toggle", { detail: { collapsed: next } }));
  }

  const displayName = (u: User) => u.user_metadata?.username ?? u.email?.split("@")[0] ?? "Account";

  function cycleColorMode() {
    const next = COLOR_MODE_CYCLE[(COLOR_MODE_CYCLE.indexOf(colorMode) + 1) % 3];
    applyColorMode(next);
    setColorMode(next);
  }

  async function onLogout() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  const isDashboard = location.pathname === "/dashboard";
  const isWorkspace = isWorkspacePath(location.pathname);

  return (
    <>
    <aside className={cn(
      "hidden md:flex fixed left-0 top-0 z-50 h-screen flex-col border-r border-border bg-card transition-[width] duration-200 overflow-hidden",
      collapsed ? "w-14" : "w-64"
    )}>

      {collapsed ? (
        /* ── Collapsed ── */
        <div className="flex flex-col items-center py-3 gap-1">
          <button onClick={toggleCollapsed} title="Expand sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-accent hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <div className="my-1 h-px w-8 bg-border" />
          <Link to="/dashboard" title="Dashboard"
            className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
              isDashboard ? "bg-accent text-foreground" : "text-foreground/70 hover:bg-accent hover:text-foreground")}>
            <Home className="h-4 w-4" />
          </Link>
          <Link to="/dive" title="Dive"
            className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
              isWorkspace ? "bg-accent text-foreground" : "text-foreground/70 hover:bg-accent hover:text-foreground")}>
            <ScanLine className="h-4 w-4" />
          </Link>
          <Link to="/stream" title="Stream"
            className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
              location.pathname.startsWith("/stream") ? "bg-accent text-foreground" : "text-foreground/70 hover:bg-accent hover:text-foreground")}>
            <Waves className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        /* ── Expanded ── */
        <>
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between px-4 py-4">
            <Link to="/dashboard" className="flex items-center gap-3 min-w-0">
              <img src={gogodeepLogo} alt="Gogodeep" className="h-7 w-7 shrink-0 object-contain" />
              <span className="text-base font-bold tracking-tight text-foreground truncate">Gogodeep</span>
            </Link>
            <button onClick={toggleCollapsed} title="Collapse sidebar"
              className="ml-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <ChevronsLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable nav + scan list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-0.5 px-3 py-1">

              {/* Home */}
              <Link to={user ? "/dashboard" : "/signup"}
                className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isDashboard ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-accent hover:text-foreground")}>
                <Home className="h-4 w-4 shrink-0" />
                Home
              </Link>

              {/* Dive — with expandable scan history */}
              <div>
                <div className={cn("flex items-center rounded-xl transition-colors",
                  isWorkspace ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-accent hover:text-foreground")}>
                  <Link to="/dive" className="flex flex-1 items-center gap-3 px-3 py-2.5 text-sm font-medium">
                    <ScanLine className="h-4 w-4 shrink-0" />
                    Dive
                  </Link>
                  <button
                    onClick={() => setDiveExpanded((v) => !v)}
                    className="pr-3 py-2.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", diveExpanded ? "rotate-0" : "-rotate-90")} />
                  </button>
                </div>

                {/* Dropdown content */}
                {diveExpanded && (
                  <div className="mt-0.5 ml-3 border-l border-border pl-2 pb-1">
                    {user ? (
                      <div className="relative max-h-52 overflow-y-auto">
                        <HistorySidebar />
                        <div className="pointer-events-none sticky bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
                      </div>
                    ) : (
                      <p className="px-1 py-2 text-[11px] text-muted-foreground/50">Your scans will appear here after your first dive.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Stream */}
              <Link to="/stream"
                className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  location.pathname.startsWith("/stream") ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-accent hover:text-foreground")}>
                <Waves className="h-4 w-4 shrink-0" />
                Stream
              </Link>

              {/* Go Deep CTA */}
              {user && plan !== "deep" && (
                <div className="pt-3">
                  <button
                    onClick={() => navigate("/pricing", { state: { backgroundLocation: location } })}
                    className="w-full rounded-xl bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Go Deep
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom controls */}
          <div className="shrink-0 space-y-0.5 px-3 pb-4">
            <button onClick={cycleColorMode}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground">
              {COLOR_MODE_ICONS[colorMode]}
              <span>{COLOR_MODE_LABELS[colorMode]}</span>
            </button>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground">
                    <UserCircle2 className="h-4 w-4 shrink-0" />
                    <span className="truncate">{displayName(user)}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-52 border border-border bg-card">
                  <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer gap-2">
                    <Settings className="h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/contact")} className="cursor-pointer gap-2">
                    <Mail className="h-4 w-4" /> Contact
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLogoutOpen(true)} className="cursor-pointer gap-2">
                    <LogOut className="h-4 w-4" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="space-y-1.5 pt-1">
                <button onClick={() => navigate("/signup")}
                  className="w-full rounded-xl bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                  Sign up
                </button>
                <button onClick={() => navigate("/login")}
                  className="w-full rounded-xl border border-border px-3 py-2 text-center text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground">
                  Log in
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </aside>

    <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Log out?</AlertDialogTitle>
          <AlertDialogDescription>You'll need to sign in again.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onLogout}>Log out</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Mobile bottom nav — visible only below md, replaces the sidebar */}
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl">
      <div
        className="flex items-center justify-around px-2"
        style={{ paddingTop: 8, paddingBottom: "max(env(safe-area-inset-bottom, 0px), 10px)" }}
      >
        <Link
          to="/dashboard"
          className={cn(
            "flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl transition-colors",
            isDashboard ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Home</span>
        </Link>
        <Link
          to="/dive"
          className={cn(
            "flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl transition-colors",
            isWorkspace ? "text-primary" : "text-muted-foreground"
          )}
        >
          <ScanLine className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Dive</span>
        </Link>
        <Link
          to="/stream"
          className={cn(
            "flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl transition-colors",
            location.pathname.startsWith("/stream") ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Waves className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Stream</span>
        </Link>
        {user ? (
          <Link
            to="/settings"
            className={cn(
              "flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl transition-colors",
              location.pathname.startsWith("/settings") ? "text-primary" : "text-muted-foreground"
            )}
          >
            <UserCircle2 className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Profile</span>
          </Link>
        ) : (
          <Link
            to="/signup"
            className="flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl text-muted-foreground transition-colors"
          >
            <UserCircle2 className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Sign up</span>
          </Link>
        )}
      </div>
    </nav>
    </>
  );
}
