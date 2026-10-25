import { Check, ClipboardList, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GoalButtons } from "@/components/person-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/lib/app";
import { careNote } from "@/lib/care-note";
import { GOAL_LABELS, itemStats, provenCalm, topProven } from "@/lib/learning";
import { missingMinimum } from "@/lib/person";
import { getPerson, personKits, personLogs } from "@/server/people";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/p/[id]/works">): Promise<Metadata> {
  const person = await getPerson((await params).id).catch(() => null);
  return { title: `What works · ${person?.preferredName ?? ""} · ${APP_NAME}`, robots: { index: false } };
}

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null);

/**
 * What works (v2 brief, P0 7): the handover card, readable in 30 seconds by an agency worker at 18:00. The preferred
 * name, the top things that work, steer-clears, how to settle them, hearing and headphones, and the last session, each
 * line dated.
 */
export default async function WorksPage({ params }: PageProps<"/p/[id]/works">) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();
  const [kits, logs] = await Promise.all([personKits(id), personLogs(id)]);
  const stats = itemStats(kits, logs, person.resolvedUpsets);
  const works = topProven(stats);
  const settles = provenCalm(stats).slice(0, 2);
  const paused = [...stats.values()].filter((s) => s.state === "paused");
  const resting = [...stats.values()].filter((s) => s.state === "resting");
  const last = kits.at(-1);
  const lastLogs = last ? logs.filter((l) => l.kitId === last.id) : [];
  const note = last ? careNote(last, lastLogs, last.createdAt, lastLogs.at(-1)?.at ?? last.createdAt) : null;
  const p = person.practical;
  const talks = person.moments.slice(0, 2);

  return (
    <div className="grid max-w-2xl gap-5">
      <div className="grid gap-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <ClipboardList className="size-6" aria-hidden /> What works
        </h1>
        <p className="text-lg">
          {person.preferredName}
          {p.greeting ? <span className="text-muted-foreground"> · {p.greeting}</span> : null}
        </p>
        <p className="text-sm text-muted-foreground">
          {kits.length} {kits.length === 1 ? "session" : "sessions"} logged{last ? ` · last ${day(last.createdAt)}` : ""}. Each line says when it was last confirmed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Works</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {works.length === 0 && talks.length === 0 && <p className="text-sm text-muted-foreground">Nothing proven yet. Two good sessions with the same song, and it shows here.</p>}
          {works.map((s) => (
            <p key={s.key} className="flex gap-2">
              <Check className="mt-1 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span>
                {s.title}
                {s.by ? ` (${s.by})` : ""}: {s.sangSessions >= 2 ? "sings along" : "engages"} <span className="text-xs text-muted-foreground">· {s.label.replace("Proven · ", "")}, last {day(s.lastAt)}</span>
              </span>
            </p>
          ))}
          {talks.map((m) => (
            <p key={m.id} className="flex gap-2">
              <Check className="mt-1 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span>
                Talking about: {m.label}
                {m.year ? ` (${m.year})` : ""} <span className="text-xs text-muted-foreground">· from the family</span>
              </span>
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Steer clear</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {person.steers.length === 0 && paused.length === 0 && <p className="text-sm text-muted-foreground">{person.steerAsked ? "Nothing flagged by the family." : "Not asked yet: ask the family in the story chat."}</p>}
          {person.steers.map((s) => (
            <p key={s.id} className="flex gap-2">
              <X className="mt-1 size-4 shrink-0 text-destructive" aria-hidden />
              <span>
                {s.label} ({s.level === "never" ? "never" : "sad but OK"}) <span className="text-xs text-muted-foreground">· {s.source === "logged" ? "after a session" : "the family"}, {day(s.at)}</span>
              </span>
            </p>
          ))}
          {paused.map((s) => (
            <p key={s.key} className="flex gap-2">
              <X className="mt-1 size-4 shrink-0 text-destructive" aria-hidden />
              <span>
                {s.title}: paused <span className="text-xs text-muted-foreground">· upset on {day(s.lastUpsetAt)}; the family is asked in the story chat</span>
              </span>
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to settle {person.preferredName}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {settles.map((s) => (
            <p key={s.key}>
              {s.title}
              {s.by ? ` (${s.by})` : ""} settles them <span className="text-xs text-muted-foreground">· calm in {s.calmSessions} sessions, last {day(s.lastAt)}</span>
            </p>
          ))}
          {p.calms && (
            <p>
              {p.calms} <span className="text-xs text-muted-foreground">· the family</span>
            </p>
          )}
          {p.bestTime && <p>Best time: {p.bestTime}</p>}
          {!settles.length && !p.calms && <p className="text-sm text-muted-foreground">Not known yet. Settle sessions and the story chat fill this in.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Good to know</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1">
          {p.hearing && <p>{p.hearing}</p>}
          {p.headphonesOk !== undefined && p.headphonesOk !== null && <p>{p.headphonesOk ? "Headphones are fine." : "No headphones."}</p>}
          {p.work && <p>Work: {p.work}</p>}
          {p.faith && <p>{p.faith.stance === "keep_out" ? "Keep faith out of sessions." : p.faith.stance === "yes" ? `Faith: ${p.faith.label ?? "yes"}` : "No faith in sessions."}</p>}
          {resting.length > 0 && <p className="text-sm text-muted-foreground">Resting for a month (no reaction three times): {resting.map((s) => s.title).join(", ")}.</p>}
          {!p.hearing && p.headphonesOk == null && !p.work && !p.faith && !resting.length && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
        </CardContent>
      </Card>

      {last && note && (
        <Card>
          <CardHeader>
            <CardTitle>Last session</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p>{note}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{last.goal ? GOAL_LABELS[last.goal] : "Session"}</Badge>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/kits/${last.id}`}>Open it</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {missingMinimum(person).length === 0 && (
        <section className="grid gap-2">
          <h2 className="text-xl font-semibold">{person.example ? "Their next session (a preview)" : "Start a session"}</h2>
          {person.example ? (
            <div className="flex flex-wrap gap-2">
              {(["settle", "chat", "sing"] as const).map((g) => (
                <Button key={g} asChild variant={g === "chat" ? "default" : "outline"}>
                  <Link href={`/p/${id}/session?goal=${g}`}>{GOAL_LABELS[g]} preview</Link>
                </Button>
              ))}
            </div>
          ) : (
            <GoalButtons personId={id} />
          )}
        </section>
      )}
    </div>
  );
}
