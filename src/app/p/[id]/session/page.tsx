import { notFound, redirect } from "next/navigation";
import { SessionMode } from "@/components/session-mode";
import { GOALS, type Goal } from "@/lib/learning";
import { missingMinimum } from "@/lib/person";
import { getPerson } from "@/server/people";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params, searchParams }: PageProps<"/p/[id]/session">) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();
  if (missingMinimum(person).length) redirect(`/p/${id}/story`);
  const g = (await searchParams).goal;
  const goal = typeof g === "string" && (GOALS as readonly string[]).includes(g) ? (g as Goal) : null;
  return <SessionMode person={person} goal={goal} />;
}
