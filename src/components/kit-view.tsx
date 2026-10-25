"use client";

import { Check, Copy, ExternalLink, RotateCcw, Sparkles, ThumbsDown } from "lucide-react";
import { useState } from "react";
import { Cite, Cites } from "@/components/cite";
import { ResponseLog } from "@/components/response-log";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { featured, kitTitle, partsOf, PHASE_LABELS, PHASES, sessionMinutes, songsOf, TYPE_LABELS, type Kit, type KitItem, type LogEntry } from "@/lib/kit";

/** What a "not for them" mark sends back as `avoid`: a song with its artist, anything else by its title. */
export const avoidText = (i: KitItem) => (i.type === "song" && i.by ? `${i.title} (${i.by.title})` : i.title);

type Props = {
  kit: Kit;
  /** The response log's entries; without it, no log (a read-only surface). */
  log?: LogEntry[];
  shareUrl?: string;
  /** Family corrections: with it, songs and picks get a "Not for them" mark, and a rebuild leaves the marked ones out. */
  onRebuild?: (avoid: string[]) => void;
  busy?: boolean;
};

/**
 * A session kit, from props only (no page coupling, so other surfaces can render it): the playlist, the films, TV and
 * places to talk about, the prompts, the research behind it, and (when `log` is given) the one-tap response log.
 */
export function KitView({ kit, log, shareUrl, onRebuild, busy }: Props) {
  const byRef = new Map(kit.items.map((i) => [i.ref, i]));
  const songs = songsOf(kit.items);
  const screen = featured(kit.items, ["film", "tv"]);
  const places = featured(kit.items, ["place"]);
  const [copied, setCopied] = useState(false);
  const [onNow, setOnNow] = useState<string | null>(null);
  const [notForThem, setNotForThem] = useState<string[]>([]);
  const mark = onRebuild
    ? (i: KitItem) => (
        <NotForThem item={i} on={notForThem.includes(i.ref)} onChange={(on) => setNotForThem((xs) => (on ? [...xs, i.ref] : xs.filter((r) => r !== i.ref)))} />
      )
    : undefined;

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl ?? `${window.location.origin}/kits/${kit.id}`);
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
          <Badge variant="outline">{sessionMinutes(kit.items)}-minute session</Badge>
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
          Everything here is AI-generated from taste data and may be wrong. Watch how the person responds, stop anything that upsets them, and follow your care plan.
        </AlertDescription>
      </Alert>

      <section className="grid gap-4" aria-labelledby="playlist">
        <h3 id="playlist" className="text-lg font-semibold">
          Playlist
        </h3>
        {PHASES.map((phase) => {
          const inPhase = songs.filter((s) => s.phase === phase);
          if (!inPhase.length) return null;
          return (
            <div key={phase} className="grid gap-2">
              <h4 className="text-sm font-medium text-muted-foreground">{PHASE_LABELS[phase]}</h4>
              <ItemGroup className="gap-2">
                {inPhase.map((s) => (
                  <SongRow key={s.ref} song={s} artist={s.by ? byRef.get(s.by.ref) : undefined} on={onNow === s.ref} onOpen={() => setOnNow(s.ref)} mark={mark} />
                ))}
              </ItemGroup>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">Artists come from Qloo&apos;s taste data for the era and place; the song titles are the AI&apos;s picks, checked on MusicBrainz. Links open a search; nothing is hosted here.</p>
      </section>

      {screen.length > 0 && <Picks id="screen" title="Films and TV to talk about" items={screen} mark={mark} />}
      {places.length > 0 && <Picks id="places" title="Places from their hometown" items={places} note="Qloo lists today's places; these were likely there in their youth too." mark={mark} />}

      {onRebuild && notForThem.length > 0 && (
        <Alert>
          <ThumbsDown />
          <AlertTitle>
            {notForThem.length} marked not for them
          </AlertTitle>
          <AlertDescription className="grid gap-3">
            <span>The kit can be built again without them. It&apos;s saved as a new kit; this one stays.</span>
            <span>
              <Button size="sm" disabled={busy} onClick={() => onRebuild(notForThem.map((r) => avoidText(byRef.get(r)!)))}>
                <RotateCcw aria-hidden /> Build again without these
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-3" aria-labelledby="prompts">
        <h3 id="prompts" className="text-lg font-semibold">
          Conversation prompts
        </h3>
        <ol className="grid list-decimal gap-3 pl-5">
          {kit.prompts.map((p, n) => (
            <li key={n}>
              {p.text} <Cites refs={p.refs} items={kit.items} />
              {p.reply && <p className="text-sm text-muted-foreground">They might answer: {p.reply}</p>}
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Open questions invite a story; there are no right answers. Avoid &quot;Do you remember…?&quot;.</p>
      </section>

      {kit.id && log && (
        <>
          <Separator />
          <ResponseLog kitId={kit.id} items={[...songs, ...screen, ...places]} initial={log} onNow={onNow} onOnNow={setOnNow} />
        </>
      )}

      <Separator />
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="px-0">
            The research behind this kit ({kit.items.filter((i) => i.type !== "song").length} sources)
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
                  {TYPE_LABELS[i.type]}: {i.title}
                  {i.year ? ` (${i.year})` : ""}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{partsOf(i).join(" · ")}</span>
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

type Mark = ((item: KitItem) => React.ReactNode) | undefined;

/** The family's correction on one item: pressed means "not for them". */
function NotForThem({ item, on, onChange }: { item: KitItem; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <Toggle size="sm" variant="outline" pressed={on} onPressedChange={onChange} aria-label={`Not for them: ${item.title}`}>
      <ThumbsDown aria-hidden /> {on ? "Not for them" : "Not for them?"}
    </Toggle>
  );
}

function SongRow({ song, artist, on, onOpen, mark }: { song: KitItem; artist?: KitItem; on: boolean; onOpen: () => void; mark: Mark }) {
  const by = song.by?.title ?? "";
  return (
    <Item variant="outline" aria-current={on ? "true" : undefined} className={on ? "border-primary" : undefined}>
      <ItemContent>
        <ItemTitle>
          {song.title} <span className="font-normal text-muted-foreground">· {by}</span>
          {song.year ? <span className="font-normal text-muted-foreground"> ({song.year})</span> : null}
          {artist && <Cite item={artist} />}
        </ItemTitle>
        {song.why && <ItemDescription>{song.why}</ItemDescription>}
        {song.check && (
          <ItemDescription className="text-xs">{song.check === "musicbrainz" ? "Title confirmed on MusicBrainz" : "Title not checked: confirm before playing"}</ItemDescription>
        )}
      </ItemContent>
      {song.links && (
        <ItemActions className="flex-wrap">
          <Button asChild variant="outline" size="sm" onClick={onOpen}>
            <a href={song.links.spotify} target="_blank" rel="noreferrer" aria-label={`Open ${song.title} by ${by} on Spotify`}>
              Spotify <ExternalLink aria-hidden />
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" onClick={onOpen}>
            <a href={song.links.youtube} target="_blank" rel="noreferrer" aria-label={`Open ${song.title} by ${by} on YouTube`}>
              YouTube <ExternalLink aria-hidden />
            </a>
          </Button>
          {mark?.(song)}
        </ItemActions>
      )}
    </Item>
  );
}

/** Films, TV or places the curator picked, each with how to bring it up and its source. */
function Picks({ id, title, items, note, mark }: { id: string; title: string; items: KitItem[]; note?: string; mark: Mark }) {
  return (
    <section className="grid gap-3" aria-labelledby={id}>
      <h3 id={id} className="text-lg font-semibold">
        {title}
      </h3>
      <ItemGroup className="gap-2">
        {items.map((i) => (
          <Item key={i.ref} variant="outline">
            <ItemContent>
              <ItemTitle>
                {i.title}
                {i.year ? <span className="font-normal text-muted-foreground"> ({i.year})</span> : null}
                <span className="font-normal text-muted-foreground"> · {TYPE_LABELS[i.type]}</span>
                <Cite item={i} />
              </ItemTitle>
              <ItemDescription>{i.why}</ItemDescription>
            </ItemContent>
            {mark && <ItemActions>{mark(i)}</ItemActions>}
          </Item>
        ))}
      </ItemGroup>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </section>
  );
}
