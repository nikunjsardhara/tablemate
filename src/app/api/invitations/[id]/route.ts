import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { apiError, readJsonBody, requireProfileId } from "@/lib/api-helpers";

const patchSchema = z.object({
  status: z.enum(["accepted", "declined", "countered"]),
  meetAt: z.string().optional(),
  meetSpot: z.string().trim().max(50).optional(),
});

/** The answerer reacts to an invitation. Only the recipient may patch it. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invitationId = Number(id);
  if (!Number.isInteger(invitationId) || invitationId <= 0) {
    return apiError(400, "Invalid invitation id");
  }

  const sessionId = await requireProfileId();
  if (!sessionId) {
    return apiError(403, "Create a profile first");
  }

  const parsed = patchSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return apiError(400, parsed.error.issues[0]?.message ?? "Invalid update");
  }

  const invitation = await queryOne<{ to_id: string; status: string }>(
    `SELECT to_id, status FROM invitations WHERE id = $1`,
    [invitationId]
  );

  if (!invitation) {
    return apiError(404, "Invitation not found");
  }
  if (invitation.to_id !== sessionId) {
    return apiError(403, "This invitation is not yours");
  }
  if (invitation.status !== "pending" && invitation.status !== "countered") {
    return apiError(409, `This invitation was already ${invitation.status}`);
  }

  let meetAt: string | null = null;
  if (parsed.data.meetAt) {
    const meetDate = new Date(parsed.data.meetAt);
    if (Number.isNaN(meetDate.getTime())) {
      return apiError(400, "Invalid meeting time");
    }
    meetAt = meetDate.toISOString();
  }

  const updated = await query(
    `UPDATE invitations
     SET status = $2,
         meet_at = COALESCE($3, meet_at),
         meet_spot = COALESCE($4, meet_spot)
     WHERE id = $1
     RETURNING id, status, meet_at, meet_spot`,
    [invitationId, parsed.data.status, meetAt, parsed.data.meetSpot ?? null]
  );

  return NextResponse.json({ invitation: updated[0] });
}
