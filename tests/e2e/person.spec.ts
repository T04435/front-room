import { expect, test, type Page } from "@playwright/test";

const STORY = "Margot was born in 1950 and grew up in Manchester. She married in '72 and moved to Blackpool. Her brother Tom died and she never talks about him. She loved Dusty.";

/** Adds a fictional person and tells the Go-Between their story, up to the offer to find things. */
async function tellStory(page: Page) {
  await page.goto("/people/new");
  await page.getByLabel("The name they like to be called").fill("Margot");
  await page.getByRole("button", { name: "Start their story" }).click();
  await expect(page).toHaveURL(/\/p\/[A-Za-z0-9_-]{10}\/story$/);
  await expect(page.getByText("What helps me most")).toBeVisible();

  await page.getByLabel("Tell the Go-Between about Margot").fill(STORY);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Here's what I heard")).toBeVisible();
  await expect(page.getByText("You said they moved to Blackpool. What did they do there?")).toBeVisible();
  await page.getByRole("button", { name: "Never" }).click();
  await page.getByRole("button", { name: "All right" }).click();
}

test("a new person's page is a chat: it confirms what it heard, steers clear, then finds things and opens the gallery", async ({ page }) => {
  await tellStory(page);
  const offer = page.getByRole("main").getByRole("button", { name: "Find things for Margot" });
  await expect(offer.last()).toBeVisible();
  await offer.last().click();
  await expect(page.getByRole("link", { name: "Open Margot's gallery" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: "Open Margot's gallery" }).click();

  await expect(page.getByRole("heading", { name: "Margot", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Songs" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Places they knew" })).toBeVisible();
});

test("the gallery plays an item, logs and undoes a response, and Stop pauses it", async ({ page }) => {
  await tellStory(page);
  await page.getByRole("main").getByRole("button", { name: "Find things for Margot" }).last().click();
  await page.getByRole("link", { name: "Open Margot's gallery" }).click({ timeout: 60_000 });

  const songs = page.getByRole("region", { name: "Songs" });
  const first = songs.getByRole("button", { name: /: play$/ }).first();
  const label = (await first.getAttribute("aria-label"))!.replace(/: play$/, "");
  const title = label.split(" by ")[0];
  await first.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("link", { name: /Spotify/ })).toBeVisible();
  await sheet.getByRole("button", { name: "Sang along" }).click();
  await sheet.getByRole("button", { name: "Undo" }).click();
  await expect(sheet.getByRole("button", { name: "Undo" })).toHaveCount(0);

  // There's no Upset button: Stop logs the upset (UX-2).
  await expect(sheet.getByRole("button", { name: "Upset" })).toHaveCount(0);
  await sheet.getByRole("button", { name: /Stop · something calm instead/ }).click();
  await page.keyboard.press("Escape");
  await page.getByText(/^Paused and resting/).click();
  await expect(page.getByText(`Paused after an upset: ‘${title}’`)).toBeVisible();
  await expect(songs.getByRole("button", { name: `${label}: play` })).toHaveCount(0);

  await page.getByRole("link", { name: "What works" }).first().click();
  await expect(page.getByText(`${title}: paused`)).toBeVisible();
});

test("the example Margaret opens as a read-only gallery that has learned", async ({ page, request }) => {
  await page.goto("/people");
  await page.getByRole("link", { name: /Example: Margaret/ }).click();
  await expect(page).toHaveURL(/\/p\/margaret-x$/);
  await expect(page.getByRole("region", { name: "Works for Margaret" })).toBeVisible();
  await expect(page.getByRole("region", { name: "New tries" })).toBeVisible();
  expect((await request.post("/api/people/margaret-x/plays", { data: { itemKey: "x", type: "song", title: "x", response: "sang" } })).status()).toBe(403);
});

test("a photo of a paper This is me is read into the chat box to check and send", async ({ page }) => {
  await page.goto("/people/new");
  await page.getByLabel("The name they like to be called").fill("Joan");
  await page.getByRole("button", { name: "Start their story" }).click();
  await expect(page).toHaveURL(/\/p\/[A-Za-z0-9_-]{10}\/story$/);
  await page.locator('input[type="file"]').setInputFiles("tests/e2e/fixtures/this-is-me.png");
  await expect(page.getByText("Here's what I read from the page")).toBeVisible();
  await expect(page.getByLabel("Tell the Go-Between about Joan")).toHaveValue(/Where I grew up/);
});

test("a landing example goes through consent, waits with a send cue, and is the same person the second time", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /^Joan/ }).click();
  await expect(page).toHaveURL(/\/people\/new\?example=joan$/);
  await expect(page.getByText("Consent")).toBeVisible();
  await page.getByRole("button", { name: "Start Joan’s story" }).click();
  await expect(page).toHaveURL(/\/p\/[A-Za-z0-9_-]{10}\/story\?example=joan$/);
  const first = page.url().match(/\/p\/([^/]+)\//)![1];
  await expect(page.getByText("Joan's story is in the box. Tap Send to read it.")).toBeVisible();

  await page.goto("/people/new?example=joan");
  await page.getByRole("button", { name: "Start Joan’s story" }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${first}/story\\?example=joan$`));
});
