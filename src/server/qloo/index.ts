import "server-only";
import { createTransport, type CallLog, type QlooParams, type Result, type Transport } from "@/lib/qloo-transport";
import { env, offline } from "@/server/env";
import { fixtureTransport } from "./fixtures";

export { QlooError, type CallLog } from "@/lib/qloo-transport";

let transport: Transport | null = null;

/**
 * NotOnQ's base URL, naming this app in the path. On Vercel (previews and production): NotOnQ production. Locally: a
 * NotOnQ dev server on :3400, so development spends no Vercel function time (if it's down, the Qloo fallback answers).
 */
export function notonqBase(): string {
  if (env.NOTONQ_BASE_URL) return env.NOTONQ_BASE_URL;
  return env.VERCEL_ENV ? "https://notonq.vercel.app/q/app/music-care" : "http://localhost:3400/q/app/music-care-dev";
}

/** The app's one Qloo client: NotOnQ first, Qloo directly on any NotOnQ error or after 4 s (src/lib/qloo-transport.ts). */
function client(): Transport {
  if (offline()) return fixtureTransport;
  transport ??= createTransport({
    qloo: env.QLOO_API_KEY ? { baseUrl: env.QLOO_API_BASE_URL, apiKey: env.QLOO_API_KEY } : undefined,
    notonq: env.NOTONQ_DISABLED !== "1" && env.QLOO_API_KEY ? { baseUrl: notonqBase(), apiKey: env.QLOO_API_KEY } : undefined,
  });
  return transport;
}

export function qlooGet<T>(path: string, params: QlooParams, onCall?: (log: CallLog) => void): Promise<Result<T>> {
  return client().get<T>(path, params, onCall);
}
