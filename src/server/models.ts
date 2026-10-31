import "server-only";

/** Model ids on Vercel AI Gateway (plain strings; OIDC on Vercel, AI_GATEWAY_API_KEY locally). */
export const MODELS = {
  curator: "anthropic/claude-sonnet-5.5",
} as const;

export const LIMITS = {
  curatorMaxOutputTokens: 4000,
  curatorTimeoutMs: 90_000,
} as const;
