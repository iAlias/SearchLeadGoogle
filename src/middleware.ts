import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authEnabled, isPublicPath, validSession } from "@/lib/auth";

// Senza APP_PASSWORD non fa niente: il tool resta com'era, aperto, che su
// localhost è la cosa giusta. Con la password impostata, tutto ciò che non è
// pubblico per forza (la demo del cliente, la disiscrizione, l'informativa,
// i webhook) chiede di entrare.

export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  if (await validSession(req.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();

  // Alle chiamate API si risponde con un errore, non con una pagina di
  // login: chi le fa è codice, non una persona davanti a un browser.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = pathname === "/" ? "" : `?da=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
