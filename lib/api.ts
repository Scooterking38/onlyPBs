import { auth } from "@/lib/firebase";

declare const __CALLILOG_API_BASE_URL__: string | undefined;

/**
 * Web uses same-origin API routes. The static Capacitor build can use
 * VITE_API_BASE_URL to point at the deployed HTTPS backend.
 */
export function apiUrl(path: string): string {
  const base =
    typeof __CALLILOG_API_BASE_URL__ === "string"
      ? __CALLILOG_API_BASE_URL__.replace(/\/+$/, "")
      : "";

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${base}${normalizedPath}`;
}

/**
 * Attach a Firebase ID token to API requests when a user is signed in.
 * The backend must verify this token before trusting the user's identity.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const currentUser = auth.currentUser;

  if (currentUser) {
    headers.set("Authorization", `Bearer ${await currentUser.getIdToken()}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
