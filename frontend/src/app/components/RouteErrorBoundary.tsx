import { Component } from "react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  message: string;
  stack: string;
}

/** Catches render crashes per route and shows the failure instead of a
 *  blank page — with the exact error text so it can be reported fixed. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { message: "", stack: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack ?? "") : "",
    };
  }

  render() {
    if (!this.state.message) return this.props.children;
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border border-critical/50 bg-critical/10 p-6">
        <p className="label-caps text-critical">Something failed to render</p>
        <p role="alert" className="telemetry text-ink">
          {this.state.message}
        </p>
        {this.state.stack && (
          <details className="w-full">
            <summary className="cursor-pointer text-xs text-muted">Technical details</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-abyss p-4 font-mono text-[0.6875rem] text-faint">
              {this.state.stack.split("\n").slice(0, 8).join("\n")}
            </pre>
          </details>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="label-caps rounded-md border border-hairline px-3 py-2 text-muted transition-colors hover:border-accent hover:text-ink"
          >
            Retry
          </button>
          <a
            href="/dashboard/"
            className="label-caps rounded-md border border-hairline px-3 py-2 text-muted transition-colors hover:border-accent hover:text-ink"
          >
            Back to overview
          </a>
        </div>
      </div>
    );
  }
}
