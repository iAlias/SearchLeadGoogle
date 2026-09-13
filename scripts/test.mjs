// Trova i file di test e li passa a tsx.
//
// Sembra un giro lungo per sostituire un glob, e infatti lo era: prima lo
// script era `tsx --test src/lib/**/*.test.ts`, che funziona su Windows —
// dove il pattern arriva intatto a Node, che lo espande — e fallisce in
// silenzio su Linux, dove la shell POSIX riduce `**` a `*` e il pattern non
// combacia con niente. Il primo giro di integrazione continua l'ha scoperto
// subito. Qui i file li cerchiamo noi: nessuna shell di mezzo, stesso
// comportamento ovunque.

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const CARTELLA = "src/lib";

const test = readdirSync(CARTELLA)
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => join(CARTELLA, f))
  .sort();

if (test.length === 0) {
  console.error(`Nessun test trovato in ${CARTELLA}/`);
  process.exit(1);
}

// `node --import tsx` invece del comando `tsx`: così non serve che
// node_modules/.bin sia nel PATH, e funziona anche lanciando questo file a
// mano, non solo tramite npm.
const esito = spawnSync(process.execPath, ["--import", "tsx", "--test", ...test], { stdio: "inherit" });
process.exit(esito.status ?? 1);
