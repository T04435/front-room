import { redirect } from "next/navigation";

/** The v1 one-off kit builder is gone: a person's page is now a chat, then their gallery. Old links land on People. */
export default function Quick() {
  redirect("/");
}
