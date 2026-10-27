import type { RunEvent } from "@/lib/run-events";
import { missingMinimum } from "@/lib/person";
import { after } from "next/server";
import { placesToResearch, researchPerson } from "@/server/bell";
import { providerStatus } from "@/server/env";
import { addQlooCalls, perVisitor, refusalResponse, takeRun } from "@/server/limits";
import { getPerson, savePerson } from "@/server/people";

export const maxDuration = 300;

/**
 * Go for it: Qloo research per place and era, streamed as NDJSON step events, then the cards saved on the person (the
 * page reloads them). Only places whose inputs changed are researched again.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/people/[id]/research">) {
  const person = await getPerson((await ctx.params).id);
  if (!person) return Response.json({ error: "No such person" }, { status: 404 });
  if (person.example) return Response.json({ error: "The example is read-only. Try your own person." }, { status: 403 });
  if (missingMinimum(person).length) return Response.json({ error: "Their story needs a name, a birth year and one place first." }, { status: 400 });
  if (!placesToResearch(person).length) return Response.json({ error: "Nothing has changed since the last look." }, { status: 409 });
  const status = providerStatus();
  if (!status.qloo || !status.aiGateway) return Response.json({ error: "Suggestions can't be looked up right now. Try again later." }, { status: 503 });
  const refused = (await perVisitor("run", request)) ?? (await takeRun());
  if (refused) return refusalResponse(refused);

  const encoder = new TextEncoder();
  let calls = 0;
  // The page may leave once the early cards are saved ("Open the gallery now"): the songs still finish and save, so
  // the work runs on (with after()) whether or not anyone is still reading the stream.
  const out: { reader: ReadableStreamDefaultController<Uint8Array> | null } = { reader: null };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      out.reader = controller;
    },
    cancel() {
      out.reader = null;
    },
  });
  const emit = (event: RunEvent) => {
    try {
      out.reader?.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    } catch {
      out.reader = null;
    }
  };
  const job = (async () => {
    const started = Date.now();
    try {
      const next = await researchPerson(person, emit, (log) => void (!log.cached && calls++), undefined, async (early) => {
        await savePerson(early);
        emit({ type: "ready" });
      });
      await savePerson(next);
      emit({ type: "done", qlooCalls: calls, qlooCached: 0, seconds: Math.round((Date.now() - started) / 1000) });
    } catch (error) {
      console.error("research failed", error instanceof Error ? error.message : error);
      emit({ type: "error", message: "The look-up stopped part-way. Try again in a minute." });
    } finally {
      await addQlooCalls(calls).catch(() => {});
      try {
        out.reader?.close();
      } catch {}
    }
  })();
  after(() => job);
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
