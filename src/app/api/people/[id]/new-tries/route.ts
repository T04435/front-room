import { playStats } from "@/lib/learning";
import { providerStatus } from "@/server/env";
import { addQlooCalls, perVisitor, refusalResponse } from "@/server/limits";
import { findNewTries, newTriesStale } from "@/server/new-tries";
import { getPerson, personPlays, savePerson } from "@/server/people";

export const maxDuration = 120;

/** New tries like what works for them, found again whenever what works changes. */
export async function POST(request: Request, ctx: RouteContext<"/api/people/[id]/new-tries">) {
  const person = await getPerson((await ctx.params).id);
  if (!person) return Response.json({ error: "No such person" }, { status: 404 });
  if (person.example) return Response.json({ error: "The example is read-only." }, { status: 403 });
  const stats = playStats(await personPlays(person.id), person.resolvedUpsets);
  if (!newTriesStale(person, stats)) return Response.json({ changed: false });
  const status = providerStatus();
  if (!status.qloo || !status.aiGateway) return Response.json({ error: "New tries can't be looked up right now." }, { status: 503 });
  const refused = await perVisitor("run", request);
  if (refused) return refusalResponse(refused);
  let calls = 0;
  try {
    await savePerson(await findNewTries(person, stats, (l) => void (!l.cached && calls++), request.signal));
    return Response.json({ changed: true });
  } catch (error) {
    console.error("new tries failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "New tries couldn't be found just now." }, { status: 502 });
  } finally {
    await addQlooCalls(calls).catch(() => {});
  }
}
