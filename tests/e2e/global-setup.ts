/** Aborts the run if the server under test would call paid APIs (a real server on the port, not offline mode). */
export default async function globalSetup() {
  const res = await fetch("http://localhost:3510/api/health");
  const health = (await res.json()) as { offline?: boolean };
  if (!health.offline) throw new Error("The server on :3510 isn't in offline mode; e2e would spend real Qloo and model credit.");
}
