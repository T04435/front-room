import { RESPONSES } from "@/lib/kit";
import { z } from "zod";
import { perVisitor, refusalResponse } from "@/server/limits";
import { addPlay, getPerson, undoPlay } from "@/server/people";

const body = z.object({
  itemKey: z.string().min(3).max(240),
  type: z.enum(["song", "film", "tv", "book", "place"]),
  title: z.string().trim().min(1).max(200),
  by: z.string().trim().max(120).optional(),
  response: z.enum([...RESPONSES, "none"]),
});

/** One tap while playing something from the person's gallery: what, and how they responded. The gallery learns from these. */
export async function POST(request: Request, ctx: RouteContext<"/api/people/[id]/plays">) {
  const person = await getPerson((await ctx.params).id);
  if (!person) return Response.json({ error: "No such person" }, { status: 404 });
  if (person.example) return Response.json({ error: "The example is read-only. Try your own person to log how it went." }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a response" }, { status: 400 });
  const refused = await perVisitor("log", request);
  if (refused) return refusalResponse(refused);
  return Response.json(await addPlay(person.id, parsed.data));
}

/** Undo a tap made by mistake. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/people/[id]/plays">) {
  const person = await getPerson((await ctx.params).id);
  if (!person || person.example) return new Response(null, { status: 404 });
  const id = Number(new URL(request.url).searchParams.get("play"));
  if (!Number.isInteger(id)) return Response.json({ error: "Which play?" }, { status: 400 });
  await undoPlay(person.id, id);
  return new Response(null, { status: 204 });
}
