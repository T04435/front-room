import { expect, test } from "@playwright/test";

test("the demo builds a cited session kit, logs a response and lists the kit as saved", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Margaret, born 1950, Manchester" }).click();
  await page.getByRole("button", { name: "Build the session kit" }).click();

  await expect(page.getByText("Artists of the era, popular around their hometown")).toBeVisible();
  const kit = page.getByRole("article", { name: "Session kit" });
  await expect(kit.getByRole("heading", { name: /Margaret's session kit · Manchester, United Kingdom, 1965–1975/ })).toBeVisible();
  await expect(kit.getByText("AI-generated", { exact: true })).toBeVisible();
  await expect(kit.getByRole("link", { name: /on Spotify/ })).toHaveCount(7);
  await expect(kit.getByRole("button", { name: /^Source A1:/ }).first()).toBeVisible();

  await page.getByRole("link", { name: "Open the saved kit" }).click();
  await expect(page).toHaveURL(/\/kits\/[A-Za-z0-9_-]{10}$/);
  await page.getByRole("button", { name: "Sang along" }).click();
  await expect(page.getByRole("list", { name: "Logged responses" })).toContainText("Sang along");
  await page.reload();
  await expect(page.getByRole("list", { name: "Logged responses" })).toContainText("Sang along");

  await page.getByRole("link", { name: "Saved kits" }).click();
  await expect(page.getByRole("link", { name: /Margaret · Manchester, United Kingdom, 1965–1975/ })).toContainText("1 response logged");
});

test("an unknown hometown asks for a nearby town inline, and answering carries on", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Birth year").fill("1948");
  await page.getByLabel("Where they grew up").fill("Zzzton");
  await page.getByRole("button", { name: "Build the session kit" }).click();
  const ask = page.getByRole("region", { name: "The run needs your answer" });
  await expect(ask).toContainText('Qloo doesn\'t know "Zzzton" yet');
  await ask.getByLabel("Nearby town or city").fill("Liverpool");
  await ask.getByRole("button", { name: "Carry on" }).click();
  await expect(page.getByRole("heading", { name: /session kit · Liverpool/ })).toBeVisible();
});

test("the footer's version badge and /api/version agree", async ({ page, request }) => {
  const version = (await (await request.get("/api/version")).json()) as { version: string; shortSha: string };
  await page.goto("/");
  await expect(page.locator("footer")).toContainText(`v${version.version} @ ${version.shortSha}`);
});
