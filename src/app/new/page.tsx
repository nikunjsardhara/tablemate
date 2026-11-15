"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  ErrorNotice,
  Field,
  Input,
  Textarea,
} from "@/components/ui";

interface QuestionDraft {
  body: string;
  expectation: string;
  weight: number;
}

const WEIGHT_LABELS: Record<number, string> = {
  1: "Nice to have",
  2: "Important",
  3: "Must have",
};

const emptyQuestion = (): QuestionDraft => ({
  body: "",
  expectation: "",
  weight: 1,
});

export default function NewListingPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    setQuestions((current) =>
      current.map((question, i) =>
        i === index ? { ...question, ...patch } : question
      )
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const incomplete = questions.find(
      (question) => question.body.trim().length === 0 || question.expectation.trim().length === 0
    );
    if (title.trim().length === 0) {
      setError("Add a title for your listing");
      return;
    }
    if (incomplete) {
      setError("Every question needs both the question and what a good answer looks like");
      return;
    }

    setSubmitting(true);
    try {
      const { id } = await postJson<{ id: number }>("/api/listings", {
        title: title.trim(),
        questions: questions.map((question) => ({
          body: question.body.trim(),
          expectation: question.expectation.trim(),
          weight: question.weight,
        })),
      });
      router.push(`/listing/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          Ask the café
        </h1>
        <p className="text-sm text-zinc-500">
          Write your questions, then privately describe what a good answer
          sounds like. Only you ever see the expectations.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Listing title" hint={`${title.length}/120`}>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 120))}
            placeholder="Looking for a co-founder for a food-tech idea"
            required
          />
        </Field>

        {questions.map((question, index) => (
          <Card key={index} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Question {index + 1}
              </span>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setQuestions((current) => current.filter((_, i) => i !== index))
                  }
                  className="text-xs text-zinc-400 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </div>

            <Field label="The question" hint={`${question.body.length}/250`}>
              <Textarea
                value={question.body}
                onChange={(event) =>
                  updateQuestion(index, { body: event.target.value.slice(0, 250) })
                }
                rows={2}
                placeholder="Why does food-tech need a redesign?"
                required
              />
            </Field>

            <Field
              label="Your expectation (private)"
              hint={`${question.expectation.length}/300`}
            >
              <Textarea
                value={question.expectation}
                onChange={(event) =>
                  updateQuestion(index, {
                    expectation: event.target.value.slice(0, 300),
                  })
                }
                rows={2}
                placeholder="Has actually built something before and can name a specific gap in the market"
                required
              />
            </Field>

            <div>
              <Field label="How much does this matter?">
                <div className="flex gap-2">
                  {[1, 2, 3].map((weight) => (
                    <button
                      key={weight}
                      type="button"
                      onClick={() => updateQuestion(index, { weight })}
                      className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                        question.weight === weight
                          ? "border-amber-500 bg-amber-50 text-amber-800"
                          : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
                      }`}
                    >
                      {WEIGHT_LABELS[weight]}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </Card>
        ))}

        {questions.length < 5 && (
          <Button
            type="button"
            variant="secondary"
            full
            onClick={() => setQuestions((current) => [...current, emptyQuestion()])}
          >
            + Add another question
          </Button>
        )}

        {error && <ErrorNotice message={error} />}

        <Button type="submit" full loading={submitting}>
          Post listing
        </Button>

        <p className="text-center text-xs text-zinc-400">
          <Badge tone="amber">Visible for 24 hours</Badge>
        </p>
      </form>
    </div>
  );
}
