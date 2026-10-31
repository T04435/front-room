import { localityLabel, parseSearch } from "@/lib/qloo-parse";
import { perVisitor, refusalResponse } from "@/server/limits";
import { QlooError, qlooGet } from "@/server/qloo";

/** Place search for the story chat's place input: Qloo's localities by name ("Manchester, United Kingdom"). No map. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) return Response.json([]);
  const refused = await perVisitor("chat", request);
  if (refused) return refusalResponse(refused);
  try {
    const { data } = await qlooGet("/search", { query: q, types: "urn:entity:locality", take: 6 }, () => {});
    return Response.json(parseSearch(data).map((e) => ({ name: e.name, label: localityLabel(e) })));
  } catch (error) {
    if (!(error instanceof QlooError)) throw error;
    return Response.json({ error: "Place search isn't answering. Type the town and carry on." }, { status: 502 });
  }
}
