import "server-only";
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import type { KitItem } from "@/lib/kit";
import type { Goal } from "@/lib/learning";
import type { Person } from "@/lib/person";
import { offline } from "@/server/env";
import { LIMITS, MODELS } from "./models";

const schema = z.object({
  prompts: z.array(z.object({ text: z.string(), reply: z.string(), refs: z.array(z.string()) })),
  summary: z.string(),
});

const COUNT: Record<Goal, number> = { settle: 2, chat: 5, sing: 3 };

/**
 * Prompts for a person's kit, from their story: gentle, open questions staff can say aloud, each with what they might
 * answer. Settle has few questions. The story goes to the model (never to Qloo); steer-clear labels are listed only
 * so the model stays away from them.
 */
export async function promptsFor(person: Person, items: KitItem[], goal: Goal, abortSignal?: AbortSignal): Promise<z.infer<typeof schema>> {
  const n = COUNT[goal];
  const model: LanguageModel = offline()
    ? new MockLanguageModelV4({
        modelId: "offline-prompts",
        doGenerate: async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                prompts: items.filter((i) => i.type !== "song").concat(items.filter((i) => i.type === "song")).slice(0, n).map((i) => ({ text: `${person.preferredName}, did you ever see or hear ${i.title}? Who were you with?`, reply: "They might name a friend, a place, or hum a line.", refs: [i.ref] })),
                summary: `Offline fixture ${goal} session.`,
              }),
            },
          ],
          finishReason: { unified: "stop", raw: undefined },
          usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } },
          warnings: [],
        }),
      })
    : MODELS.curator;
  const story = [
    `Name they like: ${person.preferredName}`,
    person.places.length ? `Places: ${person.places.map((p) => `${p.name} ${p.fromYear ?? "?"}–${p.toYear ?? "?"}${p.role ? ` (${p.role})` : ""}`).join("; ")}` : null,
    person.moments.length ? `Moments: ${person.moments.map((m) => `${m.label}${m.year ? ` (${m.year})` : ""}`).join("; ")}` : null,
    person.practical.work ? `Work: ${person.practical.work}` : null,
    person.practical.greeting ? `Greeting: ${person.practical.greeting}` : null,
    person.steers.length ? `Never raise: ${person.steers.map((s) => s.label).join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const prompt = `You write ${n} conversation prompts for a ${goal} session that care staff or family will share with an older person living with dementia.

Their story:
${story}

The session's items (ref [type] title):
${items.map((i) => `${i.ref} [${i.type}] ${i.title}${i.by ? ` · ${i.by.title}` : ""}${i.year ? ` (${i.year})` : ""}`).join("\n")}

Rules:
- Each prompt is a gentle, open question to say out loud, using their name, tied to an item (cite its ref) or their story. Invite a story or an opinion ("Did you ever dance to this at the Ritz?"). Never test memory: never use the word "remember", no quizzes, no correcting.
- "reply" is what they might answer, so new staff know what to listen for: one short line. Write it about "they", not by name and never with he, she, him or her: "They might name a friend, a cinema, or sing a line."
- ${goal === "settle" ? "Settle: soft and short, about comfort; no questions that need effort." : goal === "sing" ? "Sing: invite joining in, building to the last song." : "Chat: mix music, the film, the telly and places."}
- Never raise anything they should steer clear of. No medical or therapeutic claims. British English for a UK place. No emoji.
- "summary" is one sentence for staff on the session's shape.`;
  const once = async () =>
    (
      await generateText({
        model,
        output: Output.object({ schema }),
        prompt,
        maxOutputTokens: 2000,
        abortSignal: AbortSignal.any([AbortSignal.timeout(LIMITS.curatorTimeoutMs), ...(abortSignal ? [abortSignal] : [])]),
      })
    ).output;
  const known = new Set(items.map((i) => i.ref));
  // Pronouns come only from the teller, and the story keeps none: a reply that guesses one is rewritten to "they".
  const they = (t: string) => t.replace(/\b(she|he)\b/gi, (m) => (m[0] === m[0].toUpperCase() ? "They" : "they")).replace(/\bher(?=\s+[a-z])/gi, "their").replace(/\b(her|him)\b/gi, "them").replace(/\b(hers|his)\b/gi, "their");
  const tidy = (o: z.infer<typeof schema>) => ({ ...o, prompts: o.prompts.slice(0, n).map((p) => ({ ...p, reply: they(p.reply), refs: p.refs.filter((r) => known.has(r)) })).filter((p) => p.text.trim() && !/remember/i.test(p.text)) });
  try {
    return tidy(await once());
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error) || abortSignal?.aborted) throw error;
    return tidy(await once());
  }
}
