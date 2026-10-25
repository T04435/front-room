"use client";

import { CircleAlert, Undo2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RESPONSE_LABELS, RESPONSES, TYPE_LABELS, type KitItem, type LogEntry, type Response } from "@/lib/kit";

const NONE = "none";

/** One tap per response (calm, engaged, sang along, upset), tied to what's on (a song, a film, a place) if picked. Undo a mis-tap. */
export function ResponseLog({ kitId, items, initial, onNow, onOnNow }: { kitId: string; items: KitItem[]; initial: LogEntry[]; onNow: string | null; onOnNow: (ref: string | null) => void }) {
  const [entries, setEntries] = useState<LogEntry[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byRef = new Map(items.map((i) => [i.ref, i]));

  async function tap(response: Response) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/kits/${kitId}/log`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response, itemRef: onNow }) });
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
        <p className="text-sm text-muted-foreground">One tap when you notice a response. Over time it shows what works for them.</p>
      </div>
      <div className="grid gap-2 sm:w-80">
        <span className="text-sm font-medium" id="on-now-label">
          On now
        </span>
        <Select value={onNow ?? NONE} onValueChange={(v) => onOnNow(v === NONE ? null : v)}>
          <SelectTrigger aria-labelledby="on-now-label" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nothing in particular</SelectItem>
            {items.map((i) => (
              <SelectItem key={i.ref} value={i.ref}>
                {i.title} · {i.by?.title ?? TYPE_LABELS[i.type]}
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
                {e.itemRef && byRef.get(e.itemRef) && <span className="text-muted-foreground">during {byRef.get(e.itemRef)!.title}</span>}
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
