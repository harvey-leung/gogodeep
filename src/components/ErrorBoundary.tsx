import { Component, ErrorInfo, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode; fallback?: ReactNode };

type State = { hasError: boolean; message: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center">
            <p className="text-sm font-semibold text-foreground">Something went wrong</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Reload the page or try again.
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="border-border" onClick={() => { this.setState({ hasError: false, message: "" }); window.location.reload(); }}>
                Reload
              </Button>
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link to="/dashboard">Back to Home</Link>
              </Button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
