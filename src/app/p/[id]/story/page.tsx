import { notFound } from "next/navigation";
import { StoryChat } from "@/components/story-chat";
import { itemStats, provenCalm } from "@/lib/learning";
import { getPerson, personKits, personLogs } from "@/server/people";

export const dynamic = "force-dynamic";

/** The story chat: first time, or coming back with what's known and what would help next. */
export default async function StoryPage({ params }: PageProps<"/p/[id]/story">) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();
  const stats = itemStats(await personKits(id), await personLogs(id), person.resolvedUpsets);
  const paused = [...stats.values()].filter((s) => s.state === "paused").map((s) => ({ key: s.key, title: s.title, lastUpsetAt: s.lastUpsetAt }));
  return <StoryChat initial={person} paused={paused} provenCalm={provenCalm(stats).length} />;
}
