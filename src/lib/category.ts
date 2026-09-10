import type { Category } from "./types";

// Mappa parole chiave italiane → categoria interna, per scegliere il template demo.
//
// "veterinario", "sanitario" e "studio_tecnico" erano prima un'unica categoria
// generica ("studio_professionale"), riconosciuta con la parola "studio" da
// sola — che intercettava qualunque cosa, da uno studio legale a uno studio
// fotografico. Sono le tre categorie scelte nello studio di mercato: qui le
// parole chiave restano specifiche della professione apposta, non del fatto
// che qualcuno lavori in uno "studio".
const RULES: Array<{ cat: Category; words: string[] }> = [
  { cat: "ristorante", words: ["ristorant", "trattoria", "pizzeri", "osteria", "agriturism", "tavola calda", "rosticceri", "braceria", "sushi"] },
  { cat: "bar", words: ["bar", "caffe", "caffetteria", "pasticceri", "gelateri", "pub", "birreria", "enoteca"] },
  { cat: "parrucchiere", words: ["parrucchier", "barbier", "hair", "acconciat"] },
  { cat: "estetista", words: ["estetist", "centro estetico", "beauty", "nail", "spa", "benessere", "massagg"] },
  { cat: "officina", words: ["officina", "autoriparaz", "gommista", "carrozzeri", "meccanic", "autolavagg", "elettrauto"] },
  { cat: "hotel", words: ["hotel", "b&b", "bed and breakfast", "albergo", "affittacamere", "residence", "pensione"] },
  { cat: "veterinario", words: ["veterinari", "toelettatur", "pet shop", "petshop"] },
  { cat: "sanitario", words: ["fisioterap", "psicolog", "psicoterap", "nutrizion", "dietist", "dietolog", "osteopat", "podolog", "logoped", "dentist", "odontoiatr", "poliambulator", "ambulatorio medico"] },
  { cat: "studio_tecnico", words: ["avvocat", "commercialist", "ragionier", "geometr", "architett", "ingegner", "notaio", "consulente del lavoro", "consulenza fiscal", "tributarist", "studio legale", "studio tecnico", "studio notarile", "studio di architettura", "studio di ingegneria"] },
  { cat: "negozio", words: ["negozio", "boutique", "abbigliament", "ferrament", "ottica", "gioielleri", "fioraio", "libreria", "cartoleri", "store", "shop", "macelleri", "panifici", "alimentari"] },
];

export function detectCategory(input: string): Category {
  const s = (input || "").toLowerCase();
  for (const rule of RULES) {
    if (rule.words.some((w) => s.includes(w))) return rule.cat;
  }
  return "generico";
}

export const CATEGORY_LABEL: Record<Category, string> = {
  ristorante: "Ristorante",
  bar: "Bar / Caffetteria",
  negozio: "Negozio",
  parrucchiere: "Parrucchiere / Barbiere",
  estetista: "Centro estetico",
  sanitario: "Studio sanitario",
  studio_tecnico: "Studio tecnico / legale",
  veterinario: "Veterinario",
  officina: "Officina / Auto",
  hotel: "Hotel / B&B",
  generico: "Attività",
};
