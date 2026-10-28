import { z } from "zod";
import { emptyPerson } from "@/lib/person";
import { consentSchema } from "@/lib/person-schema";
import { deviceId } from "@/server/limits";
import { exampleById } from "@/lib/examples";
import { exampleOnDevice, linkDevice, newPersonId, savePerson } from "@/server/people";

const body = z.object({ preferredName: z.string().trim().min(1).max(40), consent: consentSchema, example: z.string().max(20).optional() });

/** Adds a person to this device's list. Their id is their private link. */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Give the name they like to be called, and who is telling their story." }, { status: 400 });
  const device = deviceId(request.headers.get("cookie"));
  const example = exampleById(parsed.data.example);
  // An example story already started on this device is reused, with the consent just given (A11).
  const before = example ? await exampleOnDevice(device, example.id) : null;
  if (before) {
    await savePerson({ ...before, consent: parsed.data.consent });
    return Response.json({ id: before.id, told: before.places.length > 0 });
  }
  const person = await savePerson({ ...emptyPerson(newPersonId(), parsed.data.preferredName, parsed.data.consent), ...(example ? { exampleOf: example.id } : {}) });
  await linkDevice(device, person.id);
  return Response.json({ id: person.id, told: false });
}
