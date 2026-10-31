import { providerStatus } from "@/server/env";
import { perVisitor, refusalResponse } from "@/server/limits";
import { getPerson } from "@/server/people";
import { READ_MAX_BYTES, READ_TYPES, readPage } from "@/server/read-page";

export const maxDuration = 120;

/**
 * Reads a photo or PDF of a "This is me" into text for the chat box. The file isn't stored, and neither is the text:
 * the family checks it, then sends it like anything they'd type.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/people/[id]/read">) {
  const person = await getPerson((await ctx.params).id);
  if (!person) return Response.json({ error: "No such person" }, { status: 404 });
  if (person.example) return Response.json({ error: "The example is read-only. Try your own person." }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a photo or PDF of the form." }, { status: 400 });
  if (!(READ_TYPES as readonly string[]).includes(file.type)) return Response.json({ error: "That needs to be a photo (JPEG, PNG, HEIC) or a PDF." }, { status: 400 });
  if (file.size > READ_MAX_BYTES) return Response.json({ error: "That file is over 4 MB. Try a smaller photo." }, { status: 413 });
  if (!providerStatus().aiGateway) return Response.json({ error: "Reading pages isn't available right now. Try typing it instead." }, { status: 503 });
  const refused = await perVisitor("chat", request);
  if (refused) return refusalResponse(refused);
  try {
    const text = await readPage(new Uint8Array(await file.arrayBuffer()), file.type, request.signal);
    if (!text || /^NOTHING TO READ/.test(text)) return Response.json({ error: "I couldn't read anything about a person on that page. Try a clearer photo." }, { status: 422 });
    return Response.json({ text: text.slice(0, 8000) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("read failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "That didn't go through. Try again, or type it in." }, { status: 502 });
  }
}
