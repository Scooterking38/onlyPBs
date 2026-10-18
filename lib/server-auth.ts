import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

function getFirebaseAdminApp() {
  const existing = getApps().find((app) => app.name === "[DEFAULT]");
  if (existing) return existing;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error(
      "Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable"
    );
  }

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
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing required service-account fields"
    );
  }

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
    }),
    projectId: serviceAccount.project_id,
  });
}

/**
 * Returns a verified, email-verified Firebase user or null if the
 * request has no valid bearer token.
 *
 * Missing server configuration is deliberately allowed to throw so
 * configuration failures cannot silently masquerade as valid sessions.
 */
export async function getRequestUser(
  request: Request
): Promise<DecodedIdToken | null> {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) return null;

  let decoded: DecodedIdToken;

  try {
    decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(match[1]);
  } catch {
    return null;
  }

  if (!decoded.email || decoded.email_verified !== true) return null;

  return decoded;
}

export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;

  const allowlist = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(email.trim().toLowerCase());
}
