import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Server modules import "server-only", which throws outside React Server Components.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  // Offline: fixture Qloo answers and a mock curator, so unit tests never spend a paid call.
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node", env: { FRONT_ROOM_OFFLINE: "1", DATABASE_URL: "" }, testTimeout: 20_000 },
});
