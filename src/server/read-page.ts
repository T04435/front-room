import "server-only";
import { generateText, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { EXAMPLES } from "@/lib/examples";
import { offline } from "@/server/env";
import { LIMITS, MODELS } from "./models";

export const READ_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"] as const;
export const READ_MAX_BYTES = 4 * 1024 * 1024;

const RULES = `This is a photo or scan of a "This is me" form (or a family's notes) about someone living with dementia. Write out what it says, as plain text, so the family can check it and send it on.

- Keep the teller's own words and language. Keep the form's headings ("Where I grew up: …").
- Leave out surnames, addresses, phone numbers, diagnoses and medication, even if written: put "[left out]" instead.
- Don't add, guess or tidy anything. If a word can't be read, write [unclear].
- If there's nothing readable about a person, write only: NOTHING TO READ`;

/** The words on a page (a photo or PDF of a "This is me"): only the text comes back; the file is not kept. */
export async function readPage(data: Uint8Array, mediaType: string, abortSignal?: AbortSignal): Promise<string> {
  const model: LanguageModel = offline() ? offlineReader() : MODELS.curator;
  const { text } = await generateText({
    model,
    messages: [{ role: "user", content: [{ type: "text", text: RULES }, { type: "file", mediaType, data }] }],
    maxOutputTokens: 2500,
    abortSignal: AbortSignal.any([AbortSignal.timeout(LIMITS.curatorTimeoutMs), ...(abortSignal ? [abortSignal] : [])]),
  });
  return text.trim();
}

/** Offline (tests): reads every page as the example Joan's form. */
function offlineReader(): LanguageModel {
  return new MockLanguageModelV4({
    modelId: "offline-reader",
    doGenerate: async () => ({
      content: [{ type: "text", text: EXAMPLES[0].text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } },
      warnings: [],
    }),
  });
}
