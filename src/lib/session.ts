import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

const COOKIE_NAME = "tablemate_session";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

/**
 * Reads the session without ever creating one.
 *
 * Read paths must not mint a session: two parallel GETs from a first-time
 * visitor would each generate a different uuid and the later response would
 * silently overwrite the earlier cookie, splitting the user into two profiles.
 * Session creation belongs to the handful of writes that need an identity.
 */
export async function readSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

/**
 * Returns the current session id, creating and setting the cookie if absent.
 * Only call this from a Route Handler or Server Action (where cookie writes are
 * allowed), never from a Server Component render.
 */
export async function ensureSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME);

  if (existing?.value) {
    return existing.value;
  }

  const id = randomUUID();
  cookieStore.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  return id;
}
