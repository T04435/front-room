"use client";

import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUMP_FROM_AGE, BUMP_TO_AGE, MAX_BIRTH_YEAR, MIN_BIRTH_YEAR } from "@/lib/era";
import { Slider } from "@/components/ui/slider";
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
  // The years to search: ages 15–25 unless the carer widens or shifts them (5 to 20 years).
  const [years, setYears] = useState<[number, number] | undefined>(initial?.years);
  const born = Number(f.birthYear);
  const validYear = Number.isInteger(born) && born >= MIN_BIRTH_YEAR && born <= MAX_BIRTH_YEAR;
  const range: [number, number] | null = validYear ? (years ?? [born + BUMP_FROM_AGE, born + BUMP_TO_AGE]) : null;
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (k === "birthYear") setYears(undefined);
    setF((x) => ({ ...x, [k]: e.target.value }));
  };

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
    onSubmit({ name: f.name.trim() || undefined, birthYear, place: f.place.trim(), likes: likes.length ? likes : undefined, ...(years ? { years } : {}) });
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Try the demo (a fictional person):</span>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => {
            setYears(undefined);
            setF(fieldsOf(DEMO_BRIEF));
          }}>
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
          <Input id="likes" placeholder="Singers, films, a dance hall; commas between" value={f.likes} onChange={set("likes")} maxLength={300} />
        </div>
      </div>
      {range && (
        <div className="grid gap-2 sm:w-1/2">
          <Label id="years-label">
            Years to search{" "}
            <span className="font-normal text-muted-foreground">
              (ages {range[0] - born}–{range[1] - born}: {range[0]}–{range[1]})
            </span>
          </Label>
          <Slider
            aria-labelledby="years-label"
            min={born}
            max={born + 50}
            step={1}
            minStepsBetweenThumbs={5}
            value={range}
            onValueChange={(v) => {
              if (v[1] - v[0] <= 20) setYears([v[0], v[1]]);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Drag either end for a late bloomer, or an older sibling&apos;s records.{" "}
            {years && (
              <button type="button" className="underline" onClick={() => setYears(undefined)}>
                Back to ages 15–25
              </button>
            )}
          </p>
        </div>
      )}
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
