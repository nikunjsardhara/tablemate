import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { apiError, readJsonBody } from "@/lib/api-helpers";
import { ensureSessionId, readSessionId } from "@/lib/session";
import type { Profile } from "@/lib/types";

const profileSchema = z.object({
  nickname: z.string().trim().min(1).max(50),
  bio: z.string().trim().max(200).optional().default(""),
  interests: z.array(z.string().trim().min(1).max(30)).max(10).optional().default([]),
  contact: z.string().trim().max(100).optional().default(""),
});

const PROFILE_COLUMNS = "id, nickname, bio, interests, contact, created_at";

export async function GET() {
  const sessionId = await readSessionId();

  // No cookie minting on a read: a first visit that hits two endpoints in
  // parallel would otherwise be handed two different session ids.
  if (!sessionId) {
    return NextResponse.json({ profile: null });
  }

  const profile = await queryOne<Profile>(
    `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE id = $1`,
    [sessionId]
  );

  return NextResponse.json({ profile });
}

export async function PUT(request: NextRequest) {
  const parsed = profileSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return apiError(400, parsed.error.issues[0]?.message ?? "Invalid profile");
  }

  const { nickname, bio, interests, contact } = parsed.data;
  const sessionId = await ensureSessionId();

  const rows = await query<Profile>(
    `INSERT INTO profiles (id, nickname, bio, interests, contact)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
       SET nickname = $2, bio = $3, interests = $4, contact = $5
     RETURNING ${PROFILE_COLUMNS}`,
    [
      sessionId,
      nickname,
      bio || null,
      interests,
      contact || null,
    ]
  );

  return NextResponse.json({ profile: rows[0] });
}
