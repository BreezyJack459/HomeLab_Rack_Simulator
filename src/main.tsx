import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

interface ErrorBoundaryState {
  error: Error | null;
}

class RootErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Keep React in charge of #root. Mutating it here can corrupt React's
    // commit phase and cause DOM removeChild errors during unmount.
    // eslint-disable-next-line no-console
    console.error(error, errorInfo);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-white p-6 text-rose-800 dark:bg-slate-950 dark:text-rose-200" style={{ backgroundColor: 'var(--theme-bg-primary)', color: '#be123c' }}>
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-4" style={{ backgroundColor: 'rgba(255, 228, 230, 0.6)', borderColor: 'rgba(244, 63, 94, 0.4)' }}>
          <div className="text-sm font-semibold text-rose-100" style={{ color: '#be123c' }}>Application error</div>
          <pre className="mt-3 max-h-[70vh] overflow-auto whitespace-pre-wrap text-xs leading-5 text-rose-200">
            {this.state.error.stack || this.state.error.message}
          </pre>
        </div>
      </div>
    );
  }
}

function showRuntimeError(message: string) {
  let overlay = document.getElementById('runtime-error-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'runtime-error-overlay';
    overlay.style.cssText = [
      'position:fixed',
      'left:16px',
      'right:16px',
      'bottom:16px',
      'z-index:9999',
      'max-height:40vh',
      'overflow:auto',
      'border:1px solid rgba(244,63,94,.55)',
      'border-radius:8px',
      'background:rgba(30,41,59,.96)',
      'color:#fecdd3',
      'padding:12px',
      'font:12px ui-monospace, SFMono-Regular, Menlo, monospace',
      'white-space:pre-wrap'
    ].join(';');
    document.body.appendChild(overlay);
  }
  overlay.textContent = message;
}

window.addEventListener('error', (event) => {
  showRuntimeError(event.error?.stack || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  showRuntimeError(`Unhandled Promise Rejection:\n${event.reason?.stack || event.reason}`);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
