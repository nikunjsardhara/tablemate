import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { apiError, readJsonBody, requireProfileId } from "@/lib/api-helpers";
import { readSessionId } from "@/lib/session";
import { checkInvitationLimit } from "@/lib/rate-limit";
import type { Invitation } from "@/lib/types";

/**
 * Inbox for the current session. Includes received (peer = asker, contact only
 * when they chose to share it) and sent (peer = answerer, contact never present
 * because answerers do not share theirs).
 */
export async function GET() {
  const sessionId = await readSessionId();
  if (!sessionId) {
    return NextResponse.json({ received: [], sent: [] });
  }

  const received = await query<Invitation>(
    `SELECT i.id, i.response_id, i.status, i.share_contact, i.message,
            i.meet_at, i.meet_spot, i.created_at,
            l.id AS listing_id, l.title AS listing_title,
            p.id AS peer_id, p.nickname, p.bio, p.interests,
            CASE WHEN i.share_contact THEN p.contact ELSE NULL END AS peer_contact
     FROM invitations i
     JOIN listings l ON l.id = (
       SELECT listing_id FROM responses r WHERE r.id = i.response_id
     )
     JOIN profiles p ON p.id = i.from_id
     WHERE i.to_id = $1
     ORDER BY i.created_at DESC`,
    [sessionId]
  );

  const sent = await query<Invitation>(
    `SELECT i.id, i.response_id, i.status, i.share_contact, i.message,
            i.meet_at, i.meet_spot, i.created_at,
            l.id AS listing_id, l.title AS listing_title,
            p.id AS peer_id, p.nickname, p.bio, p.interests
     FROM invitations i
     JOIN listings l ON l.id = (
       SELECT listing_id FROM responses r WHERE r.id = i.response_id
     )
     JOIN profiles p ON p.id = i.to_id
     WHERE i.from_id = $1
     ORDER BY i.created_at DESC`,
    [sessionId]
  );

  const mapReceived = (row: Record<string, unknown>): Invitation => ({
    id: row.id as number,
    response_id: row.response_id as number,
    listing_id: row.listing_id as number,
    listing_title: row.listing_title as string,
    direction: "received",
    share_contact: Boolean(row.share_contact),
    message: (row.message as string) ?? null,
    meet_at: (row.meet_at as string) ?? null,
    meet_spot: (row.meet_spot as string) ?? null,
    status: row.status as Invitation["status"],
    created_at: row.created_at as string,
    peer: {
      id: row.peer_id as string,
      nickname: row.nickname as string,
      bio: (row.bio as string) ?? null,
      interests: (row.interests as string[]) ?? [],
      contact: (row.peer_contact as string) ?? null,
    },
  });

  const mapSent = (row: Record<string, unknown>): Invitation => ({
    id: row.id as number,
    response_id: row.response_id as number,
    listing_id: row.listing_id as number,
    listing_title: row.listing_title as string,
    direction: "sent",
    share_contact: Boolean(row.share_contact),
    message: (row.message as string) ?? null,
    meet_at: (row.meet_at as string) ?? null,
    meet_spot: (row.meet_spot as string) ?? null,
    status: row.status as Invitation["status"],
    created_at: row.created_at as string,
    peer: {
      id: row.peer_id as string,
      nickname: row.nickname as string,
      bio: (row.bio as string) ?? null,
      interests: (row.interests as string[]) ?? [],
    },
  });

  return NextResponse.json({
    received: received.map((row) => mapReceived(row as unknown as Record<string, unknown>)),
    sent: sent.map((row) => mapSent(row as unknown as Record<string, unknown>)),
  });
}

const invitationSchema = z.object({
  responseId: z.number().int().positive(),
  shareContact: z.boolean().default(false),
  message: z.string().trim().max(200).optional().default(""),
  meetAt: z.string().optional(), // ISO timestamp, optional
  meetSpot: z.string().trim().max(50).optional().default(""),
});

export async function POST(request: NextRequest) {
  const sessionId = await requireProfileId();
  if (!sessionId) {
    return apiError(403, "Create a profile first");
  }

  const parsed = invitationSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return apiError(400, parsed.error.issues[0]?.message ?? "Invalid invitation");
  }
  const { responseId, shareContact, message, meetAt, meetSpot } = parsed.data;

  if (meetAt) {
    const meetDate = new Date(meetAt);
    if (Number.isNaN(meetDate.getTime())) {
      return apiError(400, "Invalid meeting time");
    }
    if (meetDate <= new Date()) {
      return apiError(400, "Meeting time must be in the future");
    }
  }

  const limit = await checkInvitationLimit(sessionId);
  if (!limit.allowed) {
    return apiError(429, "Daily invitation limit reached (5 per day)");
  }

  // Only the asker of the listing may invite on one of its responses.
  const response = await queryOne<{ listing_id: number; asker_id: string }>(
    `SELECT r.listing_id, l.asker_id
     FROM responses r
     JOIN listings l ON l.id = r.listing_id
     WHERE r.id = $1`,
    [responseId]
  );

  if (!response) {
    return apiError(404, "Response not found");
  }
  if (response.asker_id !== sessionId) {
    return apiError(403, "You can only invite on your own listing");
  }

  // PRD §8: a declined invitation cannot be re-sent for the same response.
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM invitations WHERE response_id = $1`,
    [responseId]
  );
  if (existing) {
    return apiError(409, "You have already contacted this person");
  }

  const rows = await query<{ id: number }>(
    `INSERT INTO invitations (response_id, from_id, to_id, share_contact, message, meet_at, meet_spot, status)
     SELECT $1, $2, r.answerer_id, $3, $4, $5, $6, 'pending'
     FROM responses r WHERE r.id = $1
     RETURNING id`,
    [
      responseId,
      sessionId,
      shareContact,
      message || null,
      meetAt ? new Date(meetAt).toISOString() : null,
      meetSpot || null,
    ]
  );

  if (!rows.length) {
    return apiError(404, "Response not found");
  }

  return NextResponse.json({ id: rows[0].id }, { status: 201 });
}
