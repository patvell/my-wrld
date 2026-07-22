import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "wrld_key";

/**
 * Lightweight shared-secret gate for deployments. When APP_ACCESS_TOKEN is
 * set, every page and API request needs the matching cookie; opening any URL
 * once with ?key=<token> sets it (send your partner a link like
 * https://app.example.com/?key=...). When the env var is unset — local dev —
 * this is a no-op. Replaced by real auth in a later phase.
 */
export function proxy(request: NextRequest) {
  const token = process.env.APP_ACCESS_TOKEN;
  if (!token) return NextResponse.next();

  if (request.cookies.get(COOKIE_NAME)?.value === token) {
    return NextResponse.next();
  }

  const url = request.nextUrl;
  if (url.searchParams.get("key") === token) {
    const clean = url.clone();
    clean.searchParams.delete("key");
    const res = NextResponse.redirect(clean);
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return res;
  }

  if (url.pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return new NextResponse("my wrld — open your invite link to unlock this device.", {
    status: 401,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  // Gate pages and /api, skip Next internals and static files (anything with
  // a dot: icons, textures, manifest.webmanifest, favicon).
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
