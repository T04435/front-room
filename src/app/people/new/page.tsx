import { ConsentForm } from "@/components/consent-form";

export default function NewPersonPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="font-heading text-[34px] leading-[40px]">Add someone</h1>
        <p className="text-muted-foreground">Use a fictional person for this demo.</p>
      </div>
      <ConsentForm />
    </div>
  );
}
