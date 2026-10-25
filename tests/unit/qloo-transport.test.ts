import { describe, expect, it } from "vitest";
import { createTransport, queryString, type CallLog } from "@/lib/qloo-transport";

const NOTONQ = { baseUrl: "https://notonq.test/q/app/front-room-dev", apiKey: "q-key" };
const QLOO = { baseUrl: "https://qloo.test", apiKey: "q-key" };

type Seen = { url: string; key: string | null };

/** A fake fetch: answers by host, records every call. */
function fakeFetch(answers: Record<string, () => Promise<Response> | Response>) {
  const seen: Seen[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    seen.push({ url, key: headers.get("X-Api-Key") });
    const host = new URL(url).host;
    const answer = answers[host];
    if (!answer) throw new TypeError("fetch failed");
    return answer();
  }) as typeof globalThis.fetch;
  return { fetch, seen };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const noSleep = async () => {};

describe("the Qloo transport", () => {
  it("sends every call through NotOnQ first, named in the base URL, with the Qloo key", async () => {
    const { fetch, seen } = fakeFetch({ "notonq.test": () => json({ results: { entities: [{ name: "The Kinks" }] } }) });
    const t = createTransport({ notonq: NOTONQ, qloo: QLOO, fetch, sleep: noSleep });
    const logs: CallLog[] = [];
    const r = await t.get<{ results: unknown }>("/v2/insights", { "filter.type": "urn:entity:artist" }, (l) => logs.push(l));
    expect(r.via).toBe("notonq");
    expect(seen).toEqual([{ url: "https://notonq.test/q/app/front-room-dev/v2/insights?filter.type=urn%3Aentity%3Aartist", key: "q-key" }]);
    expect(logs[0]).toMatchObject({ via: "notonq", fellBack: false, cached: false });
  });

  it("falls back to Qloo with Qloo's key when NotOnQ errors", async () => {
    const { fetch, seen } = fakeFetch({ "notonq.test": () => json({ message: "down" }, 502), "qloo.test": () => json({ ok: true }) });
    const t = createTransport({ notonq: NOTONQ, qloo: QLOO, fetch, sleep: noSleep });
    const logs: CallLog[] = [];
    const r = await t.get("/search", { query: "Manchester" }, (l) => logs.push(l));
    expect(r).toEqual({ data: { ok: true }, via: "qloo", servedBy: "qloo" });
    expect(seen.map((s) => [new URL(s.url).host, s.key])).toEqual([
      ["notonq.test", "q-key"],
      ["qloo.test", "q-key"],
    ]);
    expect(logs[0]).toMatchObject({ via: "qloo", fellBack: true });
    expect(logs[0].reason).toContain("NotOnQ returned 502");
  });

  it("falls back when NotOnQ is unreachable", async () => {
    const { fetch } = fakeFetch({ "qloo.test": () => json({ ok: 1 }) });
    const t = createTransport({ notonq: NOTONQ, qloo: QLOO, fetch, sleep: noSleep });
    const logs: CallLog[] = [];
    expect((await t.get("/search", { query: "x" }, (l) => logs.push(l))).via).toBe("qloo");
    expect(logs[0].reason).toBe("NotOnQ couldn't be reached");
  });

  it("falls back when NotOnQ takes longer than its budget", async () => {
    const slow = () =>
      new Promise<Response>((_, reject) => {
        setTimeout(() => reject(Object.assign(new Error("timed out"), { name: "TimeoutError" })), 30);
      });
    const { fetch } = fakeFetch({ "notonq.test": slow, "qloo.test": () => json({ ok: 2 }) });
    const t = createTransport({ notonq: NOTONQ, qloo: QLOO, fetch, sleep: noSleep, notonqTimeoutMs: 10 });
    const logs: CallLog[] = [];
    expect((await t.get("/search", { query: "y" }, (l) => logs.push(l))).data).toEqual({ ok: 2 });
    expect(logs[0]).toMatchObject({ fellBack: true });
  });

  it("knows when NotOnQ filled a gap itself, from its served-by header", async () => {
    const filled = () => new Response(JSON.stringify({ results: [] }), { headers: { "X-NotOnQ-Served-By": "notonq" } });
    const { fetch } = fakeFetch({ "notonq.test": filled });
    const t = createTransport({ notonq: NOTONQ, qloo: QLOO, fetch, sleep: noSleep });
    const logs: CallLog[] = [];
    expect((await t.get("/search", { query: "a local singer" }, (l) => logs.push(l))).servedBy).toBe("notonq");
    expect(logs[0]).toMatchObject({ via: "notonq", servedBy: "notonq" });
  });

  it("goes straight to Qloo when no NotOnQ key is set", async () => {
    const { fetch, seen } = fakeFetch({ "qloo.test": () => json({ ok: 3 }) });
    const t = createTransport({ qloo: QLOO, fetch, sleep: noSleep });
    const logs: CallLog[] = [];
    await t.get("/search", { query: "z" }, (l) => logs.push(l));
    expect(seen).toHaveLength(1);
    expect(logs[0]).toMatchObject({ via: "qloo", fellBack: false });
  });

  it("retries Qloo once on a 5xx, and reports a 4xx without retrying", async () => {
    let n = 0;
    const { fetch } = fakeFetch({ "qloo.test": () => (++n === 1 ? json({}, 503) : json({ ok: n })) });
    const t = createTransport({ qloo: QLOO, fetch, sleep: noSleep });
    expect((await t.get("/a", {})).data).toEqual({ ok: 2 });

    const bad = fakeFetch({ "qloo.test": () => json({ message: "bad" }, 400) });
    const t2 = createTransport({ qloo: QLOO, fetch: bad.fetch, sleep: noSleep });
    await expect(t2.get("/b", {})).rejects.toMatchObject({ status: 400 });
    expect(bad.seen).toHaveLength(1);
  });

  it("caches an answer by path and params, but not a failure", async () => {
    let n = 0;
    const { fetch, seen } = fakeFetch({ "qloo.test": () => (++n === 1 ? json({}, 400) : json({ n })) });
    const t = createTransport({ qloo: QLOO, fetch, sleep: noSleep });
    await expect(t.get("/c", { b: 2, a: 1 })).rejects.toBeTruthy();
    await t.get("/c", { a: 1, b: 2 });
    const logs: CallLog[] = [];
    await t.get("/c", { b: 2, a: 1 }, (l) => logs.push(l));
    expect(seen).toHaveLength(2);
    expect(logs[0]).toMatchObject({ cached: true });
  });

  it("orders params and drops empty ones", () => {
    expect(queryString({ z: 1, a: "x", e: "", u: undefined })).toBe("a=x&z=1");
  });
});
