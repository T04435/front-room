import { KitApp } from "@/components/kit-app";
import type { Brief } from "@/lib/kit";
import { getKit } from "@/server/kits";

export const dynamic = "force-dynamic";

/** The one-off kit builder (the MVP flow, kept for share links). `?from=<kit>&avoid=…`: rebuild that kit's brief without the items the family marked "not for them". */
export default async function Home({ searchParams }: PageProps<"/quick">) {
  const { from, avoid } = await searchParams;
  const kit = typeof from === "string" ? await getKit(from).catch(() => null) : null;
  const marks = (Array.isArray(avoid) ? avoid : avoid ? [avoid] : []).map((a) => a.slice(0, 120));
  const start: Brief | undefined = kit
    ? { name: kit.brief.name, birthYear: kit.brief.birthYear, place: kit.brief.place, likes: kit.brief.likes, avoid: [...new Set([...(kit.brief.avoid ?? []), ...marks])].slice(-30) }
    : undefined;
  return <KitApp start={start} />;
}
