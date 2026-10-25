import { Info, Plus } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { DEVICE_COOKIE } from "@/lib/device";
import { listPeople } from "@/server/people";

export const dynamic = "force-dynamic";

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** People: the people this device looks after (created here, or opened from their link), and the example Margaret. */
export default async function PeoplePage() {
  const people = await listPeople((await cookies()).get(DEVICE_COOKIE)?.value ?? null).catch(() => []);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold">People</h1>
          <p className="text-muted-foreground">The people this device looks after. Anyone with a person&apos;s link can add to their story.</p>
        </div>
        <Button asChild>
          <Link href="/people/new">
            <Plus aria-hidden /> Add someone
          </Link>
        </Button>
      </div>
      <Alert>
        <Info />
        <AlertDescription>Use a fictional person for this demo. Front Room keeps no surname, address, diagnosis or medication.</AlertDescription>
      </Alert>
      <ItemGroup className="gap-2">
        {people.map((p) => (
          <Item key={p.id} variant={p.example ? "muted" : "outline"} asChild>
            <Link href={`/p/${p.id}`}>
              <ItemContent>
                <ItemTitle>
                  {p.example ? `Example: ${p.preferredName}` : p.preferredName}
                  {p.example && <Badge variant="secondary">Read-only</Badge>}
                </ItemTitle>
                <ItemDescription>
                  Story {p.completeness}% · {p.sessions ? `played for on ${p.sessions} ${p.sessions === 1 ? "day" : "days"}, last ${ago(p.lastSession!)}` : p.ready ? "gallery ready, nothing played yet" : "story in progress"}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <span className="text-sm text-muted-foreground">{p.example ? "Open" : p.ready ? "Play something" : "Continue the story"} →</span>
              </ItemActions>
            </Link>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}
