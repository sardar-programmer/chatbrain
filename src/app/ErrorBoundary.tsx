import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Home, AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Local console logging for single-user debugging (no external telemetry)
    console.error('Chat-Brain Boundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background text-text-primary text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-card bg-status-error/10 text-status-error mb-4">
            <AlertCircle className="h-7 w-7 stroke-[1.75]" />
          </div>

          <h1 className="font-serif text-2xl sm:text-3xl font-semibold mb-2 text-text-primary">
            Something unexpected occurred
          </h1>
          <p className="text-sm text-text-secondary max-w-md mb-6 leading-relaxed">
            Chat-Brain caught an application error. Your saved data and chat history remain safe in
            local storage.
          </p>

          {this.state.error && (
            <div className="max-w-md w-full rounded-md border border-border bg-surface p-3 font-mono text-xs text-status-error overflow-x-auto text-left mb-6">
              {this.state.error.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-xs font-medium text-text-primary hover:bg-sidebar-accent transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload app
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              Return home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
