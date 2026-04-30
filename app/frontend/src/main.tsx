import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { loadRuntimeConfig } from './lib/config.ts';
import { registerServiceWorker } from './lib/push-notifications.ts';

// Load runtime configuration before rendering the app
async function initializeApp() {
  // Prerendered blog pages are served as pure static HTML for SEO.
  // Intentionally skip React mounting so the crawler-facing markup stays
  // lightweight and self-contained — no client-side hydration needed.
  if (
    document
      .querySelector('meta[name="prerender-static-page"]')
      ?.getAttribute('content') === 'blog'
  ) {
    return;
  }

  try {
    await loadRuntimeConfig();
    console.log('Runtime configuration loaded successfully');
  } catch (error) {
    console.warn(
      'Failed to load runtime configuration, using defaults:',
      error
    );
  }

  // Best-effort service worker registration for Web Push. Failures are
  // swallowed and never block app rendering.
  void registerServiceWorker();

  // Allow the service worker to request in-app navigation (e.g. on
  // notificationclick for browsers where client.navigate is not available).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg && msg.type === 'navigate' && typeof msg.path === 'string') {
        try {
          window.history.pushState({}, '', msg.path);
          window.dispatchEvent(new PopStateEvent('popstate'));
        } catch {
          window.location.href = msg.path;
        }
      }
    });
  }

  // Render the app
  createRoot(document.getElementById('root')!).render(<App />);
}

// Initialize the app
initializeApp();
