import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Upload } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { pendingFileStore } from "@/lib/pendingFile";
import { supabase } from "@/integrations/supabase/client";
import AppNav from "@/components/AppNav";
import AppSidebar from "@/components/AppSidebar";
import ProtectedRoute from "@/components/ProtectedRoute";
import WhaleAssistant from "@/components/WhaleAssistant";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Home from "./pages/Landing";
import { DashboardRoute } from "./pages/Dashboard";
import DiagnosticLab from "./pages/DiagnosticLab";
import BlindSpotReport from "./pages/BlindSpotReport";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Interact from "./pages/Interact";
import Settings from "./pages/Settings";
import Stream from "./pages/Stream";

const queryClient = new QueryClient();

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];

// Routes that use the sidebar layout (authenticated app shell)
const SIDEBAR_ROUTES = ["/dashboard", "/dive", "/report", "/settings", "/contact", "/stream"];

function GlobalDropZone() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dragging, setDragging] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;
    const onEnter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); dragCounterRef.current++; setDragging(true); };
    const onLeave = () => { dragCounterRef.current--; if (dragCounterRef.current === 0) setDragging(false); };
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setDragging(false);
      if (location.pathname === "/dive") return;
      const file = e.dataTransfer?.files[0];
      if (!file || !ALLOWED_IMAGE_TYPES.includes(file.type)) return;
      pendingFileStore.set(file);
      navigate("/dive");
    };
    document.addEventListener("dragenter", onEnter);
    document.addEventListener("dragleave", onLeave);
    document.addEventListener("dragover", onOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragenter", onEnter);
      document.removeEventListener("dragleave", onLeave);
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [navigate]);

  if (!dragging || location.pathname === "/dive") return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/90 backdrop-blur-sm pointer-events-none">
      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-primary bg-card/80 px-16 py-12 text-center shadow-2xl">
        <Upload className="h-14 w-14 text-primary" />
        <p className="text-2xl font-bold text-foreground">Drop it like it's hot</p>
      </div>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const backgroundLocation = (location.state as any)?.backgroundLocation;

  return (
    <>
      {/* Render the background page when pricing is open as an overlay */}
      <Routes location={backgroundLocation ?? location} key={(backgroundLocation ?? location).pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dive"
          element={
            <ErrorBoundary>
              <DiagnosticLab />
            </ErrorBoundary>
          }
        />
        <Route
          path="/report"
          element={
            <ErrorBoundary>
              <BlindSpotReport />
            </ErrorBoundary>
          }
        />
        <Route path="/stream" element={<Stream />} />
        <Route path="/interact" element={<Interact />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {/* Pricing overlay rendered on top of the background page */}
      {backgroundLocation && (
        <Routes>
          <Route path="/pricing" element={<Pricing />} />
        </Routes>
      )}
    </>
  );
}

function HashCleaner() {
  useEffect(() => {
    if (window.location.hash === "#" || window.location.hash === "#/") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);
  return null;
}

// Auth-aware layout: sidebar for app routes, floating top nav for public pages
function AppLayout() {
  const location = useLocation();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const backgroundLocation = (location.state as any)?.backgroundLocation;
  const effectivePath = (backgroundLocation ?? location).pathname;
  const showSidebar = SIDEBAR_ROUTES.some((r) => effectivePath.startsWith(r));
  const showNav = !showSidebar && effectivePath === "/";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("main_sidebar_collapsed") === "true"
  );

  useEffect(() => {
    const handler = (e: Event) => setSidebarCollapsed((e as CustomEvent).detail.collapsed);
    window.addEventListener("main-sidebar-toggle", handler);
    return () => window.removeEventListener("main-sidebar-toggle", handler);
  }, []);

  return (
    <>
      {showSidebar ? (
        <AppSidebar user={user ?? null} onUserUpdate={setUser} />
      ) : showNav ? (
        <AppNav user={user ?? null} />
      ) : null}
      <div className={showSidebar ? (sidebarCollapsed ? "pb-20 md:pb-0 md:ml-14 transition-[margin] duration-200" : "pb-20 md:pb-0 md:ml-64 transition-[margin] duration-200") : ""}>
        <AnimatedRoutes />
      </div>
      <WhaleAssistant />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <HashCleaner />
        <GlobalDropZone />
        <div className="liquid-glass-bg" aria-hidden />
        <AppLayout />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
