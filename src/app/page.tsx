import { ArrowRight, ClipboardList, HeartHandshake, MessageCircleHeart, Sparkles } from "lucide-react";
import Link from "next/link";
import { AgentMark } from "@/components/front-room/agent";
import { Logo } from "@/components/front-room/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EXAMPLE_IMAGES } from "@/lib/example-images";
import { EXAMPLES } from "@/lib/examples";

/** The wall of their years: pictures from the example Margaret's gallery (Qloo images). */
const WALL = ["artist:Dusty Springfield", "film:The Sound of Music", "place:Tower Ballroom", "artist:ABBA", "tv:Fawlty Towers", "artist:The Beatles"]
  .map((k) => EXAMPLE_IMAGES[k])
  .filter(Boolean);

const STEPS = [
  {
    icon: MessageCircleHeart,
    title: "Tell their story",
    body: "Talk, type or paste a “This is me”, in any language. The Go-Between checks what it heard, asks what's missing, and steers clear of what hurts.",
  },
  {
    icon: Sparkles,
    title: "Their years, in a gallery",
    body: "Qloo turns where and when they grew up into the songs, films, TV and places of their youth. Every card says what to say.",
  },
  {
    icon: HeartHandshake,
    title: "It learns what works",
    body: "One tap logs calm, engaged, sang along, tearful or upset. What works rises; what upsets is paused and the family is asked.",
  },
  {
    icon: ClipboardList,
    title: "For whoever's on next",
    body: "A 30-second card before the shift or the visit: what works, what to avoid, what to talk about, and the checks first.",
  },
];

/**
 * The landing page: what Front Room is, in a minute, and two ways in (an example story, or the example Margaret). The
 * problem it answers: care homes write life stories, then a stranger at 18:00 doesn't know the person.
 */
export default function Home() {
  return (
    <div className="grid gap-16">
      <section className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-6">
          <Logo size="lg" />
          <h1 className="font-heading text-[40px] leading-[46px] sm:text-[52px] sm:leading-[58px]">Bring their years into the room.</h1>
          <p className="text-xl text-muted-foreground">
            Care homes write life stories, then the carer on at 18:00 has never met the person. Front Room turns the family&apos;s words into the music, films and places of their youth, and keeps track of what worked, so
            the next carer knows too.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/people/new">
                Start with an example <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/p/margaret-x">See Margaret&apos;s gallery</Link>
            </Button>
          </div>
          <p className="text-[15px] text-muted-foreground">No sign-up. Use a fictional person: three ready-made “This is me” stories are one tap away.</p>
        </div>
        <div className="grid grid-cols-3 gap-3" aria-hidden>
          {WALL.map((src, i) => (
            <span key={src} className={i % 2 ? "translate-y-6" : ""}>
              {/* eslint-disable-next-line @next/next/no-img-element -- remote art from Qloo's CDN. */}
              <img src={src} alt="" loading={i < 3 ? "eager" : "lazy"} className="aspect-square w-full rounded-[var(--radius)] object-cover shadow-[var(--shadow-card)]" />
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-6" aria-labelledby="how">
        <h2 id="how" className="font-heading text-[30px] leading-[36px]">
          How it works
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((s) => (
            <Card key={s.title}>
              <CardContent className="grid gap-2">
                <s.icon className="size-7 text-primary" aria-hidden />
                <h3 className="text-xl font-semibold">{s.title}</h3>
                <p className="text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-[var(--radius)] bg-secondary p-6 sm:p-8" aria-labelledby="try">
        <div className="flex items-center gap-3">
          <AgentMark size={40} decorative />
          <h2 id="try" className="font-heading text-[26px] leading-[32px]">
            No one in mind? Start from a story
          </h2>
        </div>
        <p className="text-muted-foreground">Each one runs for real: the chat reads it, and Qloo looks up their years and places.</p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {EXAMPLES.map((e) => (
            <li key={e.id}>
              {/* A form: one tap starts the example person and opens their chat with the story ready. */}
              <form action={`/start/${e.id}`} method="post">
                <button type="submit" className="block w-full rounded-lg border-2 border-input bg-card p-4 text-left hover:bg-accent">
                  <span className="font-semibold">{e.name}</span>
                  <span className="block text-[15px] text-muted-foreground">{e.label.split(" · ")[1]}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3" aria-labelledby="honest">
        <h2 id="honest" className="font-heading text-[26px] leading-[32px]">
          What it is, and isn&apos;t
        </h2>
        <ul className="grid list-disc gap-2 pl-6 text-muted-foreground">
          <li>Personal music beats generic: sharing it is about engagement and connection, logged by staff. It isn&apos;t music therapy or a treatment.</li>
          <li>Only what the family confirms is kept. No surname, address, diagnosis or medication; Qloo gets places and years, never names.</li>
          <li>Songs open on Spotify or YouTube; nothing is hosted here.</li>
        </ul>
      </section>
    </div>
  );
}
