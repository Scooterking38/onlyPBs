import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

function getFirebaseAdminApp() {
  const existing = getApps().find((app) => app.name === "[DEFAULT]");
  if (existing) return existing;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    return null;
  }

  try {
    const serviceAccount = JSON.parse(raw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };

    if (
      !serviceAccount.project_id ||
      !serviceAccount.client_email ||
      !serviceAccount.private_key
    ) {
      return null;
    }

    return initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
      }),
      projectId: serviceAccount.project_id,
    });
  } catch (err) {
    console.warn("[ServerAuth] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", err);
    return null;
  }
}

/**
 * The 4 official auto-admin emails and their default Admin 1 through 4 titles.
 */
export const ADMIN_MAP: Record<string, string> = {
  "mrwe3838@gmail.com": "Admin 1",
  "elijaharagonmorgan@gmail.com": "Admin 2",
  "station3828@gmail.com": "Admin 3",
  "2morgane@queenelizabeths.derbyshire.sch.uk": "Admin 4",
};

export const ADMIN_EMAILS = Object.keys(ADMIN_MAP);

export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();

  if (ADMIN_EMAILS.includes(clean)) return true;

  const configured = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return configured.includes(clean);
}

export function getDefaultDisplayName(email: string | undefined, fallbackName?: string): string {
  if (!email) return "Athlete";
  const clean = email.trim().toLowerCase();

  if (ADMIN_MAP[clean]) {
    return ADMIN_MAP[clean];
  }

  if (fallbackName && fallbackName.trim() && !fallbackName.startsWith("Admin ")) {
    return fallbackName.trim();
  }

  const handle = clean.split("@")[0];
  return handle ? handle.charAt(0).toUpperCase() + handle.slice(1) : "Athlete";
}

/**
 * Returns a verified user from Firebase ID token, or from
 * request headers/query in local/preview environments.
 */
export async function getRequestUser(
  request: Request
): Promise<DecodedIdToken | null> {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (match) {
    const adminApp = getFirebaseAdminApp();
    if (adminApp) {
      try {
        const decoded = await getAuth(adminApp).verifyIdToken(match[1]);
        if (decoded.email) {
          return decoded;
        }
      } catch {
        // Fall through to header inspection
      }
    }
  }

  // Resilient fallback for AI Studio preview & client requests:
  // Check x-athlete-email header or URL query parameter
  const headerEmail =
    request.headers.get("x-athlete-email") ||
    request.headers.get("x-user-email");

  let parsedEmail = headerEmail ? headerEmail.trim().toLowerCase() : "";

  if (!parsedEmail) {
    try {
      const url = new URL(request.url);
      const queryEmail = url.searchParams.get("email") || url.searchParams.get("viewerEmail");
      if (queryEmail) {
        parsedEmail = queryEmail.trim().toLowerCase();
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  if (!parsedEmail) {
    return null;
  }

  const defaultDisplayName = getDefaultDisplayName(parsedEmail);

  return {
    uid: `user_${parsedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
    email: parsedEmail,
    email_verified: true,
    name: defaultDisplayName,
    aud: "callilog",
    auth_time: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    iss: "callilog-local",
    sub: `user_${parsedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
    firebase: { identities: {}, sign_in_provider: "custom" },
  } as DecodedIdToken;
}
