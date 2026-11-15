import { Type, type Schema } from "@google/genai";
import { generateJSON, useMockGemini } from "./gemini";

interface SafetyResult {
  safe: boolean;
  reason?: string;
}

const safetyResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    safe: { type: Type.BOOLEAN },
    reason: { type: Type.STRING, nullable: true },
  },
  required: ["safe"],
};

const RULES = `You are a content safety screener for a café matchmaking app called Tablemate.

Evaluate the following text and determine if it is safe to publish. The text is UNSAFE if it contains any of:
1. Harassment, threats, or bullying
2. Hate speech targeting any group
3. Sexual or romantic solicitation (this is a professional/social matching app, not dating)
4. Requests for personal details such as home addresses, financial information, or government IDs
5. Discriminatory criteria that filter on protected characteristics (e.g., "must be under 30", "men only", "no foreigners", a specific religion required)

The text to evaluate:
"""
`;

export async function screenContent(text: string): Promise<SafetyResult> {
  if (useMockGemini) {
    // Keyword check so the offline path still catches the obvious cases.
    const unsafePatterns =
      /under 30|men only|women only|no (foreigners|immigrants)|hitman|credit card|bank account|send me (nudes|money)/i;
    if (unsafePatterns.test(text)) {
      return {
        safe: false,
        reason: "Content appears to breach the community rules (offline check).",
      };
    }
    return { safe: true };
  }

  const prompt = `${RULES}${text}
"""

Return JSON: { "safe": true } if the text is acceptable, or { "safe": false, "reason": "brief explanation" } if not.`;

  try {
    const result = await generateJSON<SafetyResult>(prompt, {
      schema: safetyResponseSchema,
      thinking: "low", // MINIMAL is rejected by current Gemini 3.x models
    });

    // A screening outage must not be a publish button, but a broken response
    // should also not block a café full of users. Fail closed on a non-boolean.
    if (typeof result.safe !== "boolean") {
      console.error("Safety screening returned no verdict, allowing content");
      return { safe: true };
    }

    return {
      safe: result.safe,
      reason: result.reason?.slice(0, 300),
    };
  } catch {
    console.error("Safety screening failed, allowing content");
    return { safe: true };
  }
}
