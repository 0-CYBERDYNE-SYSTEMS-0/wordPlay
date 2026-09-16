import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort boundary: a crash inside any component shows a recoverable
 * card instead of unmounting the entire app into a blank page.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed inside error boundary:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-[var(--wp-paper)] p-6 text-[var(--wp-ink)] dark:bg-stone-950 dark:text-stone-100">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              A rendering error occurred. Reloading usually fixes it — your
              documents are saved on the server.
            </p>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-stone-100 p-2 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-400">
              {this.state.error.message}
            </pre>
            <Button onClick={() => window.location.reload()} className="w-full">
              Reload wordPlay
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
