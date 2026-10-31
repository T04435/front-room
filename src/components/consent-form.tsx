"use client";

import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EXAMPLES, type Example } from "@/lib/examples";
import type { Consent } from "@/lib/person";

const BY: { value: Consent["by"]; label: string }[] = [
  { value: "family", label: "Family" },
  { value: "staff", label: "Staff" },
  { value: "self", label: "The person themselves" },
];

/**
 * Adding someone: the name they like to be called, and consent first (who is telling the story, and on what basis).
 * Front Room records the decision; it doesn't make it.
 */
export function ConsentForm({ initialExample = null }: { initialExample?: Example | null }) {
  const router = useRouter();
  // An example (a fictional person and their "This is me") still goes through consent here (A11).
  const [example, setExample] = useState<Example | null>(initialExample);
  const [name, setName] = useState(initialExample?.name ?? "");
  const [by, setBy] = useState<Consent["by"]>("family");
  const [basis, setBasis] = useState<Consent["basis"]>("agreed");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (ex: Example) => {
    setExample(ex);
    setName(ex.name);
    setError(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the name they like to be called.");
    if (basis === "best_interests" && !role.trim()) return setError("Say whose decision it is (for example, activity coordinator).");
    setBusy(true);
    setError(null);
    try {
      const consent: Consent = { by, basis, ...(basis === "best_interests" ? { role: role.trim() } : {}), at: new Date().toISOString() };
      const ex = example && name.trim() === example.name ? example : null;
      const res = await fetch("/api/people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferredName: name.trim(), consent, ...(ex ? { example: ex.id } : {}) }) });
      const body = (await res.json()) as { id?: string; told?: boolean; error?: string };
      if (!res.ok || !body.id) throw new Error(body.error ?? "Couldn't add them. Try again.");
      // An example already told on this device opens where it was left; otherwise the story waits in the chat box.
      router.push(ex ? (body.told ? `/p/${body.id}` : `/p/${body.id}/story?example=${ex.id}`) : `/p/${body.id}/story`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add them. Try again.");
      setBusy(false);
    }
  }

  return (
    // Wide screens: the examples on the left, the name and consent on the right, so the page uses its width.
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Card className="lg:row-span-4">
        <CardHeader>
          <CardTitle>No one in mind? Start from an example</CardTitle>
          <CardDescription>A fictional person and their “This is me” story, ready in the chat box. Sending it runs the real chat and look-up.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" role="group" aria-label="Examples">
          {EXAMPLES.map((ex) => (
            <Button key={ex.id} type="button" variant={example?.id === ex.id ? "default" : "outline"} aria-pressed={example?.id === ex.id} className="h-auto min-h-12 justify-start py-2 text-left whitespace-normal" disabled={busy} onClick={() => pick(ex)}>
              {ex.label}
            </Button>
          ))}
          {example && <p className="col-span-full text-sm text-muted-foreground">{example.name} is fictional. Check who is telling it below, then start their story.</p>}
        </CardContent>
      </Card>
      <div className="grid gap-2">
        <Label htmlFor="name">The name they like to be called</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Maggie" autoComplete="off" />
        <p className="text-xs text-muted-foreground">A first name or nickname. No surname.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Consent</CardTitle>
          <CardDescription>Who is telling their story, and on what basis. Front Room records the decision; it doesn&apos;t make it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label id="by-label">Who is telling it</Label>
            <ToggleGroup type="single" variant="outline" value={by} onValueChange={(v) => v && setBy(v as Consent["by"])} aria-labelledby="by-label" className="flex-wrap">
              {BY.map((b) => (
                <ToggleGroupItem key={b.value} value={b.value} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90">
                  {b.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid gap-2">
            <Label id="basis-label">The basis</Label>
            <ToggleGroup type="single" variant="outline" value={basis} onValueChange={(v) => v && setBasis(v as Consent["basis"])} aria-labelledby="basis-label" className="flex-wrap">
              <ToggleGroupItem value="agreed" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90">They agreed</ToggleGroupItem>
              <ToggleGroupItem value="best_interests" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90">In their best interests</ToggleGroupItem>
            </ToggleGroup>
          </div>
          {basis === "best_interests" && (
            <div className="grid gap-2">
              <Label htmlFor="role">Decided by (role)</Label>
              <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={60} placeholder="e.g. activity coordinator, daughter with LPA" />
            </div>
          )}
        </CardContent>
      </Card>
      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Adding…" : example && name.trim() === example.name ? `Start ${example.name}’s story` : "Start their story"}
        </Button>
      </div>
    </form>
  );
}
