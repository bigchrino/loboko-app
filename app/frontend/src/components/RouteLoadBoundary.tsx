import { Component, type ReactNode } from 'react';

/** Recover from a failed page chunk, including an outdated cached deployment. */
export default class RouteLoadBoundary extends Component<
  { children: ReactNode }, { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-[var(--loboko-bg)] text-[var(--loboko-text)]">
        <h1 className="text-xl font-bold">Impossible de charger cette page</h1>
        <p>Vérifiez votre connexion, puis réessayez.</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-[#2563eb] text-white px-5 py-3 font-semibold">Recharger la page</button>
      </main>
    );
  }
}
