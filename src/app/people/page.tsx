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

// Days in the home's zone, as on What works (QA-16).
const TZ = process.env.FRONT_ROOM_TIME_ZONE || "Europe/London";
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const ago = (iso: string) => {
  const d = ymd(new Date(iso));
  return d === ymd(new Date()) ? "today" : d === ymd(new Date(Date.now() - 86_400_000)) ? "yesterday" : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ });
};

/** People: the people this device looks after (created here, or opened from their link), and the example Margaret. */
export default async function PeoplePage() {
  const people = await listPeople((await cookies()).get(DEVICE_COOKIE)?.value ?? null).catch(() => []);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="font-heading text-[34px] leading-[40px]">People</h1>
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
                <ItemDescription className="line-clamp-none">
                  Story {p.completeness}% · {p.sessions ? `played on ${p.sessions} ${p.sessions === 1 ? "day" : "days"}, last ${ago(p.lastSession!)}` : p.ready ? "gallery ready, nothing played yet" : "story in progress"}
                </ItemDescription>
              </ItemContent>
              <ItemActions className="max-sm:hidden">
                <span className="text-sm text-muted-foreground">{p.example ? "Open" : p.ready ? "Play something" : "Continue the story"} →</span>
              </ItemActions>
            </Link>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}
