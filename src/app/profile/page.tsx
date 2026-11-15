"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getJson, putJson } from "@/lib/client";
import {
  Button,
  Card,
  ErrorNotice,
  Field,
  Input,
  LoadingScreen,
  Textarea,
} from "@/components/ui";
import type { Profile } from "@/lib/types";

function ProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";

  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ profile: Profile | null }>("/api/profile")
      .then(({ profile }) => {
        if (profile) {
          setNickname(profile.nickname);
          setBio(profile.bio ?? "");
          setInterests((profile.interests ?? []).join(", "));
          setContact(profile.contact ?? "");
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const tags = interests
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (nickname.trim().length === 0) {
      setError("A nickname is required");
      return;
    }

    setSaving(true);
    try {
      await putJson("/api/profile", {
        nickname: nickname.trim(),
        bio: bio.trim(),
        interests: tags,
        contact: contact.trim(),
      });
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nickname" hint="Required">
          <Input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={50}
            placeholder="What should people call you?"
            required
          />
        </Field>

        <Field label="Short bio" hint={`${bio.length}/200`}>
          <Textarea
            value={bio}
            onChange={(event) => setBio(event.target.value.slice(0, 200))}
            rows={3}
            maxLength={200}
            placeholder="What are you into right now?"
          />
        </Field>

        <Field label="Interests" hint="Comma separated">
          <Input
            value={interests}
            onChange={(event) => setInterests(event.target.value)}
            placeholder="coffee, startups, hindi, design"
          />
        </Field>

        <Field label="Contact info" hint="Optional, shared only by you">
          <Input
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            maxLength={100}
            placeholder="email, phone or @handle"
          />
        </Field>
        <p className="text-xs leading-relaxed text-zinc-500">
          Your contact info is never shown to anyone automatically. You choose
          to include it each time you invite someone to meet.
        </p>

        {error && <ErrorNotice message={error} />}

        <Button type="submit" full loading={saving}>
          Save profile
        </Button>
      </form>
    </Card>
  );
}

export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          Your profile
        </h1>
        <p className="text-sm text-zinc-500">
          Takes 30 seconds. No login — this stays on this device.
        </p>
      </div>
      <Suspense fallback={<LoadingScreen />}>
        <ProfileForm />
      </Suspense>
    </div>
  );
}
