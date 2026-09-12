import { makeToken, readToken } from "./signing";

// Protezione con una password sola, spenta finché non la si imposta.
//
// Finché il tool gira su localhost non serve a niente e sarebbe solo un
// fastidio. Ma nel momento in cui lo si mette su un server per raggiungerlo
// da fuori casa — ed è il motivo per cui esiste il cron, quindi succederà —
// senza protezione chiunque trovi l'indirizzo può leggere tutti i contatti,
// lanciare ricerche a spese tue e spedire email dal tuo dominio.
//
// Il segreto di firma è la password stessa: cambiarla invalida di colpo
// tutte le sessioni aperte, che è esattamente quello che ci si aspetta.

export const AUTH_COOKIE = "lm_sessione";
const DURATA_S = 30 * 24 * 60 * 60;

export function authEnabled(): boolean {
  return !!(process.env.APP_PASSWORD && process.env.APP_PASSWORD.length > 0);
}

function segreto(): string {
  return `sessione:${process.env.APP_PASSWORD || ""}`;
}

export async function createSession(): Promise<string> {
  return makeToken(segreto(), { v: 1 }, DURATA_S);
}

export async function validSession(token: string | undefined | null): Promise<boolean> {
  if (!authEnabled()) return true;
  if (!token) return false;
  return (await readToken<{ v: number }>(segreto(), token)) !== null;
}

/** Confronto senza scorciatoie sulla lunghezza, per non regalare indizi. */
export function passwordMatches(candidata: string): boolean {
  const attesa = process.env.APP_PASSWORD || "";
  if (!attesa) return false;
  if (candidata.length !== attesa.length) return false;
  let diff = 0;
  for (let i = 0; i < attesa.length; i++) diff |= candidata.charCodeAt(i) ^ attesa.charCodeAt(i);
  return diff === 0;
}

/**
 * Le pagine che devono restare aperte a chi non ha (e non deve avere) un
 * account qui dentro: la demo che mandiamo al cliente, le sue foto, la
 * disiscrizione, l'informativa, e i due ingressi automatici.
 */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/demo/") ||
    pathname.startsWith("/api/photo") ||
    pathname.startsWith("/api/unsubscribe") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/login") ||
    pathname === "/login" ||
    pathname === "/privacy" ||
    pathname === "/favicon.ico"
  );
}
