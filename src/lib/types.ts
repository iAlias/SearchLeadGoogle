// Tipi condivisi del dominio "lead".

export type Category =
  | "ristorante"
  | "bar"
  | "negozio"
  | "parrucchiere"
  | "estetista"
  | "sanitario" // fisioterapisti, psicologi, nutrizionisti, osteopati, dentisti, logopedisti, podologi
  | "studio_tecnico" // avvocati, commercialisti, geometri, architetti, notai, consulenti
  | "veterinario"
  | "officina"
  | "hotel"
  | "generico";

export interface Review {
  author: string;
  rating: number;
  text: string;
}

export interface OpeningPeriod {
  day: string;
  hours: string;
}

// Risultato grezzo della ricerca (da Places API o scraper), prima del salvataggio.
export interface RawLead {
  placeId?: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  photos: string[];
  hours: OpeningPeriod[] | null;
  topReviews: Review[];
  lat?: number;
  lng?: number;
}
