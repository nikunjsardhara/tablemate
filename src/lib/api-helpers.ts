import { NextResponse } from "next/server";
import { queryOne } from "./db";
import { ensureSessionId } from "./session";

export function apiError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Resolves the session id and verifies a profile exists for it.
 * Returns null (caller sends 403) when no cookie was set or the profile was
 * wiped — both mean "this visitor has not completed onboarding yet".
 */
export async function requireProfileId(): Promise<string | null> {
  const sessionId = await ensureSessionId();
  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM profiles WHERE id = $1",
    [sessionId]
  );
  return profile ? sessionId : null;
}

/** Parses the request body, returning null (caller sends 400) on invalid JSON. */
export async function readJsonBody(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}
