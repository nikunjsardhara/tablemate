import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db";
import { apiError, readJsonBody, requireProfileId } from "@/lib/api-helpers";
import { readSessionId } from "@/lib/session";
import { screenContent } from "@/lib/safety";
import { checkListingLimit } from "@/lib/rate-limit";
import type { Listing } from "@/lib/types";

/** Open listings for the browse page. Expectations are never selected here. */
export async function GET() {
  const sessionId = await readSessionId();

  const listings = await query<Listing>(
    `SELECT l.id, l.title, l.status, l.created_at, l.expires_at,
            p.nickname AS asker_nickname,
            COALESCE(l.asker_id = $1::uuid, false) AS is_mine,
            (SELECT count(*)::int FROM responses r WHERE r.listing_id = l.id) AS response_count,
            EXISTS(
              SELECT 1 FROM responses r
              WHERE r.listing_id = l.id AND r.answerer_id = $1::uuid
            ) AS answered_by_me,
            COALESCE(
              (SELECT json_agg(q) FROM (
                 SELECT q.id, q.position, q.body, q.weight
                 FROM questions q
                 WHERE q.listing_id = l.id
                 ORDER BY q.position
               ) q),
              '[]'::json
            ) AS questions
     FROM listings l
     JOIN profiles p ON p.id = l.asker_id
     WHERE l.status = 'open' AND l.expires_at > now()
     ORDER BY l.created_at DESC`,
    [sessionId]
  );

  return NextResponse.json({ listings });
}

const questionSchema = z.object({
  body: z.string().trim().min(1).max(250),
  expectation: z.string().trim().min(1).max(300),
  weight: z.coerce.number().int().min(1).max(3).default(1),
});

const listingSchema = z.object({
  title: z.string().trim().min(1).max(120),
  questions: z.array(questionSchema).min(1).max(5),
});

export async function POST(request: NextRequest) {
  const sessionId = await requireProfileId();
  if (!sessionId) {
    return apiError(403, "Create a profile first");
  }

  const parsed = listingSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return apiError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid listing"
    );
  }

  const { title, questions } = parsed.data;

  const limit = await checkListingLimit(sessionId);
  if (!limit.allowed) {
    return apiError(429, "Maximum 3 open listings per person");
  }

  // One screening call covers the title, every question and every expectation.
  const screeningText = [
    title,
    ...questions.map((q) => `${q.body}\n${q.expectation}`),
  ].join("\n---\n");
  const safety = await screenContent(screeningText);
  if (!safety.safe) {
    return apiError(400, `Not allowed on Tablemate: ${safety.reason}`);
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const listingId = await withTransaction(async (client) => {
    const listingRows = await query<{ id: number }>(
      `INSERT INTO listings (asker_id, title, expires_at)
       VALUES ($1, $2, $3) RETURNING id`,
      [sessionId, title, expiresAt],
      client
    );
    const id = listingRows[0].id;

    for (const [index, q] of questions.entries()) {
      await query(
        `INSERT INTO questions (listing_id, position, body, expectation, weight)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, index + 1, q.body, q.expectation, q.weight],
        client
      );
    }

    return id;
  });

  return NextResponse.json({ id: listingId }, { status: 201 });
}
