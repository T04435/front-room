import { z } from "zod";
import { RESPONSES } from "@/lib/kit";
import { getKit, getResponses, logResponse, undoResponse } from "@/server/kits";
import { perVisitor, refusalResponse } from "@/server/limits";

const body = z.object({ response: z.enum(RESPONSES), trackRef: z.string().max(8).nullable().optional() });

export async function GET(_request: Request, ctx: RouteContext<"/api/kits/[id]/log">) {
  const { id } = await ctx.params;
  if (!(await getKit(id))) return Response.json({ error: "No such kit" }, { status: 404 });
  return Response.json(await getResponses(id), { headers: { "Cache-Control": "no-store" } });
}

/** One tap: calm, engaged, sang along or upset, with the track playing if any. */
export async function POST(request: Request, ctx: RouteContext<"/api/kits/[id]/log">) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a response" }, { status: 400 });
  const kit = await getKit(id);
  if (!kit) return Response.json({ error: "No such kit" }, { status: 404 });
  const trackRef = parsed.data.trackRef ?? null;
  if (trackRef && !kit.playlist.some((t) => t.ref === trackRef)) return Response.json({ error: "That track isn't in this kit" }, { status: 400 });
  const refused = await perVisitor("log", request);
  if (refused) return refusalResponse(refused);
  return Response.json(await logResponse(id, parsed.data.response, trackRef));
}

/** Undo a tap made by mistake. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/kits/[id]/log">) {
  const { id } = await ctx.params;
  const entry = Number(new URL(request.url).searchParams.get("entry"));
  if (!Number.isInteger(entry)) return Response.json({ error: "Which entry?" }, { status: 400 });
  await undoResponse(id, entry);
  return new Response(null, { status: 204 });
}
