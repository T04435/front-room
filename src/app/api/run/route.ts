import { briefSchema } from "@/lib/kit";
import type { RunEvent } from "@/lib/run-events";
import { providerStatus } from "@/server/env";
import { addQlooCalls, deviceId, perVisitor, refusalResponse, takeRun } from "@/server/limits";
import { runKit } from "@/server/run";

export const maxDuration = 300;

/** Streams a run as NDJSON: one RunEvent per line. */
export async function POST(request: Request) {
  const parsed = briefSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid details" }, { status: 400 });
  const status = providerStatus();
  if (!status.qloo || !status.aiGateway) {
    console.error("front-room not configured", { qloo: status.qloo, aiGateway: status.aiGateway });
    return Response.json({ error: "New kits can't be built right now. Saved kits still open." }, { status: 503 });
  }
  const refused = (await perVisitor("run", request)) ?? (await takeRun());
  if (refused) return refusalResponse(refused);

  const owner = deviceId(request.headers.get("cookie"));
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: RunEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runKit(parsed.data, emit, request.signal, { onQlooCalls: addQlooCalls, owner });
      } catch (error) {
        console.error("run failed", error instanceof Error ? error.message : error);
        if (!request.signal.aborted) emit({ type: "error", message: "The run failed part-way. Try again in a minute." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
