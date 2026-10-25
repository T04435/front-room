import "server-only";
import { createTransport, type CallLog, type QlooParams, type Result, type Transport } from "@/lib/qloo-transport";
import { env, offline } from "@/server/env";
import { fixtureTransport } from "./fixtures";

export { QlooError, type CallLog } from "@/lib/qloo-transport";

let transport: Transport | null = null;

/** The app's one Qloo client: NotOnQ first, Qloo directly on any NotOnQ error or after 4 s (src/lib/qloo-transport.ts). */
function client(): Transport {
  if (offline()) return fixtureTransport;
  transport ??= createTransport({
    qloo: env.QLOO_API_KEY ? { baseUrl: env.QLOO_API_BASE_URL, apiKey: env.QLOO_API_KEY } : undefined,
    notonq:
      env.NOTONQ_DISABLED !== "1" && (env.NOTONQ_API_KEY || env.QLOO_API_KEY)
        ? { baseUrl: env.NOTONQ_BASE_URL, apiKey: (env.NOTONQ_API_KEY || env.QLOO_API_KEY)! }
        : undefined,
    appLabel: env.VERCEL_ENV === "production" ? "music-care" : "music-care-dev",
  });
  return transport;
}

export function qlooGet<T>(path: string, params: QlooParams, onCall?: (log: CallLog) => void): Promise<Result<T>> {
  return client().get<T>(path, params, onCall);
}
