import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { apiError } from "@/lib/api-helpers";
import { readSessionId } from "@/lib/session";
import type { Answer, ListingDetail, Question, RankedResponse } from "@/lib/types";

/**
 * Single detail endpoint with two shapes, decided by the session:
 *  - asker: questions WITH expectations + ranked responses (scores, rationales)
 *  - everyone else: questions WITHOUT expectations, no response payloads
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return apiError(400, "Invalid listing id");
  }

  const sessionId = await readSessionId();

  const listing = await queryOne<{
    id: number;
    asker_id: string;
    asker_nickname: string;
    title: string;
    status: "open" | "closed";
    expires_at: string;
    created_at: string;
  }>(
    `SELECT l.id, l.asker_id, l.title, l.status, l.expires_at, l.created_at,
            p.nickname AS asker_nickname
     FROM listings l
     JOIN profiles p ON p.id = l.asker_id
     WHERE l.id = $1`,
    [listingId]
  );

  if (!listing) {
    return apiError(404, "Listing not found");
  }

  const isMine = Boolean(sessionId) && sessionId === listing.asker_id;

  const questions = isMine
    ? await query<Question>(
        `SELECT id, listing_id, position, body, expectation, weight
         FROM questions WHERE listing_id = $1 ORDER BY position`,
        [listingId]
      )
    : (
        // Strips the expectation column at the SQL level — it must never be
        // serializable from this endpoint when the viewer is not the asker.
        await query<Question>(
          `SELECT id, listing_id, position, body, weight
           FROM questions WHERE listing_id = $1 ORDER BY position`,
          [listingId]
        )
      );

  const detail: ListingDetail = {
    id: listing.id,
    title: listing.title,
    status: listing.status,
    expires_at: listing.expires_at,
    created_at: listing.created_at,
    asker_nickname: listing.asker_nickname,
    is_mine: isMine,
    questions,
  };

  if (isMine) {
    const responses = await query<{
      id: number;
      match_score: number | null;
      created_at: string;
      answerer_id: string;
      nickname: string;
      bio: string | null;
      interests: string[];
    }>(
      `SELECT r.id, r.match_score, r.created_at,
              p.id AS answerer_id, p.nickname, p.bio, p.interests
       FROM responses r
       JOIN profiles p ON p.id = r.answerer_id
       WHERE r.listing_id = $1 AND r.status = 'scored'
       ORDER BY r.match_score DESC NULLS LAST, r.created_at ASC`,
      [listingId]
    );

    const responseIds = responses.map((r) => r.id);
    const answers = responseIds.length
      ? await query<Answer & { response_id: number }>(
          `SELECT a.id, a.response_id, a.question_id, a.body, a.score, a.rationale
           FROM answers a
           WHERE a.response_id = ANY($1::int[])
           ORDER BY a.id`,
          [responseIds]
        )
      : [];

    const invitations = responseIds.length
      ? await query<{
          id: number;
          response_id: number;
          status: "pending" | "accepted" | "declined" | "countered";
          meet_at: string | null;
          meet_spot: string | null;
        }>(
          `SELECT id, response_id, status, meet_at, meet_spot
           FROM invitations WHERE response_id = ANY($1::int[])`,
          [responseIds]
        )
      : [];

    detail.responses = responses.map((response) => {
      const invitation = invitations.find(
        (inv) => inv.response_id === response.id
      );
      return {
        id: response.id,
        match_score: response.match_score,
        created_at: response.created_at,
        // Explicit columns only — contact never leaves the profiles table here.
        answerer: {
          id: response.answerer_id,
          nickname: response.nickname,
          bio: response.bio,
          interests: response.interests,
        },
        answers: answers
          .filter((answer) => answer.response_id === response.id)
          .map(({ id: answerId, response_id: _r, ...rest }) => ({ id: answerId, ...rest })),
        invitation: invitation ?? null,
      };
    });
  }

  return NextResponse.json({ listing: detail });
}
