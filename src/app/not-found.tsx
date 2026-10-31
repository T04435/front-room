import Link from "next/link";
import { AgentMark } from "@/components/front-room/agent";
import { Button } from "@/components/ui/button";

/** Not found: a person's link that doesn't exist (or a typo). */
export default function NotFound() {
  return (
    <div className="grid max-w-xl gap-5">
      <AgentMark state="none" size={48} />
      <h1 className="font-heading text-[34px] leading-[40px]">Nothing here</h1>
      <p className="text-muted-foreground">That link doesn&apos;t lead to anyone. A person&apos;s page is their private link: check it was copied in full, or start from People.</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/people">People</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
