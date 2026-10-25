import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { APP_NAME } from "@/lib/app";
import { DEVICE_COOKIE } from "@/lib/device";
import { EXAMPLE_KIT, EXAMPLE_KIT_ID } from "@/lib/example-kit";
import { listKits } from "@/server/kits";

export const metadata: Metadata = { title: `Saved kits · ${APP_NAME}` };
export const dynamic = "force-dynamic";

/** This browser's saved kits. A kit's link can be shared; nobody else sees this list. */
export default async function KitsPage() {
  const owner = (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
  const kits = await listKits(owner).catch(() => []);
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Saved kits</h1>
        <p className="text-sm text-muted-foreground">Kits built in this browser. Share a kit&apos;s link with family or other staff.</p>
      </div>
      <Item variant="muted" asChild>
        <Link href={`/kits/${EXAMPLE_KIT_ID}`}>
          <ItemContent>
            <ItemTitle>
              Example: {EXAMPLE_KIT.brief.name} · {EXAMPLE_KIT.place}, {EXAMPLE_KIT.era.from}–{EXAMPLE_KIT.era.to}
            </ItemTitle>
            <ItemDescription>A real run for a fictional person, born {EXAMPLE_KIT.brief.birthYear}. Read-only.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <span className="text-sm text-muted-foreground">Open</span>
          </ItemActions>
        </Link>
      </Item>
      {kits.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No saved kits yet</EmptyTitle>
            <EmptyDescription>Build one from a birth year and a hometown. It&apos;s saved here automatically.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/">Build a kit</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ItemGroup className="gap-2">
          {kits.map((k) => (
            <Item key={k.id} variant="outline" asChild>
              <Link href={`/kits/${k.id}`}>
                <ItemContent>
                  <ItemTitle>
                    {k.title.name ? `${k.title.name} · ` : ""}
                    {k.title.place}, {k.title.from}–{k.title.to}
                  </ItemTitle>
                  <ItemDescription>
                    {k.songs} songs · {k.picks} films, TV and places · {k.responses} {k.responses === 1 ? "response" : "responses"} logged · {new Date(k.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="text-sm text-muted-foreground">Open</span>
                </ItemActions>
              </Link>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
