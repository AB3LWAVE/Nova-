import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; path?: string };
        if (parsed.error) {
          friendly = `${parsed.error}${parsed.path ? ` (Path: ${parsed.path})` : ''}`;
        }
      } catch {
        // Not JSON
      }

      return (
        <div className="min-h-screen bg-[#070B14] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-2xl border border-rose-500/40 bg-[#0D1322] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-rose-400 shrink-0" />
              <h1 className="text-lg font-semibold">NOVA Workspace Recovery</h1>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reload Workspace</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
