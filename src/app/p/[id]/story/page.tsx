import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryChat } from "@/components/story-chat";
import { APP_NAME } from "@/lib/app";
import { exampleById } from "@/lib/examples";
import { familyQuestions, playStats, provenCalm } from "@/lib/learning";
import { getPerson, personPlays } from "@/server/people";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/p/[id]/story">): Promise<Metadata> {
  const person = await getPerson((await params).id).catch(() => null);
  const name = person?.preferredName || "Their";
  const found = Object.entries(person?.suggestions ?? {}).some(([k, cs]) => k !== "new-tries" && cs.length);
  return { title: `${found ? `Tell me more about ${name}` : `${name}’s story`} · ${APP_NAME}`, robots: { index: false } };
}

/** Tell me more: the same chat, opening with what's known and what would help next. `?find=1` looks things up. */
export default async function StoryPage({ params, searchParams }: PageProps<"/p/[id]/story">) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();
  const stats = playStats(await personPlays(id), person.resolvedUpsets);
  const paused = familyQuestions(stats, person.resolvedUpsets);
  const query = await searchParams;
  // An example's story waits in the chat box, only for a person with nothing told yet.
  const example = typeof query.example === "string" && !person.places.length ? exampleById(query.example) : null;
  return <StoryChat initial={person} paused={paused} provenCalm={provenCalm(stats).length} autoFind={query.find === "1"} starter={example?.text} />;
}
