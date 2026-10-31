import { describe, expect, it } from "vitest";
import { addedText, missingHints } from "@/components/story-chat";
import { emptyPerson, type Person } from "@/lib/person";

const rosa = (patch: Partial<Person> = {}): Person => ({ ...emptyPerson("p1", "Rosa", null), ...patch });
const place = (id: string, name: string) => ({ id, name, fromYear: null, toYear: null }) as Person["places"][number];

describe("the box's ideas", () => {
  it("offers at most three, for what the story is missing", () => {
    expect(missingHints(rosa()).map((h) => h.label)).toEqual(["Where they grew up", "Where they lived after", "A song they always sang"]);
  });

  it("change as the story fills in", () => {
    const told = rosa({ places: [place("a", "Sevilla"), place("b", "Madrid")], loves: [{ id: "l", type: "song", title: "Como una ola", source: "family" }], steerAsked: true });
    expect(missingHints(told).map((h) => h.label)).toEqual(["Music, films and shows", "What calms them", "Family and big moments"]);
  });

  it("none once everything is known", () => {
    const all = rosa({
      places: [place("a", "Sevilla"), place("b", "Madrid")],
      loves: [{ id: "l", type: "song", title: "Como una ola", source: "family" }, { id: "m", type: "artist", title: "Rocío Jurado", source: "family" }],
      steerAsked: true,
      moments: [{ id: "w", kind: "wedding", year: 1970, label: "Married in Triana" }],
      practical: { calms: "Copla, softly", work: "Seamstress", faith: { stance: "keep_out" } },
    });
    expect(missingHints(all)).toEqual([]);
  });
});

describe("what research says as it goes", () => {
  const end = { type: "step-end" as const, ok: true, summary: "Rosa may know these.", items: [], sources: ["NotOnQ"] };

  it("names what a place added to the gallery", () => {
    expect(addedText({ ...end, id: "place-a", chips: ["Paco de Lucía", "Julio Iglesias", "La Giralda"] }, "Sevilla, 1958–1970", "Rosa")).toBe(
      "Added Paco de Lucía, Julio Iglesias and La Giralda to Rosa’s gallery (Sevilla, 1958–1970).",
    );
  });

  it("keeps the step's own words for songs, misses and failures", () => {
    expect(addedText({ ...end, id: "songs", chips: [], summary: "9 songs, each a real recording." }, "Songs", "Rosa")).toBe("9 songs, each a real recording.");
    expect(addedText({ ...end, id: "place-b", ok: false, chips: [], summary: "Qloo didn't answer in time for Madrid." }, "Madrid", "Rosa")).toBe("Qloo didn't answer in time for Madrid.");
  });
});

describe("when a new look-up is due", () => {
  it("never for a place they left as a small child, so the banner goes after a look-up", async () => {
    const { placesDue, researchInputs, researchKey } = await import("@/lib/person");
    const lahore = { id: "a", name: "Lahore", fromYear: 1944, toYear: 1947 } as Person["places"][number];
    const amritsar = { id: "b", name: "Amritsar", fromYear: 1947, toYear: 1965 } as Person["places"][number];
    const base = rosa({ preferredName: "Amrit", birthYear: 1944, places: [lahore, amritsar] });
    const done = { ...base, researched: { [researchKey(amritsar, 1944)]: researchInputs(base, amritsar) } };
    expect(placesDue(done)).toEqual([]);
    const capeTown = { id: "c", name: "Cape Town", fromYear: 1975, toYear: null } as Person["places"][number];
    expect(placesDue({ ...done, places: [...done.places, capeTown] }).map((p) => p.name)).toEqual(["Cape Town"]);
  });
});
