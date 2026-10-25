import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SavedKit } from "@/components/saved-kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APP_NAME } from "@/lib/app";
import { careNote } from "@/lib/care-note";
import { EXAMPLE_KIT_ID } from "@/lib/example-kit";
import { isExampleKitId } from "@/lib/example-person";
import { kitTitle } from "@/lib/kit";
import { getKit, getResponses } from "@/server/kits";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/kits/[id]">): Promise<Metadata> {
  const kit = await getKit((await params).id).catch(() => null);
  return { title: `${kit ? kitTitle(kit) : "Kit not found"} · ${APP_NAME}`, robots: { index: false } };
}

/** A saved kit, open to anyone with its link (no login), with its response log; a person's session also shows its care note. */
export default async function KitPage({ params }: PageProps<"/kits/[id]">) {
  const { id } = await params;
  const kit = await getKit(id);
  if (!kit) notFound();
  const readOnly = id === EXAMPLE_KIT_ID || isExampleKitId(id);
  const log = await getResponses(id);
  return (
    <div className="grid gap-6">
      {kit.personId && (
        <Card>
          <CardContent className="grid gap-2 pt-6">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Session · care note
            </span>
            <p>{careNote(kit, log, kit.createdAt, log.at(-1)?.at ?? kit.createdAt, process.env.FRONT_ROOM_TIME_ZONE || "Europe/London")}</p>
            <div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/p/${kit.personId}`}>Back to {kit.brief.name ?? "them"}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {/* The examples are read-only: no response log. */}
      <SavedKit kit={kit} log={readOnly ? undefined : log} />
    </div>
  );
}
