import "server-only";
import { createTransport, type CallLog, type CallOptions, type QlooParams, type Result, type Transport } from "@/lib/qloo-transport";
import { env, offline } from "@/server/env";
import { fixtureTransport } from "./fixtures";

export { QlooError, type CallLog } from "@/lib/qloo-transport";

let transport: Transport | null = null;

/**
 * NotOnQ's base URL, naming this app in the path: NOTONQ_BASE_URL (a NotOnQ dev server, say), else NotOnQ production,
 * locally too. A local NotOnQ that isn't running meant every call went straight to Qloo, and NotOnQ's era fill for
 * places outside the UK never ran (F2).
 */
export function notonqBase(): string {
  return env.NOTONQ_BASE_URL || "https://notonq.vercel.app/q/app/front-room";
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

export function qlooGet<T>(path: string, params: QlooParams, onCall?: (log: CallLog) => void, opts?: CallOptions): Promise<Result<T>> {
  return client().get<T>(path, params, onCall, opts);
}

/** Films and TV leave out horror (Qloo's genre tag): not for a care home. */
export const NO_HORROR = "urn:tag:genre:media:horror";
