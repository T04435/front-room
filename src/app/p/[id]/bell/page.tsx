import { notFound, redirect } from "next/navigation";
import { BellDeck } from "@/components/bell-deck";
import { missingMinimum } from "@/lib/person";
import { getPerson } from "@/server/people";

export const dynamic = "force-dynamic";

export default async function BellPage({ params }: PageProps<"/p/[id]/bell">) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();
  if (missingMinimum(person).length) redirect(`/p/${id}/story`);
  return <BellDeck initial={person} />;
}
