"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getJson, postJson } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  ErrorNotice,
  Field,
  Input,
  LoadingScreen,
  Modal,
  ScoreDial,
  TagList,
  Textarea,
} from "@/components/ui";
import type { ListingDetail, Profile, RankedResponse } from "@/lib/types";

const MEET_SPOTS = [
  "Table 1",
  "Table 2",
  "Table 3",
  "Table 4",
  "Table 5",
  "Table 6",
  "I'll find you at the counter",
];

function formatDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ListingView({ id }: { id: string }) {
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    return Promise.all([
      getJson<{ listing: ListingDetail }>(`/api/listings/${id}`),
      getJson<{ profile: Profile | null }>("/api/profile"),
    ])
      .then(([detailResult, profileResult]) => {
        setListing(detailResult.listing);
        setProfile(profileResult.profile);
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="space-y-3">
        <ErrorNotice message={error} />
        <Link href="/" className="text-sm text-amber-700 hover:underline">
          ← Back to listings
        </Link>
      </div>
    );
  }

  if (!listing) return <LoadingScreen />;

  const expired =
    listing.status !== "open" || new Date(listing.expires_at) <= new Date();

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Badge tone={listing.is_mine ? "zinc" : "amber"}>
            {listing.is_mine ? "Your listing" : `Asked by ${listing.asker_nickname}`}
          </Badge>
          {expired && <Badge tone="red">Closed</Badge>}
        </div>
        <h1 className="text-xl font-bold leading-snug tracking-tight text-zinc-900">
          {listing.title}
        </h1>
      </div>

      {listing.is_mine ? (
        <AskerResults listing={listing} onRefresh={load} />
      ) : (
        <AnswerFlow
          listing={listing}
          profile={profile}
          expired={expired}
          onAnswered={load}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Answer flow */

function AnswerFlow({
  listing,
  profile,
  expired,
  onAnswered,
}: {
  listing: ListingDetail;
  profile: Profile | null;
  expired: boolean;
  onAnswered: () => Promise<unknown>;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const missing = listing.questions.find(
      (question) => (answers[question.id] ?? "").trim().length === 0
    );
    if (missing) {
      setError("Answer every question before submitting");
      return;
    }

    setSubmitting(true);
    try {
      await postJson(`/api/listings/${listing.id}/respond`, {
        answers: listing.questions.map((question) => ({
          questionId: question.id,
          body: (answers[question.id] ?? "").trim(),
        })),
      });
      setSent(true);
      await onAnswered();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <Card className="space-y-3 text-center">
        <div className="text-3xl">✅</div>
        <h2 className="text-base font-semibold text-zinc-900">
          Your answers were sent
        </h2>
        <p className="text-sm text-zinc-500">
          If they&apos;re a strong match, you&apos;ll get an invitation in your inbox.
        </p>
        <Link href="/">
          <Button variant="secondary">Back to listings</Button>
        </Link>
      </Card>
    );
  }

  if (expired) {
    return (
      <Card className="text-center text-sm text-zinc-500">
        This listing is closed and is no longer accepting answers.
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="space-y-3 text-center">
        <h2 className="text-base font-semibold text-zinc-900">
          Set up your profile to answer
        </h2>
        <p className="text-sm text-zinc-500">
          Takes about 30 seconds — nickname, a line about you, no login.
        </p>
        <Link href={`/profile?next=/listing/${listing.id}`}>
          <Button full>Create profile</Button>
        </Link>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {listing.questions.map((question) => (
        <Card key={question.id}>
          <p className="mb-2 text-sm font-medium text-zinc-800">
            {question.position}. {question.body}
          </p>
          <Textarea
            value={answers[question.id] ?? ""}
            onChange={(event) =>
              setAnswers((current) => ({
                ...current,
                [question.id]: event.target.value.slice(0, 500),
              }))
            }
            rows={4}
            maxLength={500}
            placeholder="Give specific substance — the asker is scoring answers against what they're looking for."
            required
          />
          <p className="mt-1 text-right text-xs text-zinc-400">
            {(answers[question.id] ?? "").length}/500
          </p>
        </Card>
      ))}

      {error && <ErrorNotice message={error} />}

      <Button type="submit" full loading={submitting}>
        Send my answers
      </Button>
      <p className="text-center text-xs text-zinc-400">
        You can answer this listing only once.
      </p>
    </form>
  );
}

/* ----------------------------------------------------------- Asker results */

function AskerResults({
  listing,
  onRefresh,
}: {
  listing: ListingDetail;
  onRefresh: () => Promise<unknown>;
}) {
  const [sharing, setSharing] = useState<RankedResponse | null>(null);
  const responses = listing.responses ?? [];

  return (
    <>
      {responses.length === 0 ? (
        <Card className="text-center text-sm text-zinc-500">
          No answers yet. Your listing is live at the café — results appear here
          the moment someone answers.
        </Card>
      ) : (
        <ul className="space-y-3">
          {responses.map((response, index) => (
            <li key={response.id}>
              <ResponseCard
                listing={listing}
                response={response}
                rank={index + 1}
                onShare={() => setSharing(response)}
              />
            </li>
          ))}
        </ul>
      )}

      <ShareModal
        listing={listing}
        response={sharing}
        onClose={() => setSharing(null)}
        onSent={async () => {
          setSharing(null);
          await onRefresh();
        }}
      />
    </>
  );
}

function ResponseCard({
  listing,
  response,
  rank,
  onShare,
}: {
  listing: ListingDetail;
  response: RankedResponse;
  rank: number;
  onShare: () => void;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <ScoreDial score={response.match_score} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {rank === 1 && <Badge tone="green">Best match</Badge>}
            <span className="text-sm font-semibold text-zinc-900">
              {response.answerer.nickname}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            {response.answerer.bio || "No bio yet"}
          </p>
        </div>
      </div>

      <TagList tags={response.answerer.interests ?? []} />

      <div className="space-y-2">
        {response.answers.map((answer) => {
          const question = listing.questions.find(
            (q) => q.id === answer.question_id
          );
          return (
            <div key={answer.id} className="rounded-xl bg-stone-50 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-zinc-500">
                  {question?.body}
                </span>
                <Badge
                  tone={
                    (answer.score ?? 0) >= 81
                      ? "green"
                      : (answer.score ?? 0) >= 51
                        ? "amber"
                        : "default"
                  }
                >
                  {answer.score ?? 0}
                </Badge>
              </div>
              <p className="text-zinc-800">{answer.body}</p>
              {answer.rationale && (
                <p className="mt-2 border-t border-zinc-200 pt-2 text-xs italic text-zinc-500">
                  Why: {answer.rationale}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {response.invitation ? (
        <div className="rounded-xl bg-zinc-100 p-3 text-xs text-zinc-600">
          <span className="font-semibold">
            Invitation {response.invitation.status}
          </span>
          {response.invitation.meet_at && (
            <>
              {" · "}
              {new Date(response.invitation.meet_at).toLocaleString("en", {
                weekday: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </>
          )}
          {response.invitation.meet_spot && ` · ${response.invitation.meet_spot}`}
        </div>
      ) : (
        <Button variant="secondary" full onClick={onShare}>
          Share my profile
        </Button>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------- Share modal */

function ShareModal({
  listing,
  response,
  onClose,
  onSent,
}: {
  listing: ListingDetail;
  response: RankedResponse | null;
  onClose: () => void;
  onSent: () => Promise<unknown>;
}) {
  const [shareContact, setShareContact] = useState(false);
  const [message, setMessage] = useState("");
  const [meetAt, setMeetAt] = useState(() =>
    formatDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString())
  );
  const [meetSpot, setMeetSpot] = useState(MEET_SPOTS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Narrowed once so the async handler can close over a non-null value.
  const candidate = response;

  if (!candidate) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!candidate) return; // narrowed again inside the handler for the type checker
    setError(null);
    setSubmitting(true);

    try {
      await postJson("/api/invitations", {
        responseId: candidate.id,
        shareContact,
        message: message.trim(),
        meetAt: meetAt ? new Date(meetAt).toISOString() : undefined,
        meetSpot,
      });
      await onSent();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Share your profile" onClose={onClose}>
      <p className="mb-3 text-sm text-zinc-500">
        With{" "}
        <span className="font-medium text-zinc-800">
          {candidate.answerer.nickname}
        </span>{" "}
        on “{listing.title}”
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3">
          <input
            type="checkbox"
            checked={shareContact}
            onChange={(event) => setShareContact(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-amber-600"
          />
          <span className="text-sm">
            <span className="font-medium text-zinc-800">
              Include my contact info
            </span>
            <span className="block text-xs text-zinc-500">
              Shown to this person only, only if they open your invitation.
            </span>
          </span>
        </label>

        <Field label="Message" hint="Optional">
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value.slice(0, 200))}
            rows={2}
            maxLength={200}
            placeholder="Your answer was spot on — want to talk over a coffee?"
          />
        </Field>

        <Field label="Propose a meeting">
          <Input
            type="datetime-local"
            value={meetAt}
            onChange={(event) => setMeetAt(event.target.value)}
            required
          />
        </Field>

        <Field label="Where">
          <select
            value={meetSpot}
            onChange={(event) => setMeetSpot(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            {MEET_SPOTS.map((spot) => (
              <option key={spot} value={spot}>
                {spot}
              </option>
            ))}
          </select>
        </Field>

        <p className="text-xs leading-relaxed text-zinc-500">
          ☕ Meet only at this café, during opening hours, in a public space. If
          it&apos;s not a fit, they can decline quietly — no notifications, no
          awkwardness.
        </p>

        {error && <ErrorNotice message={error} />}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" loading={submitting} full>
            Send invitation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
