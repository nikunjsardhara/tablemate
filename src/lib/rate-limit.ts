import { queryOne } from "./db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

const ok = (remaining: number): RateLimitResult => ({
  allowed: remaining > 0,
  remaining,
});

/**
 * All limits are counted in SQL rather than in memory: the in-memory map in
 * the first draft silently reset per Cloud Run instance and per deploy.
 * The queries below stay correct across instances, restarts and regions.
 */

/** PRD §8: max 3 open listings per person. */
export async function checkListingLimit(userId: string): Promise<RateLimitResult> {
  const row = await queryOne<{ open: string }>(
    `SELECT count(*) AS open FROM listings WHERE asker_id = $1 AND status = 'open' AND expires_at > now()`,
    [userId]
  );
  return ok(Math.max(0, 3 - Number(row?.open ?? 0)));
}

/** PRD §8: max 10 responses per person per day. */
export async function checkResponseLimit(userId: string): Promise<RateLimitResult> {
  const row = await queryOne<{ today: string }>(
    `SELECT count(*) AS today FROM responses WHERE answerer_id = $1 AND created_at >= date_trunc('day', now())`,
    [userId]
  );
  return ok(Math.max(0, 10 - Number(row?.today ?? 0)));
}

/** PRD §8: max 5 invitations per person per day. */
export async function checkInvitationLimit(userId: string): Promise<RateLimitResult> {
  const row = await queryOne<{ today: string }>(
    `SELECT count(*) AS today FROM invitations WHERE from_id = $1 AND created_at >= date_trunc('day', now())`,
    [userId]
  );
  return ok(Math.max(0, 5 - Number(row?.today ?? 0)));
}
