"use client";

import { InlineCitationCard, InlineCitationCardBody, InlineCitationSource } from "@/components/ai-elements/inline-citation";
import { Badge } from "@/components/ui/badge";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import { partsOf, TYPE_LABELS, type KitItem } from "@/lib/kit";

export const VIA: Record<NonNullable<KitItem["via"]>, string> = { notonq: "via NotOnQ", qloo: "Qloo direct" };

/** Where an item came from, in words: its source, and which way the Qloo call went. */
export const whereFrom = (item: KitItem) => `${partsOf(item).join(" · ")}. ${item.source}${item.via && !item.parts?.includes("via NotOnQ") ? ` (${VIA[item.via]})` : ""}`;

/** One source, as AI Elements' Inline Citation: a ref badge; hover or focus it for what it is and where it came from. */
export function Cite({ item }: { item: KitItem }) {
  return (
    <InlineCitationCard>
      <HoverCardTrigger asChild>
        <button type="button" className="rounded-4xl focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Source ${item.ref}: ${TYPE_LABELS[item.type]} ${item.title}. ${whereFrom(item)}`}>
          <Badge variant="outline" className="font-mono">
            {item.ref}
          </Badge>
        </button>
      </HoverCardTrigger>
      <InlineCitationCardBody className="w-72 p-3">
        <InlineCitationSource title={`${TYPE_LABELS[item.type]}: ${item.title}${item.year ? ` (${item.year})` : ""}`} description={whereFrom(item)} />
      </InlineCitationCardBody>
    </InlineCitationCard>
  );
}

export function Cites({ refs, items }: { refs: string[]; items: KitItem[] }) {
  const byRef = new Map(items.map((i) => [i.ref, i]));
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {refs.flatMap((r) => {
        const item = byRef.get(r);
        return item ? [<Cite key={r} item={item} />] : [];
      })}
    </span>
  );
}
