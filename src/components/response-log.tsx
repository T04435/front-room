"use client";

import { CircleAlert, Undo2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RESPONSE_LABELS, RESPONSES, type LogEntry, type Response, type Track } from "@/lib/kit";

const NONE = "none";

/** One tap per response (calm, engaged, sang along, upset), tied to the track playing if one is picked. Undo a mis-tap. */
export function ResponseLog({ kitId, playlist, initial, playing, onPlaying }: { kitId: string; playlist: Track[]; initial: LogEntry[]; playing: string | null; onPlaying: (ref: string | null) => void }) {
  const [entries, setEntries] = useState<LogEntry[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byRef = new Map(playlist.map((t) => [t.ref, t]));

  async function tap(response: Response) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/kits/${kitId}/log`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response, trackRef: playing }) });
      const body = (await res.json()) as LogEntry | { error: string };
      if (!res.ok || "error" in body) throw new Error("error" in body ? body.error : `Logging returned ${res.status}`);
      setEntries((xs) => [...xs, body]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't log that");
    } finally {
      setBusy(false);
    }
  }

  async function undo(id: number) {
    setEntries((xs) => xs.filter((x) => x.id !== id));
    await fetch(`/api/kits/${kitId}/log?entry=${id}`, { method: "DELETE" }).catch(() => {});
  }

  const counts = RESPONSES.map((r) => [r, entries.filter((e) => e.response === r).length] as const);

  return (
    <section className="grid gap-4" aria-labelledby="log">
      <div className="grid gap-1">
        <h3 id="log" className="text-lg font-semibold">
          Response log
        </h3>
        <p className="text-sm text-muted-foreground">One tap when you notice a response. Over time it shows which songs work.</p>
      </div>
      <div className="grid gap-2 sm:w-80">
        <span className="text-sm font-medium" id="playing-label">
          Playing now
        </span>
        <Select value={playing ?? NONE} onValueChange={(v) => onPlaying(v === NONE ? null : v)}>
          <SelectTrigger aria-labelledby="playing-label" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No track (between songs)</SelectItem>
            {playlist.map((t) => (
              <SelectItem key={t.ref} value={t.ref}>
                {t.song} · {t.artist}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RESPONSES.map((r) => (
          <Button key={r} size="lg" variant={r === "upset" ? "destructive" : "secondary"} className="h-14 text-base" disabled={busy} onClick={() => void tap(r)}>
            {RESPONSE_LABELS[r]}
          </Button>
        ))}
      </div>
      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {entries.length > 0 && (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2" aria-label="Totals">
            {counts.map(([r, n]) => (
              <Badge key={r} variant="outline">
                {RESPONSE_LABELS[r]}: {n}
              </Badge>
            ))}
          </div>
          <ol className="grid gap-1 text-sm" aria-label="Logged responses">
            {[...entries].reverse().slice(0, 8).map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="font-medium">{RESPONSE_LABELS[e.response]}</span>
                {e.trackRef && byRef.get(e.trackRef) && <span className="text-muted-foreground">during {byRef.get(e.trackRef)!.song}</span>}
                <Button variant="ghost" size="icon-sm" aria-label={`Undo ${RESPONSE_LABELS[e.response]}`} onClick={() => void undo(e.id)}>
                  <Undo2 aria-hidden />
                </Button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
