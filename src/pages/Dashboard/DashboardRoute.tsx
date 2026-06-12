import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthUser } from "@/api/auth";
import Dashboard from "./Dashboard";

export function DashboardRoute() {
  const user = useAuthUser();

  if (user === undefined) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  return <Dashboard user={user} />;
}
