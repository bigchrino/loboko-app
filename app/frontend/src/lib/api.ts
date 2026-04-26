/**
 * Shared Atoms Cloud SDK client (legacy import path).
 * Re-exports the singleton from `atoms-client.ts` so every caller uses
 * the same configured instance (with `VITE_ATOMS_API_URL`).
 */
export { client, ATOMS_BASE_URL } from './atoms-client';
export { default } from './atoms-client';