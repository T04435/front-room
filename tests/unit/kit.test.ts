import { describe, expect, it } from "vitest";
import { checkCurated, playlistMinutes, searchLinks, type Curated, type Item } from "@/lib/kit";

const item = (ref: string, kind: Item["kind"], name: string): Item => ({ ref, kind, name, year: null, entityId: `e-${ref}`, source: "Qloo: test", via: "qloo" });
const items = [item("A1", "artist", "The Kinks"), item("A2", "artist", "Dusty Springfield"), item("A3", "artist", "Slade"), item("F1", "film", "The Sound of Music")];

describe("checkCurated", () => {
  const curated: Curated = {
    playlist: [
      { ref: "A3", song: "Cum On Feel the Noize", year: 1973, phase: "singalong", why: "" },
      { ref: "A1", song: "Waterloo Sunset", year: 1967, phase: "calm", why: "" },
      { ref: "A1", song: "Lola", year: 1970, phase: "familiar", why: "" },
      { ref: "F1", song: "Do-Re-Mi", year: 1965, phase: "singalong", why: "" },
      { ref: "A9", song: "Made up", year: null, phase: "calm", why: "" },
      { ref: "A2", song: "Son of a Preacher Man", year: 1968, phase: "familiar", why: "" },
    ],
    prompts: [
      { text: "Who did you go to the pictures with?", refs: ["F1", "F1"] },
      { text: "A prompt citing nothing real", refs: ["T7"] },
    ],
    summary: "",
  };
  const out = checkCurated(curated, items);

  it("orders tracks calm → familiar → singalong and names the artist", () => {
    expect(out.playlist.map((t) => [t.phase, t.artist, t.song])).toEqual([
      ["calm", "The Kinks", "Waterloo Sunset"],
      ["familiar", "Dusty Springfield", "Son of a Preacher Man"],
      ["singalong", "Slade", "Cum On Feel the Noize"],
    ]);
  });

  it("drops a second track by one artist, a non-artist ref and an unknown ref, and says why", () => {
    expect(out.problems.map((p) => p.where)).toEqual(["track 3", "track 4", "track 5", "prompt 2"]);
  });

  it("keeps prompts with known refs, deduped", () => {
    expect(out.prompts).toEqual([{ text: "Who did you go to the pictures with?", refs: ["F1"] }]);
  });

  it("links out by search and counts minutes", () => {
    expect(searchLinks("The Kinks", "Lola").youtube).toBe("https://www.youtube.com/results?search_query=The%20Kinks%20Lola");
    expect(playlistMinutes(out.playlist)).toBe(9);
  });
});
