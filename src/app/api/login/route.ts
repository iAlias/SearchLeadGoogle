import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authEnabled, createSession, passwordMatches } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Un piccolo ritardo fisso su ogni tentativo: rende inutile provare
// password a raffica, e non si nota quando la password è quella giusta.
const RITARDO_MS = 400;

export async function POST(req: NextRequest) {
  if (!authEnabled()) {
    return NextResponse.json({ error: "Nessuna password configurata" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const password = String(body.password || "");

  await new Promise((r) => setTimeout(r, RITARDO_MS));

  if (!passwordMatches(password)) {
    return NextResponse.json({ error: "Password sbagliata" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await createSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
