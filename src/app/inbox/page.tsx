"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getJson, patchJson } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  Input,
  LoadingScreen,
  Modal,
  TagList,
} from "@/components/ui";
import type { Invitation } from "@/lib/types";

const MEET_SPOTS = [
  "Table 1",
  "Table 2",
  "Table 3",
  "Table 4",
  "Table 5",
  "Table 6",
  "I'll find you at the counter",
];

const STATUS_TONES = {
  pending: "amber",
  accepted: "green",
  declined: "default",
  countered: "amber",
} as const;

export default function InboxPage() {
  const [received, setReceived] = useState<Invitation[] | null>(null);
  const [sent, setSent] = useState<Invitation[] | null>(null);
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [error, setError] = useState<string | null>(null);
  const [countering, setCountering] = useState<Invitation | null>(null);

  const load = useCallback(() => {
    return getJson<{ received: Invitation[]; sent: Invitation[] }>("/api/invitations")
      .then((result) => {
        setReceived(result.received);
        setSent(result.sent);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function respondTo(invitation: Invitation, status: "accepted" | "declined") {
    setError(null);
    try {
      await patchJson(`/api/invitations/${invitation.id}`, { status });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function sendCounter(
    invitation: Invitation,
    meetAt: string,
    meetSpot: string
  ) {
    setError(null);
    try {
      await patchJson(`/api/invitations/${invitation.id}`, {
        status: "countered",
        meetAt: meetAt ? new Date(meetAt).toISOString() : undefined,
        meetSpot,
      });
      setCountering(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (error) return <ErrorNotice message={error} />;
  if (!received || !sent) return <LoadingScreen />;

  const pendingCount = received.filter((invitation) => invitation.status === "pending").length;
  const list = tab === "received" ? received : sent;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Inbox</h1>
        <p className="text-sm text-zinc-500">
          Meeting proposals from people who liked your answers.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
        {(["received", "sent"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
              tab === value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
            }`}
          >
            {value}
            {value === "received" && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-[11px] font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={tab === "received" ? "No invitations yet" : "Nothing sent yet"}
          description={
            tab === "received"
              ? "Answer listings on the browse page — strong matches get invited to meet."
              : "Share your profile with a candidate from one of your listings."
          }
          action={
            <Link href="/">
              <Button variant="secondary">Browse listings</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {list.map((invitation) => (
            <li key={`${invitation.direction}-${invitation.id}`}>
              <InvitationCard
                invitation={invitation}
                onRespond={respondTo}
                onCounter={() => setCountering(invitation)}
              />
            </li>
          ))}
        </ul>
      )}

      <CounterModal
        invitation={countering}
        onClose={() => setCountering(null)}
        onSend={sendCounter}
      />
    </div>
  );
}

function InvitationCard({
  invitation,
  onRespond,
  onCounter,
}: {
  invitation: Invitation;
  onRespond: (invitation: Invitation, status: "accepted" | "declined") => Promise<void>;
  onCounter: () => void;
}) {
  const isReceived = invitation.direction === "received";

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge tone={STATUS_TONES[invitation.status]}>{invitation.status}</Badge>
        <span className="text-xs text-zinc-400">
          {new Date(invitation.created_at).toLocaleDateString("en", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold text-zinc-900">
          {isReceived
            ? `${invitation.peer.nickname} wants to meet you`
            : `You invited ${invitation.peer.nickname}`}
        </p>
        <p className="text-xs text-zinc-500">on “{invitation.listing_title}”</p>
      </div>

      <p className="text-sm text-zinc-700">
        {invitation.peer.bio || "No bio yet"}
      </p>
      <TagList tags={invitation.peer.interests ?? []} />

      {invitation.message && (
        <p className="rounded-xl bg-stone-50 p-3 text-sm italic text-zinc-700">
          “{invitation.message}”
        </p>
      )}

      {isReceived && invitation.share_contact && invitation.peer.contact && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span className="font-semibold">Their contact:</span>{" "}
          {invitation.peer.contact}
        </p>
      )}

      {(invitation.meet_at || invitation.meet_spot) && (
        <div className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-700">
          <span className="font-medium">Proposed:</span>{" "}
          {invitation.meet_at &&
            new Date(invitation.meet_at).toLocaleString("en", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          {invitation.meet_spot && ` · ${invitation.meet_spot}`}
        </div>
      )}

      {isReceived && invitation.status === "pending" && (
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={() => onRespond(invitation, "declined")}
          >
            Decline
          </Button>
          <Button
            variant="secondary"
            onClick={onCounter}
            full
          >
            Propose another time
          </Button>
          <Button onClick={() => onRespond(invitation, "accepted")} full>
            Accept
          </Button>
        </div>
      )}

      {!isReceived && invitation.status === "pending" && (
        <p className="text-center text-xs text-zinc-400">
          Waiting for their reply.
        </p>
      )}

      <p className="text-center text-xs text-zinc-400">
        ☕ Meetings happen at this café, in a public space.
      </p>
    </Card>
  );
}

function CounterModal({
  invitation,
  onClose,
  onSend,
}: {
  invitation: Invitation | null;
  onClose: () => void;
  onSend: (invitation: Invitation, meetAt: string, meetSpot: string) => Promise<void>;
}) {
  const [meetAt, setMeetAt] = useState("");
  const [meetSpot, setMeetSpot] = useState(MEET_SPOTS[0]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Narrowed once so the async handler can close over a non-null value.
  const target = invitation;

  if (!target) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return; // narrowed again inside the handler for the type checker
    if (!meetAt) {
      setError("Pick a time");
      return;
    }
    setSending(true);
    await onSend(target, meetAt, meetSpot);
    setSending(false);
  }

  return (
    <Modal open title="Propose another time" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="When">
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

        {error && <ErrorNotice message={error} />}

        <div className="flex gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={sending} full>
            Send new time
          </Button>
        </div>
      </form>
    </Modal>
  );
}
