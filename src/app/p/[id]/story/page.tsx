import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryChat } from "@/components/story-chat";
import { APP_NAME } from "@/lib/app";
import { playStats, provenCalm } from "@/lib/learning";
import { getPerson, personPlays } from "@/server/people";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/p/[id]/story">): Promise<Metadata> {
  const person = await getPerson((await params).id).catch(() => null);
  const name = person?.preferredName || "Their";
  const found = Object.entries(person?.suggestions ?? {}).some(([k, cs]) => k !== "new-tries" && cs.length);
  return { title: `${found ? `Get to know ${name} better` : `${name}’s story`} · ${APP_NAME}`, robots: { index: false } };
}

/** Get to know them better: the same chat, opening with what's known and what would help next. `?find=1` looks things up. */
export default async function StoryPage({ params, searchParams }: PageProps<"/p/[id]/story">) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();
  const stats = playStats(await personPlays(id), person.resolvedUpsets);
  const paused = [...stats.values()].filter((s) => s.state === "paused").map((s) => ({ key: s.key, title: s.title, lastUpsetAt: s.lastUpsetAt }));
  return <StoryChat initial={person} paused={paused} provenCalm={provenCalm(stats).length} autoFind={(await searchParams).find === "1"} />;
}
