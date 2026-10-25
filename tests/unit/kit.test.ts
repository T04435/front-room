import { describe, expect, it } from "vitest";
import { checkCurated, featured, searchLinks, sessionMinutes, songsOf, type Curated, type KitItem } from "@/lib/kit";

const item = (ref: string, type: KitItem["type"], title: string): KitItem => ({ ref, type, title, year: null, parts: ["60s", "Manchester", "Qloo"], source: "Qloo: test", why: null, via: "qloo", entityId: `e-${ref}` });
const research = [
  item("A1", "artist", "The Kinks"),
  item("A2", "artist", "Dusty Springfield"),
  item("A3", "artist", "Slade"),
  item("F1", "film", "The Sound of Music"),
  item("P1", "place", "Palace Theatre Manchester"),
];

describe("checkCurated", () => {
  const curated: Curated = {
    songs: [
      { artistRef: "A3", title: "Cum On Feel the Noize", year: 1973, phase: "singalong", why: "Big chorus." },
      { artistRef: "A1", title: "Waterloo Sunset", year: 1967, phase: "calm", why: "Gentle start." },
      { artistRef: "A1", title: "Lola", year: 1970, phase: "familiar", why: "" },
      { artistRef: "F1", title: "Do-Re-Mi", year: 1965, phase: "singalong", why: "" },
      { artistRef: "A9", title: "Made up", year: null, phase: "calm", why: "" },
      { artistRef: "A2", title: "Son of a Preacher Man", year: 1968, phase: "familiar", why: "A Manchester favourite." },
    ],
    picks: [
      { ref: "F1", why: "Ask who they went to the pictures with." },
      { ref: "A2", why: "Not a film or place." },
    ],
    prompts: [
      { text: "Who did you go to the pictures with?", reply: "A friend's name", refs: ["F1", "F1"] },
      { text: "What was on at the Palace?", reply: "A pantomime", refs: ["P1", "S1"] },
      { text: "A prompt citing nothing real", reply: "", refs: ["T7"] },
    ],
    summary: "",
  };
  const out = checkCurated(curated, research);

  it("turns songs into items, calm → familiar → singalong, numbered in playing order", () => {
    expect(songsOf(out.items).map((s) => [s.ref, s.phase, s.by?.title, s.title])).toEqual([
      ["S1", "calm", "The Kinks", "Waterloo Sunset"],
      ["S2", "familiar", "Dusty Springfield", "Son of a Preacher Man"],
      ["S3", "singalong", "Slade", "Cum On Feel the Noize"],
    ]);
    expect(songsOf(out.items)[0]).toMatchObject({ type: "song", via: null, source: "AI pick: a recording by The Kinks (A1)", parts: ["60s", "Manchester", "Qloo"] });
  });

  it("drops a second song by one artist, a non-artist ref, an unknown ref and a bad pick, and says why", () => {
    expect(out.problems.map((p) => p.where)).toEqual(["song 3", "song 4", "song 5", "pick 2", "prompt 3"]);
  });

  it("features picked films and places with their why; the rest stays research", () => {
    expect(featured(out.items, ["film", "tv"]).map((i) => [i.ref, i.why])).toEqual([["F1", "Ask who they went to the pictures with."]]);
    expect(featured(out.items, ["place"])).toEqual([]);
  });

  it("keeps prompts citing research or songs, deduped", () => {
    expect(out.prompts).toEqual([
      { text: "Who did you go to the pictures with?", reply: "A friend's name", refs: ["F1"] },
      { text: "What was on at the Palace?", reply: "A pantomime", refs: ["P1", "S1"] },
    ]);
  });

  it("links songs out by search and counts the session: 3 a song, 5 for the screen, 3 for a place", () => {
    expect(searchLinks("The Kinks", "Lola").youtube).toBe("https://www.youtube.com/results?search_query=The%20Kinks%20Lola");
    expect(sessionMinutes(out.items)).toBe(9 + 5);
  });
});
