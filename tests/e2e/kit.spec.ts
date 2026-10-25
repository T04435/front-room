import { expect, test } from "@playwright/test";

test("the footer's version badge and /api/version agree", async ({ page, request }) => {
  const version = (await (await request.get("/api/version")).json()) as { version: string; shortSha: string };
  await page.goto("/");
  await expect(page.locator("footer")).toContainText(`v${version.version} @ ${version.shortSha}`);
});

test("a saved v1 kit link still opens, read-only, with no database run", async ({ page, request }) => {
  await page.goto("/kits/example");
  const kit = page.getByRole("article", { name: "Session kit" });
  await expect(kit.getByRole("heading", { name: "Playlist" })).toBeVisible();
  await expect(kit.getByText("Title confirmed on MusicBrainz").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Response log" })).toHaveCount(0);
  expect((await request.post("/api/kits/example/log", { data: { response: "sang" } })).status()).toBe(403);
});

test("the v1 kit builder and list send people to People", async ({ page }) => {
  await page.goto("/quick");
  await expect(page.getByRole("heading", { name: "People", level: 1 })).toBeVisible();
  await page.goto("/kits");
  await expect(page.getByRole("heading", { name: "People", level: 1 })).toBeVisible();
});
