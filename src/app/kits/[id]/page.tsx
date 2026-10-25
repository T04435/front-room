import { redirect } from "next/navigation";
import { getKit } from "@/server/kits";

export const dynamic = "force-dynamic";

/** v1 saved-kit links: a person's kit opens their page; any other goes to People (no sessions or kits in v2). */
export default async function KitPage({ params }: PageProps<"/kits/[id]">) {
  const kit = await getKit((await params).id).catch(() => null);
  redirect(kit?.personId ? `/p/${kit.personId}` : "/");
}
