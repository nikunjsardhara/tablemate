import { GoogleGenAI, Type, ThinkingLevel, type Schema } from "@google/genai";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

/** Gemini runs with a real key unless SCORING_MODE=mock forces the local fallback. */
export const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
export const useMockGemini =
  process.env.SCORING_MODE === "mock" || !geminiConfigured;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

type ThinkingHint = "minimal" | "low" | "medium" | "high";

const THINKING_LEVEL: Record<ThinkingHint, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

interface GenerateJSONOptions {
  schema?: Schema;
  thinking?: ThinkingHint;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|503|overload|RESOURCE_EXHAUSTED|deadline/i.test(message);
}

/**
 * Single Gemini text-in / JSON-out call used by both screening and scoring.
 * Throws on failure so callers can decide whether to fail open or closed.
 */
export async function generateJSON<T>(
  prompt: string,
  options: GenerateJSONOptions = {}
): Promise<T> {
  const ai = getClient();

  const config: Record<string, unknown> = {
    responseMimeType: "application/json",
    temperature: 0.2,
    ...(options.schema ? { responseSchema: options.schema } : {}),
  };

  // thinkingLevel only exists on the Gemini 3.x family; sending it to 2.5
  // models errors out, so gate it on the model name.
  if (options.thinking && GEMINI_MODEL.startsWith("gemini-3")) {
    config.thinkingConfig = {
      thinkingLevel: THINKING_LEVEL[options.thinking],
    };
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config,
      });
      const text = response.text ?? "";
      return JSON.parse(text) as T;
    } catch (error) {
      lastError = error;
      console.error(
        `Gemini call failed (attempt ${attempt + 1}, model=${GEMINI_MODEL}):`,
        error
      );
      if (!isRetryable(error) || attempt === 1) throw error;
      await sleep(500);
    }
  }

  throw lastError;
}

export default getClient;
