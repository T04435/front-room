import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SavedKit } from "@/components/saved-kit";
import { APP_NAME } from "@/lib/app";
import { EXAMPLE_KIT_ID } from "@/lib/example-kit";
import { kitTitle } from "@/lib/kit";
import { getKit, getResponses } from "@/server/kits";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/kits/[id]">): Promise<Metadata> {
  const kit = await getKit((await params).id).catch(() => null);
  return { title: `${kit ? kitTitle(kit) : "Kit not found"} · ${APP_NAME}`, robots: { index: false } };
}

/** A saved kit, open to anyone with its link (no login), with its response log. */
export default async function KitPage({ params }: PageProps<"/kits/[id]">) {
  const { id } = await params;
  const kit = await getKit(id);
  if (!kit) notFound();
  // The example is read-only: no response log.
  return <SavedKit kit={kit} log={id === EXAMPLE_KIT_ID ? undefined : await getResponses(id)} />;
}
