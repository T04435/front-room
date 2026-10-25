import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { GalleryView } from "@/components/gallery-view";
import { StoryChat } from "@/components/story-chat";
import { APP_NAME } from "@/lib/app";
import { DEVICE_COOKIE } from "@/lib/device";
import { galleryOf } from "@/lib/gallery";
import { playStats, provenCalm } from "@/lib/learning";
import { birthYearOf, researchInputs, researchKey } from "@/lib/person";
import { NEW_TRIES_KEY, newTriesStale } from "@/server/new-tries";
import { getPerson, linkDevice, personPlays } from "@/server/people";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const person = await getPerson((await params).id).catch(() => null);
  return { title: `${person?.preferredName ?? "Not found"} · ${APP_NAME}`, robots: { index: false } };
}

/**
 * A person's page. Once Qloo has found things for them, it's their gallery: what to play for them now. Before that,
 * it's the chat with the Go-Between, collecting their story.
 */
export default async function PersonPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();
  // Opening a person's link adds them to this device's list.
  await linkDevice((await cookies()).get(DEVICE_COOKIE)?.value ?? null, id).catch(() => {});
  const plays = await personPlays(id);
  const stats = playStats(plays, person.resolvedUpsets);
  const gallery = galleryOf(person, stats);
  // Family loves alone don't make a gallery: until a look-up has found things, the page is the chat.
  const found = Object.entries(person.suggestions).some(([k, cs]) => k !== NEW_TRIES_KEY && cs.length);
  if (!found || gallery.total === 0) {
    const paused = [...stats.values()].filter((s) => s.state === "paused").map((s) => ({ key: s.key, title: s.title, lastUpsetAt: s.lastUpsetAt }));
    return <StoryChat initial={person} paused={paused} provenCalm={provenCalm(stats).length} />;
  }
  const by = birthYearOf(person);
  const stale = by !== null && person.places.some((pl) => person.researched[researchKey(pl, by)] !== researchInputs(person, pl));
  return <GalleryView person={person} gallery={gallery} plays={plays} stale={stale} triesDue={!person.example && newTriesStale(person, stats)} />;
}
