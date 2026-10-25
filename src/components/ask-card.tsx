"use client";

import { MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireDescription,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire";
import type { AskField, Brief } from "@/lib/kit";

type Answers = NonNullable<Brief["answers"]>;

const QUESTIONS: Record<AskField, { title: string; description: string; placeholder: string; label: string; skip: "skipPlace" | "skipMusic" }> = {
  nearbyPlace: { title: "A bigger town or city nearby", description: "Qloo's taste data is by town and city.", placeholder: "e.g. Manchester", label: "Nearby town or city", skip: "skipPlace" },
  musicWords: { title: "The music they loved", description: "A singer, a band or a style, in your own words.", placeholder: "e.g. Irish ballads, Elvis, Motown", label: "Music they loved", skip: "skipMusic" },
};

/** The run's question when Qloo comes back empty, as shadcn's Questionnaire; answering carries the run on. */
export function AskCard({ fields, message, busy, onAnswer }: { fields: AskField[]; message: string; busy: boolean; onAnswer: (answers: Answers) => void }) {
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const answers: Answers = {};
    for (const f of fields) {
      const value = String(data.get(f) ?? "").trim();
      if (value.length >= 2) answers[f] = value;
    }
    onAnswer(answers);
  }
  return (
    <div className="grid gap-4 rounded-lg border-2 border-primary/40 p-4" aria-label="The run needs your answer" role="region">
      <p className="flex gap-2 text-sm font-medium">
        <MessageCircleQuestion className="mt-0.5 size-4 shrink-0" aria-hidden />
        {message}
      </p>
      <Questionnaire items={fields.map((name) => ({ name, required: true }))} onSubmit={submit}>
        {fields.map((f) => (
          <QuestionnaireItem key={f} name={f} required>
            <QuestionnaireTitle>{QUESTIONS[f].title}</QuestionnaireTitle>
            <QuestionnaireDescription>{QUESTIONS[f].description}</QuestionnaireDescription>
            <QuestionnaireInput aria-label={QUESTIONS[f].label} placeholder={QUESTIONS[f].placeholder} maxLength={f === "nearbyPlace" ? 80 : 120} />
          </QuestionnaireItem>
        ))}
        <QuestionnaireActions>
          <QuestionnaireSubmit disabled={busy}>Carry on</QuestionnaireSubmit>
          {/* Skip: carry on without the place, or with the music found so far. */}
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onAnswer(Object.fromEntries(fields.map((f) => [QUESTIONS[f].skip, true])) as Answers)}>
            Skip this
          </Button>
        </QuestionnaireActions>
      </Questionnaire>
    </div>
  );
}
