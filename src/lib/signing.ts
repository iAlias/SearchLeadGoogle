// Firma HMAC-SHA256 con la Web Crypto API, così lo stesso codice vale sia
// nelle route Node sia nel middleware, che gira su un runtime dove
// `node:crypto` non esiste.
//
// Serve a due cose diverse ma con lo stesso problema di fondo — un dato che
// viaggia fuori dal server e torna indietro, e di cui bisogna sapere se è
// ancora quello che avevamo scritto noi:
//   - i link di disiscrizione (nessuno deve poter disiscrivere un altro);
//   - il cookie di sessione, quando l'app è protetta da password.

const enc = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function sign(secret: string, payload: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

/** Confronto a tempo costante: lo fa `crypto.subtle.verify`, non noi. */
export async function verify(secret: string, payload: string, signature: string): Promise<boolean> {
  try {
    const key = await importKey(secret);
    return await crypto.subtle.verify("HMAC", key, fromBase64Url(signature).slice(), enc.encode(payload));
  } catch {
    return false;
  }
}

/**
 * Un gettone autoconsistente: dati in chiaro (leggibili, non segreti) più la
 * firma che ne impedisce la manomissione. `exp` è opzionale perché un link
 * di disiscrizione deve funzionare per sempre, anche a distanza di anni.
 */
export async function makeToken(secret: string, data: Record<string, unknown>, ttlSeconds?: number): Promise<string> {
  const body: Record<string, unknown> = { ...data };
  if (ttlSeconds) body.exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = toBase64Url(enc.encode(JSON.stringify(body)));
  const signature = await sign(secret, payload);
  return `${payload}.${signature}`;
}

export async function readToken<T = Record<string, unknown>>(secret: string, token: string): Promise<T | null> {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!(await verify(secret, payload, signature))) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as T & { exp?: number };
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Segreto casuale, per quando non ne è stato configurato uno a mano. */
export function randomSecret(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toBase64Url(buf);
}
