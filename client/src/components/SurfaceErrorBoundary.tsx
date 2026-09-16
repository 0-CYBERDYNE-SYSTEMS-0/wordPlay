import { Component, type ErrorInfo, type ReactNode } from "react";

interface SurfaceErrorBoundaryProps {
  children: ReactNode;
  /** Name shown in the fallback card and console, e.g. "preview", "sidebar". */
  surface: string;
}

interface SurfaceErrorBoundaryState {
  error: Error | null;
}

// Surface-level crash isolation: a throw inside one panel (markdown preview,
// sidebar, an AI surface) must degrade to a local error card instead of taking
// the whole app to the root crash screen. Remounts cleanly when the surface
// identity changes.
export class SurfaceErrorBoundary extends Component<SurfaceErrorBoundaryProps, SurfaceErrorBoundaryState> {
  state: SurfaceErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SurfaceErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.surface}] surface crashed:`, error, info.componentStack);
  }

  componentDidUpdate(prevProps: SurfaceErrorBoundaryProps) {
    if (prevProps.surface !== this.props.surface && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-4 p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/40 text-sm">
          <div className="font-medium text-red-700 dark:text-red-300 mb-1">
            The {this.props.surface} hit an error and was stopped.
          </div>
          <div className="text-red-600/80 dark:text-red-400/80">
            The rest of the app is unaffected. Reload the document to retry.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
