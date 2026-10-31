import { personPatchSchema } from "@/lib/person-schema";
import { deviceId } from "@/server/limits";
import { getPerson, savePerson, unlinkDevice } from "@/server/people";
import { db } from "@/server/db";

const readOnly = () => Response.json({ error: "The example is read-only. Try your own person to change a story." }, { status: 403 });

export async function GET(_request: Request, ctx: RouteContext<"/api/people/[id]">) {
  const person = await getPerson((await ctx.params).id);
  return person ? Response.json(person, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "No such person" }, { status: 404 });
}

/** Changes parts of a person's story. Anyone with the link can edit (the hackathon trade-off; the page says so). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/people/[id]">) {
  const person = await getPerson((await ctx.params).id);
  if (!person) return Response.json({ error: "No such person" }, { status: 404 });
  if (person.example) return readOnly();
  const parsed = personPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "That change didn't fit" }, { status: 400 });
  return Response.json(await savePerson({ ...person, ...parsed.data }));
}

/** `?scope=device` takes them off this device's list; otherwise deletes their story for everyone. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/people/[id]">) {
  const { id } = await ctx.params;
  const person = await getPerson(id);
  if (!person) return Response.json({ error: "No such person" }, { status: 404 });
  if (person.example) return readOnly();
  if (new URL(request.url).searchParams.get("scope") === "device") await unlinkDevice(deviceId(request.headers.get("cookie")), id);
  else await (await db()).query("DELETE FROM people WHERE id = $1", [id]);
  return new Response(null, { status: 204 });
}
