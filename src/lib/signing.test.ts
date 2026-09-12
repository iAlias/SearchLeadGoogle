import { test } from "node:test";
import assert from "node:assert/strict";
import { makeToken, readToken, sign, verify, randomSecret } from "./signing";

const SEGRETO = "un-segreto-qualunque-ma-lungo";

test("una firma valida viene riconosciuta", async () => {
  const s = await sign(SEGRETO, "ciao");
  assert.equal(await verify(SEGRETO, "ciao", s), true);
});

test("una firma fatta con un altro segreto non passa", async () => {
  const s = await sign("altro-segreto", "ciao");
  assert.equal(await verify(SEGRETO, "ciao", s), false);
});

test("cambiare il messaggio invalida la firma", async () => {
  const s = await sign(SEGRETO, "ciao");
  assert.equal(await verify(SEGRETO, "ciaò", s), false);
});

test("il gettone restituisce i dati che gli abbiamo messo dentro", async () => {
  const t = await makeToken(SEGRETO, { e: "info@trattoria.it" });
  const data = await readToken<{ e: string }>(SEGRETO, t);
  assert.equal(data?.e, "info@trattoria.it");
});

test("un gettone manomesso non viene letto", async () => {
  const t = await makeToken(SEGRETO, { e: "info@trattoria.it" });
  const [payload, firma] = t.split(".");
  const altroPayload = Buffer.from(JSON.stringify({ e: "vittima@altrodominio.it" }))
    .toString("base64url");
  assert.equal(await readToken(SEGRETO, `${altroPayload}.${firma}`), null);
  assert.equal(await readToken(SEGRETO, `${payload}.AAAA`), null);
  assert.equal(await readToken(SEGRETO, "senza-punto"), null);
  assert.equal(await readToken(SEGRETO, ""), null);
});

test("un gettone scaduto non vale più", async () => {
  const t = await makeToken(SEGRETO, { u: "admin" }, -1);
  assert.equal(await readToken(SEGRETO, t), null);
});

test("un gettone senza scadenza vale per sempre: i link di disiscrizione non scadono", async () => {
  const t = await makeToken(SEGRETO, { e: "info@trattoria.it" });
  const data = await readToken<{ exp?: number }>(SEGRETO, t);
  assert.equal(data?.exp, undefined);
});

test("il gettone è sicuro dentro un URL", async () => {
  const t = await makeToken(SEGRETO, { e: "nome.cognome+tag@dominio.it" });
  assert.equal(encodeURIComponent(t), t);
});

test("due segreti casuali non coincidono", () => {
  assert.notEqual(randomSecret(), randomSecret());
  assert.ok(randomSecret().length >= 40);
});
