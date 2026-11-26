import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, pinToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const pin = process.env.FAMILY_PIN;
  if (!pin) return NextResponse.next(); // PIN disattivato (sviluppo locale)
  const cookie = req.cookies.get(COOKIE)?.value;
  if (cookie && cookie === (await pinToken(pin))) return NextResponse.next();
  // The Android app sends the PIN in a header
  if (req.nextUrl.pathname.startsWith("/api/") && req.headers.get("x-family-pin") === pin) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "PIN richiesto" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|app-ZhwyxOn9cRbJDv4M/|_next/|manifest.webmanifest|icon.svg|favicon.ico).*)"],
};
