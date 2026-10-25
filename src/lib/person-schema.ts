import { z } from "zod";
import { CONSENT_BASIS, CONSENT_BY, HEARD_KINDS, LOVE_SOURCES, LOVE_TYPES, MOMENT_KINDS, STEER_KINDS, STEER_LEVELS } from "./person";

/** What the API accepts for a person: every field the story holds, bounded. The id, dates and example flag are the server's. */
const text = (max: number) => z.string().trim().max(max);
const year = z.number().int().min(1900).max(2100).nullable();
const id = z.string().min(1).max(40);

export const consentSchema = z.object({ by: z.enum(CONSENT_BY), basis: z.enum(CONSENT_BASIS), role: text(60).optional(), at: z.string().max(40) });

export const personPatchSchema = z
  .object({
    preferredName: text(40),
    birthYear: year,
    decade: year,
    languages: z.array(text(30)).max(5),
    consent: consentSchema.nullable(),
    places: z.array(z.object({ id, name: text(80).min(1), label: text(120).optional(), fromYear: year, toYear: year, role: text(60).optional() })).max(12),
    moments: z.array(z.object({ id, kind: z.enum(MOMENT_KINDS), year, label: text(120).min(1), venue: text(80).optional() })).max(30),
    loves: z
      .array(
        z.object({
          id,
          type: z.enum(LOVE_TYPES),
          title: text(120).min(1),
          by: text(80).optional(),
          year: year.optional(),
          qlooId: text(80).optional(),
          source: z.enum(LOVE_SOURCES),
          quote: text(200).optional(),
          placeId: id.optional(),
        }),
      )
      .max(200),
    steers: z.array(z.object({ id, kind: z.enum(STEER_KINDS), label: text(60).min(1), level: z.enum(STEER_LEVELS), source: z.enum(["family", "logged"]), at: z.string().max(40) })).max(50),
    steerAsked: z.boolean(),
    practical: z.object({
      calms: text(200).optional(),
      bestTime: text(60).optional(),
      hearing: text(120).optional(),
      headphonesOk: z.boolean().nullable().optional(),
      greeting: text(120).optional(),
      work: text(200).optional(),
      faith: z.object({ stance: z.enum(["yes", "no", "keep_out"]), label: text(60).optional() }).optional(),
    }),
    staffHeard: z.array(z.object({ id, kind: z.enum(HEARD_KINDS), text: text(200).min(1), at: z.string().max(40), kitId: text(20).optional(), confirmed: z.boolean().optional() })).max(100),
    resolvedUpsets: z.array(text(200)).max(200),
  })
  .partial();
export type PersonPatch = z.infer<typeof personPatchSchema>;
