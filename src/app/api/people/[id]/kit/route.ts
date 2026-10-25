import { z } from "zod";
import { GOALS } from "@/lib/learning";
import { missingMinimum } from "@/lib/person";
import { providerStatus } from "@/server/env";
import { deviceId, perVisitor, refusalResponse, takeRun, addQlooCalls } from "@/server/limits";
import { newKitId, saveKit } from "@/server/kits";
import { getPerson, personKits, personLogs } from "@/server/people";
import { buildPersonKit } from "@/server/person-kit";

export const maxDuration = 300;

const body = z.object({ goal: z.enum(GOALS) });

/**
 * A person's next session kit for a goal, built from what's proven, what the family said yes to, and 3 Qloo new tries.
 * Saved for the person (the example's is a preview: built, not saved, and read-only).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/people/[id]/kit">) {
  const { id } = await ctx.params;
  const person = await getPerson(id);
  if (!person) return Response.json({ error: "No such person" }, { status: 404 });
  if (missingMinimum(person).length) return Response.json({ error: "Their story needs a name, a birth year and one place first." }, { status: 400 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick Settle, Chat or Sing." }, { status: 400 });
  const status = providerStatus();
  if (!status.qloo || !status.aiGateway) return Response.json({ error: "New sessions can't be built right now. Past sessions still open." }, { status: 503 });
  const refused = (await perVisitor("run", request)) ?? (await takeRun());
  if (refused) return refusalResponse(refused);
  let calls = 0;
  try {
    const kit = await buildPersonKit(person, await personKits(id), await personLogs(id), parsed.data.goal, (log) => void (!log.cached && calls++), request.signal);
    if (kit.items.filter((i) => i.type === "song").length === 0) {
      return Response.json({ error: "Nothing to play yet. Answer a few Ring a bell? cards, or add something they loved to the story." }, { status: 409 });
    }
    if (person.example) return Response.json({ ...kit, id: "", preview: true });
    kit.id = newKitId();
    await saveKit(kit, deviceId(request.headers.get("cookie")));
    return Response.json(kit);
  } catch (error) {
    console.error("person kit failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "The session couldn't be set out. Try again in a minute." }, { status: 502 });
  } finally {
    await addQlooCalls(calls).catch(() => {});
  }
}
