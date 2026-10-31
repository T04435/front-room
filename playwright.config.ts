import { defineConfig, devices } from "@playwright/test";

/**
 * E2e runs on its own port against a server started in offline mode (fixture Qloo data, mock curator), so a run never
 * spends the shared Qloo key or the model. global-setup refuses to test a server that isn't offline.
 */
const PORT = 3510;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? "100%" : undefined,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  // The dev server compiles each page on first visit, several at once: 5 s is too short for that.
  expect: { timeout: 20_000 },
  timeout: 90_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { FRONT_ROOM_OFFLINE: "1", DATABASE_URL: "", NEXT_DIST_DIR: ".next-e2e" },
  },
});
