import { exampleById } from "@/lib/examples";

/**
 * The landing page's examples (older links and forms): to the consent step, with the example picked. The person is
 * made there, once consent is given (A11), and reused if this device already started them.
 */
export async function POST(request: Request, ctx: RouteContext<"/start/[example]">) {
  const example = exampleById((await ctx.params).example);
  return Response.redirect(new URL(example ? `/people/new?example=${example.id}` : "/people/new", request.url), 303);
}
