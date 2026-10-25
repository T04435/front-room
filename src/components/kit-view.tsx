"use client";

import { Check, Copy, ExternalLink, Sparkles } from "lucide-react";
import { useState } from "react";
import { Cite, Cites, VIA } from "@/components/cite";
import { ResponseLog } from "@/components/response-log";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { kitTitle, PHASE_LABELS, PHASES, playlistMinutes, type Kit, type LogEntry } from "@/lib/kit";

/** A saved kit: the playlist by phase, the prompts, the research behind it, and (with an id) the response log. */
export function KitView({ kit, log }: { kit: Kit; log?: LogEntry[] }) {
  const byRef = new Map(kit.items.map((i) => [i.ref, i]));
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/kits/${kit.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <article className="grid gap-8" aria-label="Session kit">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <Sparkles aria-hidden /> AI-generated
          </Badge>
          <Badge variant="outline">{playlistMinutes(kit.playlist)} minutes</Badge>
          <Badge variant="outline">Born {kit.brief.birthYear}</Badge>
        </div>
        <h2 className="text-2xl font-semibold">{kitTitle(kit)}</h2>
        <p className="text-muted-foreground">{kit.summary}</p>
        {kit.id && (
          <div>
            <Button variant="outline" size="sm" onClick={() => void copyLink()}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? "Link copied" : "Copy share link"}
            </Button>
          </div>
        )}
      </header>

      <Alert>
        <AlertTitle>Suggestions, not treatment</AlertTitle>
        <AlertDescription>
          Song picks and prompts are AI-generated from taste data and may be wrong. Watch how the person responds, stop anything that upsets them, and follow your care plan.
        </AlertDescription>
      </Alert>

      <section className="grid gap-4" aria-labelledby="playlist">
        <h3 id="playlist" className="text-lg font-semibold">
          Playlist
        </h3>
        {PHASES.map((phase) => {
          const tracks = kit.playlist.filter((t) => t.phase === phase);
          if (!tracks.length) return null;
          return (
            <div key={phase} className="grid gap-2">
              <h4 className="text-sm font-medium text-muted-foreground">{PHASE_LABELS[phase]}</h4>
              <ItemGroup className="gap-2">
                {tracks.map((t) => {
                  const artist = byRef.get(t.ref);
                  const on = playing === t.ref;
                  return (
                    <Item key={t.ref} variant="outline" aria-current={on ? "true" : undefined} className={on ? "border-primary" : undefined}>
                      <ItemContent>
                        <ItemTitle>
                          {t.song} <span className="font-normal text-muted-foreground">· {t.artist}</span>
                          {t.year ? <span className="font-normal text-muted-foreground"> ({t.year})</span> : null}
                          {artist && <Cite item={artist} />}
                        </ItemTitle>
                        <ItemDescription>{t.why}</ItemDescription>
                      </ItemContent>
                      <ItemActions className="flex-wrap">
                        <Button asChild variant="outline" size="sm" onClick={() => setPlaying(t.ref)}>
                          <a href={t.links.spotify} target="_blank" rel="noreferrer" aria-label={`Open ${t.song} by ${t.artist} on Spotify`}>
                            Spotify <ExternalLink aria-hidden />
                          </a>
                        </Button>
                        <Button asChild variant="outline" size="sm" onClick={() => setPlaying(t.ref)}>
                          <a href={t.links.youtube} target="_blank" rel="noreferrer" aria-label={`Open ${t.song} by ${t.artist} on YouTube`}>
                            YouTube <ExternalLink aria-hidden />
                          </a>
                        </Button>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">Artists come from Qloo&apos;s taste data for the era and place; the song titles are the AI&apos;s picks. Links open a search; nothing is hosted here.</p>
      </section>

      {kit.id && log && (
        <>
          <Separator />
          <ResponseLog kitId={kit.id} playlist={kit.playlist} initial={log} playing={playing} onPlaying={setPlaying} />
        </>
      )}

      <Separator />
      <section className="grid gap-3" aria-labelledby="prompts">
        <h3 id="prompts" className="text-lg font-semibold">
          Conversation prompts
        </h3>
        <ol className="grid list-decimal gap-3 pl-5">
          {kit.prompts.map((p, n) => (
            <li key={n}>
              {p.text} <Cites refs={p.refs} items={kit.items} />
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Open questions invite a story; there are no right answers. Avoid &quot;Do you remember…?&quot;.</p>
      </section>

      <Separator />
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="px-0">
            The research behind this kit ({kit.items.length} sources)
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="grid gap-1 pt-2 text-sm">
            {kit.items.map((i) => (
              <li key={i.ref} className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {i.ref}
                </Badge>
                <span>
                  {i.name}
                  {i.year ? ` (${i.year})` : ""}
                </span>
                <span className="text-muted-foreground">
                  {i.source}
                  {i.kind !== "family" ? ` · ${VIA[i.via]}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="pt-3 text-xs text-muted-foreground">
            {kit.sources.notonq} calls via NotOnQ, {kit.sources.qloo} to Qloo directly{kit.sources.fellBack ? ` (${kit.sources.fellBack} after NotOnQ didn't answer)` : ""}. Built with {kit.model}.
          </p>
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
}
