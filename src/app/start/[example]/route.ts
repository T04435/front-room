import { exampleById } from "@/lib/examples";
import { emptyPerson } from "@/lib/person";
import { deviceId } from "@/server/limits";
import { linkDevice, newPersonId, savePerson } from "@/server/people";

/**
 * One tap from the landing page: a fictional example person (the family telling it, agreed), straight into their chat
 * with the story waiting in the box. A POST (a form), so nothing is created by a link prefetch.
 */
export async function POST(request: Request, ctx: RouteContext<"/start/[example]">) {
  const example = exampleById((await ctx.params).example);
  if (!example) return Response.redirect(new URL("/people/new", request.url), 303);
  const person = await savePerson(emptyPerson(newPersonId(), example.name, { by: "family", basis: "agreed", at: new Date().toISOString() }));
  await linkDevice(deviceId(request.headers.get("cookie")), person.id);
  return Response.redirect(new URL(`/p/${person.id}/story?example=${example.id}`, request.url), 303);
}
