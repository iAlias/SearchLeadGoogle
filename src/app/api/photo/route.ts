import { NextRequest } from "next/server";
import { isValidPhotoRef, placesMediaUrl, PHOTO_MAX_H, PHOTO_MAX_W } from "@/lib/photos";

export const runtime = "nodejs";

// Le foto di Google Places si scaricano solo presentando la chiave API.
// Questo è l'unico posto dove la chiave viene usata per le foto: la demo
// pubblica punta qui, e chi legge il sorgente della demo non trova niente
// di riutilizzabile.
//
// `ref` è vincolato alla forma places/<id>/photos/<ref>, quindi questa route
// non può essere piegata a scaricare un indirizzo qualunque per conto di chi
// la chiama.
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref") || "";
  if (!isValidPhotoRef(ref)) {
    return new Response("Riferimento foto non valido", { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return new Response("Foto non disponibile: nessuna chiave Places configurata", { status: 404 });
  }

  const w = clamp(Number(req.nextUrl.searchParams.get("w")) || PHOTO_MAX_W, 80, 4000);
  const h = clamp(Number(req.nextUrl.searchParams.get("h")) || PHOTO_MAX_H, 80, 4000);

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const upstream = await fetch(placesMediaUrl(ref, apiKey, w, h), {
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(t);

    if (!upstream.ok || !upstream.body) {
      return new Response("Foto non disponibile", { status: 404 });
    }

    const type = upstream.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) {
      return new Response("Foto non disponibile", { status: 404 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": type,
        // Le foto di una scheda non cambiano quasi mai: ogni richiesta
        // risparmiata è credito Places non consumato.
        "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable",
      },
    });
  } catch {
    return new Response("Foto non raggiungibile", { status: 504 });
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}
