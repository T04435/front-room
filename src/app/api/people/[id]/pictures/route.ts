import { perVisitor, refusalResponse } from "@/server/limits";
import { getPerson, savePerson } from "@/server/people";
import { addPictures, picturesDue } from "@/server/pictures";

export const maxDuration = 60;

/** Adds Qloo's pictures to a person's cards that have none, once (the gallery asks when it opens). */
export async function POST(request: Request, ctx: RouteContext<"/api/people/[id]/pictures">) {
  const person = await getPerson((await ctx.params).id);
  if (!person) return Response.json({ error: "No such person" }, { status: 404 });
  if (!picturesDue(person)) return Response.json({ changed: false });
  const refused = await perVisitor("run", request);
  if (refused) return refusalResponse(refused);
  const next = await addPictures(person);
  await savePerson(next);
  return Response.json({ changed: true });
}
