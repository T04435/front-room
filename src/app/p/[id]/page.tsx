import { BookHeart, ClipboardList, MessageSquareText, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLink, GoalButtons } from "@/components/person-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { APP_NAME } from "@/lib/app";
import { DEVICE_COOKIE } from "@/lib/device";
import { GOAL_LABELS } from "@/lib/learning";
import { birthYearOf, completeness, missingMinimum } from "@/lib/person";
import { getPerson, linkDevice, personKits, personLogs } from "@/server/people";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const person = await getPerson((await params).id).catch(() => null);
  return { title: `${person?.preferredName ?? "Not found"} · ${APP_NAME}`, robots: { index: false } };
}

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: process.env.FRONT_ROOM_TIME_ZONE || "Europe/London" });

/** A person's page: their story at a glance, and every step from here (continue the story, suggestions, a session, What works). */
export default async function PersonPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();
  // Opening a person's link adds them to this device's list.
  await linkDevice((await cookies()).get(DEVICE_COOKIE)?.value ?? null, id).catch(() => {});
  const [kits, logs] = await Promise.all([personKits(id), personLogs(id)]);
  const missing = missingMinimum(person);
  const born = birthYearOf(person);
  const ro = Boolean(person.example);
  const decks = Object.values(person.suggestions).flat();

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold">{person.preferredName}</h1>
          {ro && <Badge variant="secondary">Example · read-only</Badge>}
          <Badge variant="outline">Story {completeness(person)}%</Badge>
        </div>
        <p className="text-muted-foreground">
          {[born ? (person.birthYear ? `Born ${person.birthYear}` : `Born in the ${person.decade}s`) : null, person.places.map((p) => `${p.name}${p.fromYear ? ` ${p.fromYear}–${p.toYear ?? "now"}` : ""}`).join(" · ") || null]
            .filter(Boolean)
            .join(" · ") || "Nothing in their story yet."}
        </p>
        {ro ? (
          <Alert>
            <AlertDescription>A fictional person with five past sessions, so you can see the learning. Read-only: try your own to change a story or log a session.</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <CopyLink path={`/p/${id}`} /> Anyone with this link can see and edit {person.preferredName}&apos;s story.
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="size-4" aria-hidden /> Their story
            </CardTitle>
            <CardDescription>
              {person.places.length} places · {person.moments.length} moments · {person.loves.length} loves · {person.steers.length} steer-clears
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant={missing.length ? "default" : "outline"} size="sm">
              <Link href={`/p/${id}/story`}>{ro ? "Read the story" : missing.length || !person.places.length ? "Tell their story" : "Add to their story"}</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" aria-hidden /> Ring a bell?
            </CardTitle>
            <CardDescription>{decks.length ? `${decks.filter((s) => s.answer).length} of ${decks.length} suggestions answered` : "Qloo's songs, films and places for their years, once the story has the basics."}</CardDescription>
          </CardHeader>
          <CardContent>
            {missing.length ? (
              <p className="text-xs text-muted-foreground">Needs {missing.map((m) => ({ preferredName: "their name", birthYear: "a birth year", place: "a place" })[m]).join(", ")}.</p>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={`/p/${id}/bell`}>{decks.length ? "Open suggestions" : "Go for it"}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4" aria-hidden /> What works
            </CardTitle>
            <CardDescription>The handover card: what works, what to steer clear of, how to settle them.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href={`/p/${id}/works`}>Open What works</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-3" aria-labelledby="session">
        <h2 id="session" className="text-xl font-semibold">
          Start a session
        </h2>
        {missing.length ? (
          <p className="text-sm text-muted-foreground">Their story needs {missing.map((m) => ({ preferredName: "their name", birthYear: "a birth year or decade", place: "one place" })[m]).join(" and ")} first.</p>
        ) : (
          <GoalButtons personId={id} disabled={ro} />
        )}
        {ro && <p className="text-sm text-muted-foreground">The example&apos;s sessions are below. Its next session is on What works.</p>}
      </section>

      <section className="grid gap-3" aria-labelledby="past">
        <h2 id="past" className="flex items-center gap-2 text-xl font-semibold">
          <BookHeart className="size-5" aria-hidden /> Past sessions
        </h2>
        {kits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          <ItemGroup className="gap-2">
            {[...kits].reverse().map((k) => {
              const n = logs.filter((l) => l.kitId === k.id && l.response !== "none").length;
              return (
                <Item key={k.id} variant="outline" asChild>
                  <Link href={`/kits/${k.id}`}>
                    <ItemContent>
                      <ItemTitle>
                        {k.goal ? GOAL_LABELS[k.goal] : "Session"} · {when(k.createdAt)}
                      </ItemTitle>
                      <ItemDescription>
                        {k.items.filter((i) => i.type === "song").length} songs · {n} {n === 1 ? "response" : "responses"} logged
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <span className="text-sm text-muted-foreground">Open →</span>
                    </ItemActions>
                  </Link>
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </section>
    </div>
  );
}
