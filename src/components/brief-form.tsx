"use client";

import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_BIRTH_YEAR, MIN_BIRTH_YEAR } from "@/lib/era";
import type { Brief } from "@/lib/kit";

type Props = { initial?: Brief; busy: boolean; onSubmit: (brief: Brief) => void };

/** The demo person is fictional (no real resident in the demo). */
export const DEMO_BRIEF: Brief = { name: "Margaret", birthYear: 1950, place: "Manchester", likes: ["Dusty Springfield"] };

type Fields = { name: string; birthYear: string; place: string; likes: string };
const fieldsOf = (b?: Brief): Fields => ({ name: b?.name ?? "", birthYear: b ? String(b.birthYear) : "", place: b?.place ?? "", likes: b?.likes?.join(", ") ?? "" });

/** The two-minute input: birth year and hometown (required), a first name and known likes (optional). */
export function BriefForm({ initial, busy, onSubmit }: Props) {
  const [f, setF] = useState<Fields>(fieldsOf(initial));
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const birthYear = Number(f.birthYear);
    if (!Number.isInteger(birthYear) || birthYear < MIN_BIRTH_YEAR || birthYear > MAX_BIRTH_YEAR) {
      setError(`Give a birth year between ${MIN_BIRTH_YEAR} and ${MAX_BIRTH_YEAR}.`);
      return;
    }
    if (f.place.trim().length < 2) {
      setError("Say where they grew up: a town or city.");
      return;
    }
    setError(null);
    const likes = f.likes
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length >= 2)
      .slice(0, 5);
    onSubmit({ name: f.name.trim() || undefined, birthYear, place: f.place.trim(), likes: likes.length ? likes : undefined });
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Try the demo (a fictional person):</span>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setF(fieldsOf(DEMO_BRIEF))}>
          Margaret, born 1950, Manchester
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="birthYear">Birth year</Label>
          <Input id="birthYear" inputMode="numeric" placeholder="e.g. 1950" value={f.birthYear} onChange={set("birthYear")} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="place">Where they grew up</Label>
          <Input id="place" placeholder="A town or city, e.g. Manchester" value={f.place} onChange={set("place")} maxLength={80} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="name">
            First name <span className="font-normal text-muted-foreground">(optional, for the kit&apos;s title)</span>
          </Label>
          <Input id="name" placeholder="e.g. Margaret" value={f.name} onChange={set("name")} maxLength={40} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="likes">
            Anything you know they loved <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="likes" placeholder="Singers, bands, films; commas between" value={f.likes} onChange={set("likes")} maxLength={300} />
        </div>
      </div>
      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Working it out…" : "Build the session kit"}
        </Button>
      </div>
    </form>
  );
}
