/**
 * The one way to Qloo: NotOnQ's drop-in API first (same paths and shapes as Qloo), and Qloo itself as the safety net.
 * - With a NotOnQ endpoint configured, a call goes there with a short budget. Any error, non-2xx or timeout retries the
 *   same request directly against Qloo, and the call is marked `via: "qloo", fellBack: true`.
 * - Without one, calls go straight to Qloo (`via: "qloo", fellBack: false`).
 * - Answers are cached in memory by path and params (a failure is not); calls to Qloo are paced, since the hackathon key
 *   allows 5 requests/s and is shared with the other entries.
 * Pure (fetch and clock injected), so the fallback is unit-tested without a network.
 */

export type QlooParams = Record<string, string | number | boolean | undefined>;
export type Via = "notonq" | "qloo";

export type CallLog = {
  path: string;
  params: QlooParams;
  ms: number;
  cached: boolean;
  status: number;
  via: Via;
  /** NotOnQ failed (the reason says how) and Qloo answered instead. */
  fellBack: boolean;
  reason?: string;
};

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

type Endpoint = { baseUrl: string; apiKey: string };

export type TransportOptions = {
  notonq?: Endpoint;
  qloo?: Endpoint;
  fetch?: typeof fetch;
  /** NotOnQ's budget before falling back. Qloo answers most era calls in 1–3 s, so 4 s. */
  notonqTimeoutMs?: number;
  qlooTimeoutMs?: number;
  minGapMs?: number;
  cacheTtlMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type Result<T> = { data: T; via: Via };

export type Transport = {
  get<T>(path: string, params: QlooParams, onCall?: (log: CallLog) => void): Promise<Result<T>>;
};

export function queryString(params: QlooParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b))) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.toString();
}

export function createTransport(options: TransportOptions): Transport {
  const doFetch = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const notonqTimeout = options.notonqTimeoutMs ?? 4_000;
  const qlooTimeout = options.qlooTimeoutMs ?? 20_000;
  const minGap = options.minGapMs ?? 220;
  const ttl = options.cacheTtlMs ?? 24 * 60 * 60 * 1000;
  const cache = new Map<string, { at: number; value: Promise<Result<unknown>> }>();
  let nextSlot = 0;

  async function paced() {
    const t = now();
    const at = Math.max(t, nextSlot);
    nextSlot = at + minGap;
    if (at > t) await sleep(at - t);
  }

  async function call(endpoint: Endpoint, url: string, timeoutMs: number): Promise<unknown> {
    let response: Response;
    try {
      response = await doFetch(url, {
        headers: { "X-Api-Key": endpoint.apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new QlooError(timedOut ? `took longer than ${Math.round(timeoutMs / 1000)} s` : "couldn't be reached", 0);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new QlooError(`returned ${response.status}${body ? `: ${body.slice(0, 160)}` : ""}`, response.status);
    }
    return response.json();
  }

  async function direct(path: string, query: string, attempt = 0): Promise<unknown> {
    if (!options.qloo) throw new QlooError("Qloo isn't configured (QLOO_API_KEY)", 0);
    await paced();
    try {
      return await call(options.qloo, `${options.qloo.baseUrl}${path}?${query}`, qlooTimeout);
    } catch (error) {
      const retryable = error instanceof QlooError && (error.status === 0 || error.status >= 500);
      if (retryable && attempt === 0) return direct(path, query, 1);
      throw error instanceof QlooError ? new QlooError(`Qloo ${error.message}`, error.status) : error;
    }
  }

  async function fetchOnce(path: string, query: string, log: Partial<CallLog>): Promise<Result<unknown>> {
    if (options.notonq) {
      try {
        const data = await call(options.notonq, `${options.notonq.baseUrl}${path}?${query}`, notonqTimeout);
        log.via = "notonq";
        return { data, via: "notonq" };
      } catch (error) {
        if (!options.qloo) throw error instanceof QlooError ? new QlooError(`NotOnQ ${error.message}`, error.status) : error;
        log.fellBack = true;
        log.reason = `NotOnQ ${error instanceof Error ? error.message : "failed"}`;
      }
    }
    const data = await direct(path, query);
    log.via = "qloo";
    return { data, via: "qloo" };
  }

  return {
    async get<T>(path: string, params: QlooParams, onCall?: (log: CallLog) => void): Promise<Result<T>> {
      const query = queryString(params);
      const key = `${path}?${query}`;
      const hit = cache.get(key);
      if (hit && now() - hit.at < ttl) {
        const value = await hit.value;
        onCall?.({ path, params, ms: 0, cached: true, status: 200, via: value.via, fellBack: false });
        return value as Result<T>;
      }
      const started = now();
      const log: Partial<CallLog> = { fellBack: false };
      const value = fetchOnce(path, query, log);
      cache.set(key, { at: started, value });
      try {
        const result = await value;
        onCall?.({ path, params, ms: now() - started, cached: false, status: 200, via: result.via, fellBack: log.fellBack ?? false, reason: log.reason });
        return result as Result<T>;
      } catch (error) {
        cache.delete(key);
        onCall?.({
          path,
          params,
          ms: now() - started,
          cached: false,
          status: error instanceof QlooError ? error.status : 0,
          via: log.via ?? "qloo",
          fellBack: log.fellBack ?? false,
          reason: log.reason,
        });
        throw error;
      }
    },
  };
}
