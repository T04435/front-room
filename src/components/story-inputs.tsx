"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const THIS_YEAR = new Date().getFullYear();

/** A year, typed or nudged, with an optional row of choices ("Still there", "Not sure", decades). */
export function YearInput({
  id,
  label,
  value,
  onSave,
  choices = [],
  min = 1900,
  max = THIS_YEAR,
}: {
  id: string;
  label: string;
  value: number | null;
  onSave: (year: number | null, choice?: string) => void;
  choices?: { label: string; value: number | null; choice?: string }[];
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  const n = Number(text);
  const ok = /^\d{4}$/.test(text) && n >= min && n <= max;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input id={id} inputMode="numeric" className="w-32" placeholder="e.g. 1950" value={text} onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        <Button type="button" size="sm" disabled={!ok} onClick={() => onSave(n)}>
          Save
        </Button>
        {choices.map((c) => (
          <Button key={c.label} type="button" size="sm" variant="outline" onClick={() => onSave(c.value, c.choice)}>
            {c.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** A town or city, found with Qloo's locality search (no map). Typing a name that isn't found still works. */
export function PlaceSearch({ id, label, onPick }: { id: string; label: string; onPick: (place: { name: string; label?: string }) => void }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<{ status: "idle" | "searching" | "done" | "error"; results: { name: string; label: string }[]; message?: string }>({ status: "idle", results: [] });

  async function search() {
    const query = q.trim();
    if (query.length < 2) return;
    setState({ status: "searching", results: [] });
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
      const body = (await res.json()) as { name: string; label: string }[] | { error: string };
      if (!res.ok || !Array.isArray(body)) throw new Error("error" in body ? body.error : "Place search isn't answering.");
      setState({ status: "done", results: body });
    } catch (e) {
      setState({ status: "error", results: [], message: e instanceof Error ? e.message : "Place search isn't answering." });
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          placeholder="A town or city, then Enter"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          className="sm:w-80"
        />
        <Button type="button" variant="outline" size="icon" aria-label="Search places" onClick={() => void search()}>
          <Search aria-hidden />
        </Button>
      </div>
      {state.status === "searching" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Looking it up…
        </p>
      )}
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "done" && (
        <div className="flex flex-wrap gap-2">
          {state.results.map((r) => (
            <Button key={r.label} type="button" size="sm" variant="outline" onClick={() => onPick(r)}>
              {r.label}
            </Button>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => onPick({ name: q.trim() })}>
            {state.results.length ? `None of these: use “${q.trim()}”` : `Not found: use “${q.trim()}” anyway`}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Steer clear of something in sessions: Never, Sad but OK, or No need. Only the label is kept. */
export function SteerQuestion({ question, onAnswer, noNeed = "No need" }: { question: string; onAnswer: (level: "never" | "sad_ok" | "no_need") => void; noNeed?: string }) {
  return (
    <div className="grid gap-2">
      <p className="font-medium">{question}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => onAnswer("never")}>
          Never
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onAnswer("sad_ok")}>
          Sad but OK
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onAnswer("no_need")}>
          {noNeed}
        </Button>
      </div>
    </div>
  );
}

/** Free text with a Save button (work, faith, hearing, a moment). */
export function TextInput({ id, label, placeholder, onSave, multiline }: { id: string; label: string; placeholder?: string; onSave: (text: string) => void; multiline?: boolean }) {
  const [v, setV] = useState("");
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {multiline ? (
          <textarea id={id} className="min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} maxLength={200} />
        ) : (
          <Input id={id} className="sm:w-80" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} maxLength={200} />
        )}
        <Button
          type="button"
          size="sm"
          disabled={v.trim().length < 2}
          onClick={() => {
            onSave(v.trim());
            setV("");
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
