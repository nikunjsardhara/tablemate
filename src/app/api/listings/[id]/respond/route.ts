import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne, withTransaction } from "@/lib/db";
import { apiError, readJsonBody, requireProfileId } from "@/lib/api-helpers";
import { screenContent } from "@/lib/safety";
import { scoreAnswers, computeMatchScore } from "@/lib/scoring";
import { checkResponseLimit } from "@/lib/rate-limit";
import type { ScoreItem } from "@/lib/scoring";

const respondSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        body: z.string().trim().min(1).max(500),
      })
    )
    .min(1)
    .max(5),
});

const pgUniqueViolation = "23505";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return apiError(400, "Invalid listing id");
  }

  const sessionId = await requireProfileId();
  if (!sessionId) {
    return apiError(403, "Create a profile first");
  }

  const parsed = respondSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return apiError(400, parsed.error.issues[0]?.message ?? "Invalid answers");
  }

  const listing = await queryOne<{
    asker_id: string;
    status: string;
    expires_at: string;
  }>(
    `SELECT asker_id, status, expires_at FROM listings WHERE id = $1`,
    [listingId]
  );

  if (!listing) {
    return apiError(404, "Listing not found");
  }
  if (listing.asker_id === sessionId) {
    return apiError(403, "You cannot answer your own listing");
  }
  if (listing.status !== "open" || new Date(listing.expires_at) <= new Date()) {
    return apiError(410, "This listing is no longer accepting answers");
  }

  const questions = await query<{
    id: number;
    body: string;
    expectation: string;
    weight: number;
  }>(`SELECT id, body, expectation, weight FROM questions WHERE listing_id = $1`, [
    listingId,
  ]);

  if (questions.length === 0) {
    return apiError(500, "Listing has no questions");
  }

  // Every question must be answered — a response is all-or-nothing.
  const submitted = new Map(
    parsed.data.answers.map((answer) => [answer.questionId, answer.body])
  );
  for (const question of questions) {
    if (!submitted.has(question.id)) {
      return apiError(400, "Answer every question before submitting");
    }
  }
  if (submitted.size !== questions.length) {
    return apiError(400, "Unknown question in the submission");
  }

  const limit = await checkResponseLimit(sessionId);
  if (!limit.allowed) {
    return apiError(429, "Daily answer limit reached (10 per day)");
  }

  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM responses WHERE listing_id = $1 AND answerer_id = $2`,
    [listingId, sessionId]
  );
  if (existing) {
    return apiError(409, "You have already answered this listing");
  }

  // --- Screening ------------------------------------------------------------
  const screeningText = questions
    .map((q) => submitted.get(q.id) ?? "")
    .join("\n---\n");
  const safety = await screenContent(screeningText);
  if (!safety.safe) {
    return apiError(400, `Not allowed on Tablemate: ${safety.reason}`);
  }

  // --- Scoring (single batched Gemini call) ----------------------------------
  const scores = await scoreAnswers(
    questions.map((q) => ({
      questionId: q.id,
      question: q.body,
      expectation: q.expectation,
      answer: submitted.get(q.id) ?? "",
    }))
  );

  const scoresByQuestion = new Map<number, ScoreItem>(
    scores.scores.map((s) => [s.questionId, s])
  );
  const weights = new Map(questions.map((q) => [q.id, q.weight]));

  // If Gemini returned a question we did not send, ignore it; if it dropped one,
  // treat it as 0 with a rationale so the weighted average still adds up.
  const effectiveScores: ScoreItem[] = questions.map((q) => {
    const found = scoresByQuestion.get(q.id);
    return (
      found ?? {
        questionId: q.id,
        score: 0,
        rationale: "No score returned for this answer.",
      }
    );
  });
  const matchScore = computeMatchScore(effectiveScores, weights);

  // --- Persist ---------------------------------------------------------------
  let responseId: number;
  try {
    responseId = await withTransaction(async (client) => {
      const responseRows = await query<{ id: number }>(
        `INSERT INTO responses (listing_id, answerer_id, match_score, status)
         VALUES ($1, $2, $3, 'scored') RETURNING id`,
        [listingId, sessionId, matchScore],
        client
      );
      const newResponseId = responseRows[0].id;

      for (const question of questions) {
        const scored = scoresByQuestion.get(question.id);
        await query(
          `INSERT INTO answers (response_id, question_id, body, score, rationale)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            newResponseId,
            question.id,
            submitted.get(question.id) ?? "",
            scored?.score ?? 0,
            scored?.rationale ?? "No score returned for this answer.",
          ],
          client
        );
      }

      return newResponseId;
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === pgUniqueViolation
    ) {
      return apiError(409, "You have already answered this listing");
    }
    throw error;
  }

  // The match score is deliberately omitted — answerers never see it (PRD §4).
  return NextResponse.json({ ok: true, responseId }, { status: 201 });
}
