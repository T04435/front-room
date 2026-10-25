import { describe, expect, it } from "vitest";
import { EXAMPLE_KITS, EXAMPLE_LOGS } from "@/lib/example-person";
import { itemKey, itemStats, playStats, provenCalm, topProven, type Logged } from "@/lib/learning";
import { EXAMPLE_PLAYS } from "@/lib/example-person";
import type { Kit } from "@/lib/kit";

const NOW = new Date("2026-10-25T12:00:00Z");

describe("kits that learn (the example Margaret's five sessions)", () => {
  const stats = itemStats(EXAMPLE_KITS, EXAMPLE_LOGS, [], NOW);
  const state = (title: string) => [...stats.values()].find((s) => s.title === title)?.state;

  it("sang along or engaged in 2 sessions → proven", () => {
    expect(state("Waterloo")).toBe("proven");
    expect(state("You Don't Have to Say You Love Me")).toBe("proven");
    expect(topProven(stats).map((s) => s.title)).toEqual(expect.arrayContaining(["Waterloo", "You Don't Have to Say You Love Me"]));
  });

  it("one upset → paused, until someone answers sad but OK or a one-off", () => {
    expect(state("Yesterday")).toBe("paused");
    const key = [...stats.values()].find((s) => s.title === "Yesterday")!.key;
    expect([...itemStats(EXAMPLE_KITS, EXAMPLE_LOGS, [key], NOW).values()].find((s) => s.title === "Yesterday")?.state).not.toBe("paused");
  });

  it("no reaction 3 times → resting, for 30 days only", () => {
    expect(state("Lola")).toBe("resting");
    const later = itemStats(EXAMPLE_KITS, EXAMPLE_LOGS, [], new Date("2026-12-25T12:00:00Z"));
    expect([...later.values()].find((s) => s.title === "Lola")?.state).toBe("tried");
  });

  it("once with a good reaction is just tried", () => {
    expect(state("Maggie May")).toBe("tried");
  });

  it("knows what settles", () => {
    expect(provenCalm(stats).map((s) => s.title)).toContain("You Don't Have to Say You Love Me");
  });

  it("counts a session once however many taps", () => {
    const kit: Kit = { ...EXAMPLE_KITS[0], id: "k" };
    const logs: Logged[] = [1, 2, 3].map((i) => ({ id: i, kitId: "k", itemRef: "S5", response: "sang", at: `2026-10-20T10:0${i}:00Z` }));
    expect([...itemStats([kit], logs, [], NOW).values()][0]).toMatchObject({ sangSessions: 1, state: "tried" });
  });
});

describe("the gallery learns from plays (a session is a day)", () => {
  it("gives the example the same states from her plays", () => {
    const stats = playStats(EXAMPLE_PLAYS, [], NOW);
    const st = (t: string) => [...stats.values()].find((s) => s.title === t)?.state;
    expect([st("Waterloo"), st("Yesterday"), st("Lola"), st("Maggie May")]).toEqual(["proven", "paused", "resting", "tried"]);
  });
});

describe("item keys", () => {
  it("keys an item the same way however it's spelled", () => {
    expect(itemKey({ type: "song", title: "Waterloo!", by: { title: "ABBA" } })).toBe(itemKey({ type: "song", title: "waterloo", by: "Abba" }));
  });
});
