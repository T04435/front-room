import { z } from "zod";
import { emptyPerson } from "@/lib/person";
import { consentSchema } from "@/lib/person-schema";
import { deviceId } from "@/server/limits";
import { linkDevice, newPersonId, savePerson } from "@/server/people";

const body = z.object({ preferredName: z.string().trim().min(1).max(40), consent: consentSchema });

/** Adds a person to this device's list. Their id is their private link. */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Give the name they like to be called, and who is telling their story." }, { status: 400 });
  const person = await savePerson(emptyPerson(newPersonId(), parsed.data.preferredName, parsed.data.consent));
  await linkDevice(deviceId(request.headers.get("cookie")), person.id);
  return Response.json({ id: person.id });
}
