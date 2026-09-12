import type { RawLead, Review, OpeningPeriod } from "./types";
import { cityFromAddress } from "./utils";
import { isValidPhotoRef, photoProxyUrl } from "./photos";

// Client per la nuova Places API di Google (places.googleapis.com/v1).
// Restituisce lead strutturati: nome, indirizzo, telefono, sito, rating, foto, orari, recensioni.

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours",
  "places.reviews",
  "places.photos",
  "places.location",
  "nextPageToken",
].join(",");

export function hasPlacesKey(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

interface PlacesResponse {
  places?: GooglePlace[];
  nextPageToken?: string;
  error?: { message?: string; status?: string };
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  reviews?: Array<{
    rating?: number;
    text?: { text?: string };
    originalText?: { text?: string };
    authorAttribution?: { displayName?: string };
  }>;
  photos?: Array<{ name?: string }>;
  location?: { latitude?: number; longitude?: number };
}

function mapPlace(p: GooglePlace): RawLead {
  // Mai l'URL diretto di Google: conterrebbe la chiave API, e finirebbe
  // scritto nell'HTML di una demo pubblica. Si salva l'indirizzo del proxy,
  // che la chiave la tiene sul server.
  const photos: string[] = (p.photos || [])
    .slice(0, 5)
    .map((ph) => (ph.name && isValidPhotoRef(ph.name) ? photoProxyUrl(ph.name) : ""))
    .filter(Boolean);

  const topReviews: Review[] = (p.reviews || [])
    .slice(0, 3)
    .map((r) => ({
      author: r.authorAttribution?.displayName || "Cliente Google",
      rating: r.rating ?? 5,
      text: (r.text?.text || r.originalText?.text || "").slice(0, 320),
    }))
    .filter((r) => r.text);

  const hours: OpeningPeriod[] | null = p.regularOpeningHours?.weekdayDescriptions
    ? p.regularOpeningHours.weekdayDescriptions.map((line) => {
        const idx = line.indexOf(":");
        return idx > 0
          ? { day: line.slice(0, idx).trim(), hours: line.slice(idx + 1).trim() }
          : { day: line, hours: "" };
      })
    : null;

  const address = p.formattedAddress;
  return {
    placeId: p.id,
    name: p.displayName?.text || "Senza nome",
    address,
    city: cityFromAddress(address),
    phone: p.nationalPhoneNumber || p.internationalPhoneNumber,
    website: p.websiteUri,
    rating: p.rating,
    reviewCount: p.userRatingCount ?? 0,
    photos,
    hours,
    topReviews,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
  };
}

/**
 * Cerca attivita via Places API Text Search. Pagina fino a `target` risultati
 * (Google ne restituisce ~20 per pagina, max ~60 totali per query).
 */
export async function searchPlaces(
  businessType: string,
  location: string,
  target = 60
): Promise<RawLead[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY mancante");

  const textQuery = `${businessType} a ${location}`;
  const out: RawLead[] = [];
  let pageToken: string | undefined;
  let guard = 0;

  do {
    const body: Record<string, unknown> = {
      textQuery,
      languageCode: "it",
      regionCode: "IT",
      maxResultCount: 20,
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as PlacesResponse;
    if (!res.ok || data.error) {
      const msg = data.error?.message || `HTTP ${res.status}`;
      throw new Error(`Places API: ${msg}`);
    }

    for (const place of data.places || []) out.push(mapPlace(place));

    pageToken = data.nextPageToken;
    guard++;
    // la pagina successiva di Places richiede un breve ritardo per attivarsi
    if (pageToken && out.length < target) await new Promise((r) => setTimeout(r, 1500));
  } while (pageToken && out.length < target && guard < 5);

  return out.slice(0, target);
}
