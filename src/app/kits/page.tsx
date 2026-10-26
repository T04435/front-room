import { redirect } from "next/navigation";

/** The v1 saved-kits list is gone (no sessions in v2). Saved kit links (/kits/<id>) still open. */
export default function Kits() {
  redirect("/people");
}
