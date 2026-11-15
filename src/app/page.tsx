"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getJson } from "@/lib/client";
import { Badge, Button, Card, EmptyState, ErrorNotice, LoadingScreen } from "@/components/ui";
import type { Listing, Profile } from "@/lib/types";

export default function BrowsePage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Profile first (so "answer" affordances know whether to nag), then listings.
    Promise.all([getJson<{ profile: Profile | null }>("/api/profile"), getJson<{ listings: Listing[] }>("/api/listings")])
      .then(([profileResult, listingResult]) => {
        setProfile(profileResult.profile);
        setListings(listingResult.listings);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Ask the café
          </h1>
          <p className="text-sm text-zinc-500">
            Open listings from people at the tables around you.
          </p>
        </div>
        <Link href={profile ? "/new" : "/profile?next=/new"}>
          <Button size="sm" variant={profile ? "primary" : "secondary"}>
            {profile ? "New listing" : "Set up profile"}
          </Button>
        </Link>
      </div>

      {error && <ErrorNotice message={error} />}
      {!listings && !error && <LoadingScreen />}

      {listings && listings.length === 0 && (
        <EmptyState
          title="No listings yet"
          description="Be the first to ask the café a question — the best answerer might be two tables away."
          action={
            <Link href={profile ? "/new" : "/profile?next=/new"}>
              <Button>{profile ? "Create a listing" : "Create your profile"}</Button>
            </Link>
          }
        />
      )}

      {listings && listings.length > 0 && (
        <ul className="space-y-3">
          {listings.map((listing) => (
            <li key={listing.id}>
              <Link href={`/listing/${listing.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge tone={listing.is_mine ? "zinc" : "amber"}>
                      {listing.is_mine ? "Your listing" : `Asked by ${listing.asker_nickname}`}
                    </Badge>
                    {listing.answered_by_me && <Badge tone="green">Answered</Badge>}
                  </div>

                  <h2 className="mb-1 text-base font-semibold leading-snug text-zinc-900">
                    {listing.title}
                  </h2>

                  <p className="mb-3 line-clamp-2 text-sm text-zinc-600">
                    {listing.questions?.[0]?.body}
                    {(listing.questions?.length ?? 0) > 1 &&
                      ` +${(listing.questions?.length ?? 0) - 1} more question${(listing.questions?.length ?? 0) > 2 ? "s" : ""}`}
                  </p>

                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>
                      {listing.response_count === 0
                        ? "No answers yet"
                        : `${listing.response_count} answer${listing.response_count === 1 ? "" : "s"}`}
                    </span>
                    <span>
                      {new Date(listing.created_at).toLocaleTimeString("en", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
