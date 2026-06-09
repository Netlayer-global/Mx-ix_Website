import React from 'react';

interface State {
  hasError: boolean;
}

/**
 * App-wide error boundary — shows a branded fallback instead of a white screen
 * if a render error occurs.
 */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('App error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-ink text-white flex items-center justify-center px-6">
          <div className="max-w-md text-center">
            <div className="font-mono text-label-sm tracking-mono uppercase text-[#F20732] mb-4">// Something went wrong</div>
            <h1 className="text-3xl font-black tracking-tighter mb-4">Unexpected Error</h1>
            <p className="text-gray-400 mb-8 text-sm leading-relaxed">
              The page hit an unexpected error. Reloading usually fixes it.
            </p>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="bg-[#F20732] text-white px-7 py-3 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
