import { ConsentForm } from "@/components/consent-form";
import { exampleById } from "@/lib/examples";

export default async function NewPersonPage({ searchParams }: PageProps<"/people/new">) {
  const q = await searchParams;
  const example = exampleById(typeof q.example === "string" ? q.example : undefined);
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="font-heading text-[34px] leading-[40px]">Add someone</h1>
        <p className="text-muted-foreground">Use a fictional person for this demo.</p>
      </div>
      <ConsentForm key={example?.id ?? "new"} initialExample={example} />
    </div>
  );
}
