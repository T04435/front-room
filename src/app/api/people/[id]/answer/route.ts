import { z } from "zod";
import { nameKey } from "@/lib/qloo-parse";
import { addSteer, uid } from "@/lib/story";
import { getPerson, savePerson } from "@/server/people";

const body = z.object({ card: z.string().max(80), answer: z.enum(["yes", "unsure", "upset"]).nullable() });

/**
 * A Ring a bell? answer. Yes → a love (source ring_a_bell); would upset → steer clear (never); not sure → just noted.
 * Changing an answer takes back what the old one added.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/people/[id]/answer">) {
  const person = await getPerson((await ctx.params).id);
  if (!person) return Response.json({ error: "No such person" }, { status: 404 });
  if (person.example) return Response.json({ error: "The example is read-only." }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick an answer" }, { status: 400 });
  const key = Object.keys(person.suggestions).find((k) => person.suggestions[k].some((s) => s.id === parsed.data.card));
  if (!key) return Response.json({ error: "That suggestion has gone" }, { status: 404 });
  const card = person.suggestions[key].find((s) => s.id === parsed.data.card)!;
  const k = nameKey(card.title);
  let next = {
    ...person,
    // Take back what the previous answer added.
    loves: person.loves.filter((l) => !(l.source === "ring_a_bell" && nameKey(l.title) === k)),
    steers: person.steers.filter((s) => !(s.kind === "item" && nameKey(s.label) === k)),
    suggestions: { ...person.suggestions, [key]: person.suggestions[key].map((s) => (s.id === card.id ? { ...s, answer: parsed.data.answer ?? undefined } : s)) },
  };
  if (parsed.data.answer === "yes") {
    next = {
      ...next,
      loves: [...next.loves, { id: uid("lv"), type: card.type === "artist" ? "artist" : card.type, title: card.title, ...(card.by ? { by: card.by } : {}), year: card.year, ...(card.qlooId ? { qlooId: card.qlooId } : {}), source: "ring_a_bell", placeId: card.placeId }],
    };
  }
  if (parsed.data.answer === "upset") next = addSteer(next, card.title, "never", "item");
  return Response.json(await savePerson(next));
}
