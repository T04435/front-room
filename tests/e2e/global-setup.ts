const BASE = "http://localhost:3510";

/**
 * Aborts the run if the server under test would call paid APIs (a real server on the port, not offline mode). Then
 * visits each page and API route once, one at a time, so the dev server compiles them before the tests race it.
 */
export default async function globalSetup() {
  const res = await fetch(`${BASE}/api/health`);
  const health = (await res.json()) as { offline?: boolean };
  if (!health.offline) throw new Error("The server on :3510 isn't in offline mode; e2e would spend real Qloo and model credit.");

  const pages = ["/", "/quick", "/kits", "/kits/example", "/people/new", "/p/margaret-x", "/p/margaret-x/story", "/p/margaret-x/works"];
  // GETs only: on POST-only routes they answer 405, which still compiles them, and change nothing.
  const routes = ["/api/version", "/api/run", "/api/people", "/api/people/margaret-x", "/api/people/margaret-x/extract", "/api/people/margaret-x/research", "/api/people/margaret-x/plays", "/api/people/margaret-x/answer", "/api/people/margaret-x/new-tries", "/api/kits/example/log"];
  for (const path of [...pages, ...routes]) await fetch(`${BASE}${path}`).catch(() => {});
}
