import { appVersion } from "@/lib/version";

export const dynamic = "force-static";

export function GET() {
  return Response.json({ ...appVersion, deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null });
}
