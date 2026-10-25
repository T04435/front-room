import { providerStatus } from "@/server/env";

/** Booleans only: whether each provider is configured, and whether this server is in offline (test) mode. */
export function GET() {
  return Response.json({ ok: true, ...providerStatus() }, { headers: { "Cache-Control": "no-store" } });
}
