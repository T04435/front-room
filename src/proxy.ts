import { NextResponse, type NextRequest } from "next/server";
import { DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, isDeviceId } from "@/lib/device";

/** Gives each browser its device cookie on its first page, so the API's per-device limits and saved kits can use it. */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (!isDeviceId(request.cookies.get(DEVICE_COOKIE)?.value)) {
    response.cookies.set(DEVICE_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico).*)"],
};
