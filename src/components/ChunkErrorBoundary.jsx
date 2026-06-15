import React from 'react';

/**
 * ChunkErrorBoundary — recovers from `Loading chunk N failed` errors that
 * happen when React.lazy() can't fetch a code-split chunk. This typically
 * occurs when:
 *   1. The user has the SPA loaded, we deploy, the old chunk URL stops
 *      existing, the user navigates to a new route. (Vercel sets short
 *      cache headers but the index.html the user already has references
 *      the old chunk filenames.)
 *   2. A transient network blip during chunk download.
 *
 * Catching here lets us:
 *   - Show a brand-consistent, calm error UI instead of a white screen.
 *   - Offer the user a Reload button that forces a fresh index.html fetch
 *     (which contains the new chunk hash filenames).
 *
 * Scope: wraps the <Suspense> inside App.jsx so it catches lazy-load
 * failures across the whole route tree. NOT a general-purpose error
 * boundary — Sentry handles uncaught render errors elsewhere.
 *
 * Owner: Bundle Z, 2026-06-15.
 */
class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorKind: null };
  }

  static getDerivedStateFromError(error) {
    const msg = String(error?.message || error || '');
    // Chrome: "Loading chunk N failed"
    // Vite: "Failed to fetch dynamically imported module"
    // Safari: "importing a module script failed"
    const isChunkError =
      /Loading chunk \d+ failed/.test(msg) ||
      /Failed to fetch dynamically imported module/.test(msg) ||
      /importing a module script failed/i.test(msg) ||
      /error loading dynamically imported module/i.test(msg) ||
      /ChunkLoadError/.test(msg);
    return { hasError: true, errorKind: isChunkError ? 'chunk' : 'other' };
  }

  componentDidCatch(error, info) {
    // Best-effort send to Sentry if available (Sentry init wires window.Sentry).
    try {
      if (typeof window !== 'undefined' && window.Sentry && typeof window.Sentry.captureException === 'function') {
        window.Sentry.captureException(error, { extra: { componentStack: info?.componentStack, scope: 'ChunkErrorBoundary' } });
      }
    } catch (_) { /* swallow — boundaries must never throw */ }
  }

  handleReload = () => {
    // Force a full reload (not history-based) so the browser re-fetches index.html
    // and discovers the new chunk hashes. Bypass cache to be safe.
    try {
      window.location.reload();
    } catch (_) {
      window.location.href = window.location.pathname;
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isChunk = this.state.errorKind === 'chunk';
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E0D9CC] rounded-2xl shadow-sm p-8 text-center">
          <h1 className="text-2xl font-semibold text-brand-ink mb-3">
            {isChunk ? 'A new version is ready' : 'Something went wrong'}
          </h1>
          <p className="text-brand-muted leading-relaxed mb-6">
            {isChunk
              ? "We just shipped an update and the page you were viewing has a fresher version. Reload to get it."
              : "We hit an unexpected error loading this part of Marryzen. Reloading the page will usually fix it."}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center justify-center px-6 py-3 bg-brand-gold text-brand-ink font-semibold rounded-xl hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-brand-gold focus:ring-offset-2"
          >
            Reload Marryzen
          </button>
        </div>
      </div>
    );
  }
}

export default ChunkErrorBoundary;
