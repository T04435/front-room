import { describe, expect, it } from "vitest";
import type { RunEvent } from "@/lib/run-events";
import { getKit } from "@/server/kits";
import { runKit } from "@/server/run";

async function collect(brief: Parameters<typeof runKit>[0]) {
  const events: RunEvent[] = [];
  let calls = 0;
  await runKit(brief, (e) => events.push(e), undefined, { onQlooCalls: async (n) => void (calls = n), owner: "test-owner" });
  return { events, calls };
}

describe("a run (offline fixtures)", () => {
  it("researches Margaret's era in Manchester and saves a cited kit", async () => {
    const { events, calls } = await collect({ name: "Margaret", birthYear: 1950, place: "Manchester", likes: ["Dusty Springfield"] });
    const tools = events.filter((e) => e.type === "step-start").map((e) => (e as { tool: string }).tool);
    expect(tools).toEqual(expect.arrayContaining(["find_place", "era_tags", "era_artists", "likes", "era_films", "era_tv", "era_places"]));
    const kitEvent = events.find((e) => e.type === "kit");
    expect(kitEvent).toBeTruthy();
    const kit = (kitEvent as Extract<RunEvent, { type: "kit" }>).kit;
    expect(kit.era).toMatchObject({ from: 1965, to: 1975 });
    const songs = kit.items.filter((i) => i.type === "song");
    expect(songs.length).toBeGreaterThanOrEqual(3);
    expect(songs.length).toBeLessThanOrEqual(5);
    expect(songs[0].parts).toEqual(["70s", "Manchester", "Qloo"]);
    const refs = new Set(kit.items.map((i) => i.ref));
    for (const s of songs) expect(refs.has(s.by!.ref)).toBe(true);
    expect(kit.items.some((i) => i.type === "place" && i.why)).toBe(true);
    expect(kit.items.some((i) => (i.type === "film" || i.type === "tv") && i.why)).toBe(true);
    for (const p of kit.prompts) for (const r of p.refs) expect(refs.has(r)).toBe(true);
    expect(kit.items.every((i) => i.source.length > 0)).toBe(true);
    expect(calls).toBeGreaterThan(5);
    expect(await getKit(kit.id)).toMatchObject({ id: kit.id, place: kit.place });
  });

  it("asks for a nearby town when Qloo doesn't know the place", async () => {
    const { events } = await collect({ birthYear: 1950, place: "Zzzville" });
    expect(events.find((e) => e.type === "ask")).toMatchObject({ fields: ["nearbyPlace"] });
    expect(events.some((e) => e.type === "kit")).toBe(false);
  });

  it("asks what music they loved when the era comes back empty", async () => {
    const { events } = await collect({ birthYear: 1950, place: "Nowhere Junction" });
    // The fixture finds the locality but no entities around it.
    expect(events.find((e) => e.type === "ask")).toMatchObject({ fields: ["musicWords"] });
  });

  it("leaves out what the family marked not for them, and keeps the marks on the saved kit", async () => {
    const avoid = ["David Bowie", "The Sound of Music", "Test song 2 (T. Rex)"];
    const { events } = await collect({ birthYear: 1950, place: "Manchester", avoid });
    const kit = (events.find((e) => e.type === "kit") as Extract<RunEvent, { type: "kit" }>).kit;
    expect(kit.items.some((i) => i.title === "David Bowie" || i.title === "The Sound of Music")).toBe(false);
    expect(kit.brief.avoid).toEqual(avoid);
  });

  it("Skip on the place question carries on without a place", async () => {
    const { events } = await collect({ birthYear: 1950, place: "Zzzville", answers: { skipPlace: true } });
    const kit = (events.find((e) => e.type === "kit") as Extract<RunEvent, { type: "kit" }>).kit;
    expect(kit.items.some((i) => i.type === "place")).toBe(false);
    expect(kit.items.find((i) => i.type === "artist")?.parts).toEqual(["70s", "Qloo"]);
  });

  it("searches the years a carer picked instead of ages 15–25", async () => {
    const { events } = await collect({ birthYear: 1950, place: "Manchester", years: [1960, 1970] });
    const kit = (events.find((e) => e.type === "kit") as Extract<RunEvent, { type: "kit" }>).kit;
    expect(kit.era).toMatchObject({ from: 1960, to: 1970 });
  });

  it("never sends a raw Qloo response in an event", async () => {
    const { events } = await collect({ birthYear: 1950, place: "Manchester" });
    expect(JSON.stringify(events)).not.toContain("entity_id");
  });
});
