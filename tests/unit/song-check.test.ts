import { describe, expect, it } from "vitest";
import { baseTitle, matchRecording, type MbRecording } from "@/lib/song-check";

const rec = (title: string, artist: string, date?: string): MbRecording => ({ title, "first-release-date": date, "artist-credit": [{ name: artist }] });

describe("matchRecording", () => {
  const results = [rec("Hey Jude (Remastered 2015)", "The Beatles", "2015-09-01"), rec("Hey Jude", "The Beatles", "1968-08-26"), rec("Hey Jude", "Wilson Pickett", "1968-11-01")];

  it("finds the song by the artist, earliest release year", () => {
    expect(matchRecording(results, "The Beatles", "Hey Jude")).toEqual({ found: true, year: 1968 });
  });
  it("needs the artist to match, not only the title", () => {
    expect(matchRecording(results, "ABBA", "Hey Jude")).toEqual({ found: false, year: null });
  });
  it("doesn't take a different title", () => {
    expect(matchRecording(results, "The Beatles", "Hey Judy")).toEqual({ found: false, year: null });
  });
  it("accepts a shared artist credit", () => {
    expect(matchRecording([rec("What Have I Done to Deserve This?", "Pet Shop Boys & Dusty Springfield", "1987")], "Dusty Springfield", "What Have I Done to Deserve This?").found).toBe(true);
  });
  it("drops edition notes from titles", () => {
    expect(baseTitle("Waterloo - Single Version")).toBe("waterloo");
    expect(baseTitle("Maggie May [Live]")).toBe("maggie may");
  });
});
