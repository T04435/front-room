import { z } from "zod";
import { providerStatus } from "@/server/env";
import { extractFacts } from "@/server/extract";
import { perVisitor, refusalResponse } from "@/server/limits";
import { getPerson } from "@/server/people";

export const maxDuration = 120;

const body = z.object({ text: z.string().trim().min(3).max(8000) });

/**
 * The facts in what someone told or pasted. Nothing is stored: not the text (discarded after extraction), not the facts
 * (the page saves only the ones confirmed). No Qloo calls here.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/people/[id]/extract">) {
  const person = await getPerson((await ctx.params).id);
  if (!person) return Response.json({ error: "No such person" }, { status: 404 });
  if (person.example) return Response.json({ error: "The example is read-only. Try your own person to tell a story." }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Tell us a little more first." }, { status: 400 });
  if (!providerStatus().aiGateway) return Response.json({ error: "The story chat can't read stories right now. Try again later." }, { status: 503 });
  const refused = await perVisitor("chat", request);
  if (refused) return refusalResponse(refused);
  try {
    const { facts, followUps } = await extractFacts(parsed.data.text, person, request.signal);
    return Response.json({ facts: facts.map((f, i) => ({ ...f, id: `f${Date.now().toString(36)}${i}` })), followUps }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("extract failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "That didn't go through. Try again in a minute." }, { status: 502 });
  }
}
