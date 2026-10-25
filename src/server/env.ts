import "server-only";
import { z } from "zod";

/**
 * Validated, server-only environment. Never log values from here:
 * `providerStatus()` reports booleans only.
 */
const secret = z
  .string()
  .optional()
  .transform((value) => {
    // Values pulled from Vercel can arrive wrapped in quotes.
    const trimmed = value?.trim().replace(/^"(.*)"$/, "$1");
    return trimmed && trimmed.toUpperCase() !== "SET_ME" ? trimmed : undefined;
  });

const schema = z.object({
  QLOO_API_KEY: secret,
  QLOO_API_BASE_URL: z.url().default("https://hackathon.api.qloo.com"),
  /**
   * NotOnQ's drop-in API: every Qloo call goes through it first, with our own QLOO_API_KEY (NotOnQ issues no keys),
   * and falls back to Qloo directly. The app names itself in the base URL, so NotOnQ's ledger shows the traffic
   * apart: production's /q/app/music-care on Vercel, a local NotOnQ's /q/app/music-care-dev in development, unless
   * NOTONQ_BASE_URL is set.
   */
  NOTONQ_BASE_URL: z.url().optional(),
  /** "1": skip NotOnQ and call Qloo directly. */
  NOTONQ_DISABLED: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
  AI_GATEWAY_API_KEY: secret,
  VERCEL_OIDC_TOKEN: secret,
  /** "1" on Vercel, where the AI Gateway authenticates with the project's OIDC token at request time. */
  VERCEL: z.string().optional(),
  /** Neon Postgres (Vercel integration): saved kits and response logs. Without it, PGlite in .data/. */
  DATABASE_URL: secret,
  /** "1": tests and e2e. Fixture Qloo data and a mock model; nothing paid is called. */
  MUSIC_CARE_OFFLINE: z.string().optional(),
});

export const env = schema.parse(process.env);

export const offline = () => env.MUSIC_CARE_OFFLINE === "1";

export function providerStatus() {
  return {
    offline: offline(),
    qloo: offline() || Boolean(env.QLOO_API_KEY),
    notonq: !offline() && env.NOTONQ_DISABLED !== "1" && Boolean(env.QLOO_API_KEY),
    aiGateway: offline() || Boolean(env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN || env.VERCEL === "1"),
    database: Boolean(env.DATABASE_URL),
  };
}
