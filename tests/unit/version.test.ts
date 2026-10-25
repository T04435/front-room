import { describe, expect, it } from "vitest";
import { envTag, versionLabel, versionText, type AppVersion } from "@/lib/version";

const base: AppVersion = {
  version: "1.1.0",
  sha: "3f1addd0000000000000000000000000000000000",
  shortSha: "3f1addd",
  env: "local",
  branch: "feat/sing",
  dirty: false,
  builtAt: "2026-10-23T00:00:00.000Z",
  releaseUrl: "https://github.com/T04435/music-care/releases/tag/v1.1.0",
  commitUrl: "https://github.com/T04435/music-care/commit/3f1addd0000000000000000000000000000000000",
};

describe("versionLabel and versionText", () => {
  it("production: tag @ hash, nothing else", () => {
    const v = { ...base, env: "production" as const, shortSha: "b7595e4" };
    expect(versionLabel(v)).toBe("v1.1.0 @ b7595e4");
    expect(versionText(v)).toBe("v1.1.0 @ b7595e4");
  });

  it("preview: the env and the branch", () => {
    expect(versionText({ ...base, env: "preview" })).toBe("v1.1.0 @ 3f1addd (preview, feat/sing)");
  });

  it("local: the env, and dirty only with uncommitted changes", () => {
    expect(versionText({ ...base, dirty: true })).toBe("v1.1.0 @ 3f1addd (local, dirty)");
    expect(versionText(base)).toBe("v1.1.0 @ 3f1addd (local)");
  });

  it("Vercel's development env counts as local", () => {
    expect(envTag({ ...base, env: "development" })).toBe("local");
  });
});
