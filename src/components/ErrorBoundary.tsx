import React from "react";

type Props = {
  children: React.ReactNode;
  fallbackTitle?: string;
};

type State = {
  error: unknown;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Keep as console.error so Lovable can capture it in logs
    console.error("ErrorBoundary caught error:", error, info);
  }

  render() {
    if (this.state.error) {
      const title = this.props.fallbackTitle ?? "Something went wrong";
      return (
        <main className="min-h-[60vh] flex items-center justify-center p-6">
          <section className="max-w-lg w-full rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The page crashed while rendering. Try refreshing; if it persists, let me know and I’ll fix the underlying
              error.
            </p>
            <pre className="mt-4 max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {String((this.state.error as any)?.message ?? this.state.error)}
            </pre>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
