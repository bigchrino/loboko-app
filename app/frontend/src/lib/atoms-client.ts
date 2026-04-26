import { createClient, type ClientConfig } from '@metagptx/web-sdk';

/**
 * Atoms Cloud SDK client.
 *
 * The backend base URL is resolved in this order:
 *   1. `VITE_ATOMS_API_URL` (preferred, set in Vercel / .env)
 *   2. `VITE_API_BASE_URL` (legacy fallback)
 *   3. Default SDK behavior (same-origin, works when deployed via Atoms Publish)
 */
const ATOMS_API_URL =
  (import.meta.env.VITE_ATOMS_API_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  '';

const config: ClientConfig = ATOMS_API_URL
  ? { baseURL: ATOMS_API_URL.replace(/\/+$/, ''), withCredentials: true }
  : {};

export const client = createClient(config);
export const ATOMS_BASE_URL = ATOMS_API_URL;
export default client;