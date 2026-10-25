import { expect, test } from "@playwright/test";

test("the footer's version badge and /api/version agree", async ({ page, request }) => {
  const version = (await (await request.get("/api/version")).json()) as { version: string; shortSha: string };
  await page.goto("/");
  await expect(page.locator("footer")).toContainText(`v${version.version} @ ${version.shortSha}`);
});


test("the v1 kit builder, list and kit links send people to People", async ({ page }) => {
  await page.goto("/kits/example");
  await expect(page.getByRole("heading", { name: "People", level: 1 })).toBeVisible();
  await page.goto("/quick");
  await expect(page.getByRole("heading", { name: "People", level: 1 })).toBeVisible();
  await page.goto("/kits");
  await expect(page.getByRole("heading", { name: "People", level: 1 })).toBeVisible();
});
