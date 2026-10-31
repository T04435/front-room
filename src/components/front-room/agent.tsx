/* The Go-Between, Front Room's research agent (design system: "The Go-Between"). Its mark is the logo at work: each
   state changes the SHAPE (drawing, whole, dashed, open, broken), so it reads without colour and without motion. No AI
   chip and no other product or company names. */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemMedia } from "@/components/ui/item";
import { cn } from "@/lib/utils";

export type AgentState = "working" | "rest" | "none" | "asking" | "stopped";

const WAVE = "M8 30c3.5-6 7-6 10.5 0s7 6 10.5 0 7-6 10.5 0 5 5 8 1";
/** The overlap: the mark's centre, which takes a source's colour on a single-source step. */
const LENS = "M28 12.51A17 17 0 0 1 28 43.49A17 17 0 0 1 28 12.51Z";
const AGENT_LABEL: Record<AgentState, string> = {
  working: "The Go-Between, researching",
  rest: "The Go-Between",
  asking: "The Go-Between, waiting for your answer",
  stopped: "The Go-Between, stopped",
  none: "The Go-Between didn't run",
};

/**
 * AgentMark: hand-written SVG on the Logo geometry (circles at 21 and 35, r 17, 56 grid). The first circle is Apricot;
 * the second, the outlines and the asking dot draw in currentColor under `text-agent` (Plum by day, Rose by night),
 * unless `inherit`. Only Working moves; under reduced motion (or `motion={false}`) it holds its still frame, the wave
 * drawn to the overlap with an open end. Under 20px the strokes thicken, and no source colour shows.
 */
export function AgentMark({
  state = "rest",
  size = 24,
  motion = true,
  decorative = false,
  source,
  inherit = false,
  label,
}: {
  state?: AgentState;
  size?: number;
  motion?: boolean;
  decorative?: boolean;
  source?: "qloo" | "notonq";
  inherit?: boolean;
  label?: string;
}) {
  const small = size < 20;
  const w = small ? 4.4 : 3;
  const src = small ? undefined : source;
  const a11y = decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label ?? AGENT_LABEL[state] };
  const svg = (
    <svg width={size} height={size} viewBox="0 0 56 56" data-state={state} {...a11y}>
      {state === "none" ? (
        <>
          <circle cx="21" cy="28" r="16" fill="none" stroke="currentColor" strokeWidth={small ? 3.4 : 2.4} strokeDasharray={small ? "5 4" : "4 3.2"} />
          <circle cx="35" cy="28" r="16" fill="none" stroke="currentColor" strokeWidth={small ? 3.4 : 2.4} strokeDasharray={small ? "5 4" : "4 3.2"} />
        </>
      ) : (
        <>
          <circle cx="21" cy="28" r="17" className="fill-accent" />
          {state === "asking" ? (
            <circle cx="35" cy="28" r="15.6" fill="none" stroke="currentColor" strokeWidth={small ? 3.6 : 2.8} />
          ) : (
            <circle cx="35" cy="28" r="17" fill="currentColor" fillOpacity={0.92} />
          )}
          {src && state !== "asking" && <path d={LENS} style={{ fill: `var(--source-${src})` }} />}
          <path
            d={WAVE}
            pathLength={100}
            fill="none"
            strokeLinecap="round"
            strokeWidth={w}
            className={cn(
              "stroke-primary-foreground",
              state === "working" &&
                (motion
                  ? "[stroke-dasharray:100_100] animate-[fr-am-draw_2.6s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:[stroke-dasharray:58_100]"
                  : "[stroke-dasharray:58_100]"),
            )}
            strokeDasharray={state === "asking" ? "46 100" : state === "stopped" ? "38 24 38 0" : undefined}
          />
          {state === "asking" && <circle cx="29.2" cy="29.4" r={small ? 4 : 3} fill="currentColor" />}
        </>
      )}
    </svg>
  );
  return inherit ? svg : <span className="inline-flex shrink-0 text-agent">{svg}</span>;
}

/** SourceTag (state 4): which source a step used. One square marker and the name, or three markers and the list. */
export function SourceTag({ sources }: { sources: string[] }) {
  const mixed = sources.length > 1;
  return (
    <Badge variant="outline" className="gap-1.5 font-mono text-xs text-muted-foreground" aria-label={`${mixed ? "Mixed sources" : "Source"}: ${sources.join(", ")}`}>
      <span aria-hidden className="inline-flex gap-0.5 text-foreground">
        {Array.from({ length: mixed ? 3 : 1 }, (_, i) => (
          <span key={i} className="size-[7px] rounded-[1px] bg-current" />
        ))}
      </span>
      {mixed ? `Mixed · ${sources.join(", ")}` : sources[0]}
    </Badge>
  );
}

/** The mark plus "the Go-Between" in the heading face: inline at 28px, stacked at about 100px. */
export function AgentLockup({ layout = "inline", state = "rest", size }: { layout?: "inline" | "stacked"; state?: AgentState; size?: number }) {
  const px = size ?? (layout === "stacked" ? 96 : 28);
  return (
    <span className={cn("inline-flex gap-2.5", layout === "stacked" ? "flex-col items-start gap-3" : "items-center")}>
      <AgentMark size={px} state={state} decorative />
      <span className="font-heading leading-tight" style={{ fontSize: layout === "stacked" ? 30 : Math.round(px * 0.8) }}>
        the Go-Between
      </span>
    </span>
  );
}

export type AgentStatus = "researching" | "rerun" | "done" | "replayed" | "asking" | "timeout" | "budget" | "none";
const STATUS_MARK: Record<AgentStatus, AgentState> = { researching: "working", rerun: "working", done: "rest", replayed: "rest", asking: "asking", timeout: "stopped", budget: "stopped", none: "none" };

/** The status sentences, filled in with the real person, place and years. */
export const AGENT_STATUS_TEXT = {
  researching: (who: string, place: string, years: string) => `The Go-Between is looking through ${place} in ${years}: songs, films, TV and places. ${who} kit will be ready in about a minute.`,
  rerun: () => "The Go-Between is looking again. The kit below stays until it's done.",
  done: () => "Set out by the Go-Between.",
  replayed: () => "A saved kit, as the Go-Between set it out. Nothing new was looked up.",
  asking: () => "The Go-Between needs one answer from you before it can carry on.",
  timeout: () => "The Go-Between stopped: Qloo didn't answer in time. What it found so far is kept.",
  budget: () => "The Go-Between has stopped for today: today's new kits are used up. Saved kits still open.",
  none: () => "Built from Qloo's lists alone. The Go-Between didn't run for this kit.",
} as const;

/** One line under the research header: shadcn Item (muted; dashed outline when the agent didn't run), role="status". */
export function AgentStatusLine({ state, children }: { state: AgentStatus; children: React.ReactNode }) {
  return (
    <Item
      variant={state === "none" ? "outline" : "muted"}
      role="status"
      className={cn("items-start rounded-lg", state === "none" && "border-2 border-dashed border-input shadow-none", state === "asking" && "outline-2 -outline-offset-2 outline-primary")}
    >
      <ItemMedia>
        <AgentMark size={24} state={STATUS_MARK[state]} decorative />
      </ItemMedia>
      <ItemContent className="text-base">{children}</ItemContent>
    </Item>
  );
}

/** The agent's own note under a finished step, tagged with the 14px mark. */
export function AgentNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-1 rounded-md bg-secondary px-3 py-2.5 text-base text-secondary-foreground">
      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wide text-muted-foreground">
        <AgentMark size={14} decorative />
        THE GO-BETWEEN
      </span>
      <span>{children}</span>
    </div>
  );
}

/** The inline tag in the kit: the 16px mark at rest, or a hollow ring for what the family added. */
export function FoundBy({ by }: { by: "agent" | "family" }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-muted-foreground">
      {by === "agent" ? <AgentMark size={16} decorative /> : <span aria-hidden className="size-3.5 rounded-full border-2 border-primary" />}
      {by === "agent" ? "Found by the Go-Between" : "Added by family"}
    </span>
  );
}

/** "Meet the Go-Between": shadcn Card look, by its own name only. */
export function MeetAgent() {
  return (
    <section aria-label="Meet the Go-Between" className="grid gap-5 rounded-lg border bg-card p-5 shadow-[var(--shadow-card)] sm:grid-cols-[96px_1fr]">
      <AgentMark size={96} decorative />
      <div className="grid min-w-0 gap-2">
        <span className="text-[13px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Meet the Go-Between</span>
        <p>The Go-Between does Front Room&apos;s looking up. Give it a birth year and a hometown, and it finds the songs, films, TV and places of those years, then sets them out as a kit.</p>
        <p className="text-[15px] text-muted-foreground">Every item says where it came from. It never makes things up, and it never gives medical advice. It talks to carers and families, never to the person in the chair.</p>
      </div>
    </section>
  );
}

const ALERTS = {
  "qloo-down": {
    mark: "stopped",
    title: "Qloo isn’t answering",
    body: "The Go-Between can’t look anything up without Qloo, and Qloo isn’t answering right now. Everything you typed is kept. Try again in a minute; this one didn’t count.",
    action: "Try again",
  },
  "couldnt-finish": { mark: "stopped", title: "The Go-Between couldn’t finish", body: "It ran out of time, so this kit comes from Qloo’s lists alone, without its notes.", action: null },
  "no-match": {
    mark: "rest",
    title: "Nothing new this time",
    body: "Everything the Go-Between found was already marked “not for them”. Add something you know they loved and it will look again.",
    action: "Add something they loved",
  },
} as const;

/** The run's errors in the agent's voice: shadcn Alert look with the mark. `qloo-down` is role="alert". */
export function AgentAlert({ kind, body, onAction }: { kind: keyof typeof ALERTS; body?: string; onAction?: () => void }) {
  const a = ALERTS[kind];
  return (
    <div
      role={kind === "qloo-down" ? "alert" : "status"}
      className={cn("grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg border-2 bg-card px-4.5 py-4 text-card-foreground", kind === "qloo-down" ? "border-destructive" : "border-border")}
    >
      <AgentMark size={24} state={a.mark} decorative />
      <div className="text-lg leading-[26px] font-semibold">{a.title}</div>
      <div className="col-start-2 text-base text-muted-foreground">{body ?? a.body}</div>
      {a.action && onAction && (
        <div className="col-start-2 mt-2 flex flex-wrap gap-2">
          <Button variant="outline" onClick={onAction}>
            {a.action}
          </Button>
        </div>
      )}
    </div>
  );
}
