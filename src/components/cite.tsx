"use client";

import { InlineCitationCard, InlineCitationCardBody, InlineCitationSource } from "@/components/ai-elements/inline-citation";
import { Badge } from "@/components/ui/badge";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import type { Item } from "@/lib/kit";

const KIND: Record<Item["kind"], string> = { artist: "Artist", film: "Film", tv: "TV", family: "From the family" };
export const VIA: Record<Item["via"], string> = { notonq: "via NotOnQ", qloo: "Qloo direct" };

/** One source, as AI Elements' Inline Citation: a ref badge; hover or focus it for what it is and where it came from. */
export function Cite({ item }: { item: Item }) {
  const where = item.kind === "family" ? item.source : `${item.source} (${VIA[item.via]})`;
  return (
    <InlineCitationCard>
      <HoverCardTrigger asChild>
        <button type="button" className="rounded-4xl focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Source ${item.ref}: ${KIND[item.kind]} ${item.name}. ${where}`}>
          <Badge variant="outline" className="font-mono">
            {item.ref}
          </Badge>
        </button>
      </HoverCardTrigger>
      <InlineCitationCardBody className="w-72 p-3">
        <InlineCitationSource title={`${KIND[item.kind]}: ${item.name}${item.year ? ` (${item.year})` : ""}`} description={where} />
      </InlineCitationCardBody>
    </InlineCitationCard>
  );
}

export function Cites({ refs, items }: { refs: string[]; items: Item[] }) {
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
