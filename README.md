# Lead Machine

**Trova attività locali → genera una demo col loro nome e dati reali → contattale via email + WhatsApp. In automatico.**

Inserisci `ristorante` + `Catania` (o `Sicilia`, o `Italia`) e il tool cerca le attività su Google,
recupera **telefono ed email**, capisce chi **non ha un sito o ce l'ha scadente**, e prepara per ognuna
una **demo personalizzata** pronta da mostrare. Poi invii email e follow-up WhatsApp con un clic.

Niente porta a porta.

---

## Avvio (3 comandi)

Richiede Node.js ≥ 20.

```bash
npm install          # installa tutto (scarica anche Chromium per lo scraping)
npm run db:push      # crea il database SQLite
npm run dev          # http://localhost:3000
```

Apri **http://localhost:3000**, scrivi tipo attività + luogo, premi **Avvia ricerca**.

Se stai aggiornando un database creato con una versione precedente, dopo `db:push` lancia una volta:

```bash
npm run db:backfill  # calcola i punteggi e toglie la chiave Google dalle foto già salvate
```

---

## Come funziona (il flusso)

1. **Cerca** (home): tipo attività + città/regione/nazione → lista di attività con telefono, email, stato del sito.
2. **Lead**: la lista è ordinata per punteggio, dal contatto più promettente in giù (chi non ha un sito e si
   può raggiungere viene per primo). Spunti i migliori, premi **Genera demo**, poi **Approva**.
3. **Lancia invio**: email a chi ha un indirizzo; dopo N giorni senza risposta parte il follow-up WhatsApp.
   Il giro va avanti in background: puoi chiudere la pagina, e puoi fermarlo a metà.
4. La demo è una pagina pubblica `/demo/...` con i **dati reali** dell'attività e una CTA che porta a te.
5. Quando qualcuno risponde, il sistema se ne accorge: chi scrive "no grazie" viene **spento su tutti i
   canali**, chi risponde qualcos'altro non riceve più il follow-up.

---

## Configurazione (`.env`)

Tutto è opzionale e **degrada con grazia**: il tool funziona anche senza chiavi.

| Variabile | Serve per | Senza |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | motore di ricerca veloce e completo (orari, recensioni, foto) | usa lo **scraping diretto di Google Maps** via Puppeteer (più lento, nessuna chiave) |
| `RESEND_API_KEY` + `EMAIL_FROM` | inviare email reali | le email vengono solo **registrate in console** (dry-run) |
| `RESEND_WEBHOOK_SECRET` | sapere chi apre, chi rimbalza e chi ti segnala come spam | quegli eventi non arrivano: continueresti a scrivere a indirizzi morti |
| `ANTHROPIC_API_KEY` | testi della demo scritti dall'AI | testo segnaposto credibile per categoria |
| `CRON_SECRET` | far partire invii e follow-up da soli | i follow-up partono solo premendo il pulsante |
| `APP_PASSWORD` | proteggere l'app con una password | nessuna protezione: chiunque raggiunga l'indirizzo entra |

### Google Places API (consigliato)
Crea una chiave su [console.cloud.google.com](https://console.cloud.google.com) → abilita **"Places API (New)"**.
Google offre crediti gratuiti generosi. Con la chiave ottieni anche orari, recensioni e foto reali nelle demo.

Le foto passano sempre da `/api/photo`: la chiave resta sul server e non finisce mai nell'HTML delle demo,
che sono pagine pubbliche.

### Resend (per inviare davvero)
Registrati su [resend.com](https://resend.com) → API Keys. 100 email/giorno gratis. Verifica il tuo dominio mittente.

Poi crea un webhook su [resend.com/webhooks](https://resend.com/webhooks) verso
`<APP_URL>/api/webhooks/resend`, con gli eventi *opened*, *bounced* e *complained*, e metti il segreto in
`RESEND_WEBHOOK_SECRET`. Un rimbalzo permanente o una segnalazione spam spengono il contatto da soli.

### Invii automatici
Chiama una o due volte al giorno:

```bash
curl -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron
```

Su Windows si imposta con l'Utilità di pianificazione. Il cron recupera le ricerche rimaste appese,
cancella i dati scaduti e fa partire il giro di invii rispettando i limiti giornalieri.

---

## WhatsApp

Pagina **WhatsApp** → **Connetti** → scansiona il QR con WhatsApp (Dispositivi collegati).
Metodo non ufficiale (`whatsapp-web.js`): **tieni il PC acceso** durante gli invii e rispetta i limiti
giornalieri (Impostazioni) per evitare blocchi. Ritardo anti-ban 30-90s tra messaggi, già attivo.

Le risposte in arrivo vengono lette: un "no grazie" spegne il contatto anche sull'email, e chi risponde
non riceve più il follow-up.

---

## Limiti e note oneste

- **Places API**: max ~60 risultati per query. Per coprire una città grande, lancia più ricerche con
  tipi diversi (pizzeria, trattoria, ristorante…).
- **Scraping Maps**: dipende dal layout di Google, può rallentare o saltare qualche scheda. La Places
  API è più affidabile.
- **Email**: trovata scrapando il sito dell'attività. Chi non ha sito → solo WhatsApp.
- **Un contatto, un messaggio**: la stessa attività trovata in due ricerche diverse riceve un solo
  messaggio; il doppione viene scartato con la motivazione.
- **Serve un processo sempre acceso**: SQLite, Puppeteer, WhatsApp e il giro di invii in background
  vogliono un server che non si spenga fra una richiesta e l'altra (`npm start` su una macchina tua,
  non una piattaforma serverless).
- I dati di esempio NON esistono: tutto ciò che vedi è reale, preso al momento.

---

## Privacy e cose da non sbagliare

I dati sono pubblici (Google, siti aziendali), ma restano dati personali quando dietro un'attività c'è
una persona. Il tool si comporta di conseguenza:

- ogni email porta un **link di disiscrizione firmato** e le intestazioni `List-Unsubscribe` che
  Gmail e Outlook si aspettano dal 2024. Il link agisce solo su conferma esplicita: una scansione
  automatica dei link non può disiscrivere nessuno per sbaglio;
- l'**informativa** è pubblicata su `/privacy` ed è collegata in fondo a ogni messaggio (art. 14 GDPR:
  i dati non li ha forniti il destinatario, quindi va detto da dove arrivano);
- chi chiede di essere lasciato in pace finisce in una lista di esclusione **permanente e valida su
  tutti i canali**, che vince anche su un'approvazione fatta a mano dopo;
- i contatti mai raggiunti da alcun messaggio vengono **cancellati da soli** dopo il numero di giorni
  impostato (180 di default);
- ogni invio, apertura, rimbalzo e risposta è annotato nel registro del lead.

Compila **nome ed email di contatto** in Impostazioni: finiscono nell'informativa, ed è quello che rende
il tutto riconducibile a una persona vera. Per un uso continuativo come professionista, regolati con
P.IVA e informativa tua.

---

## Impostazioni utili

In **Impostazioni**: il tuo nome e numero (per la CTA nelle demo), il listino mostrato, i testi di
email e WhatsApp (con segnaposto `{{nome}} {{citta}} {{demo}} {{prezzo}} {{venditore}}`), i limiti
giornalieri di invio, la conservazione dei dati, e un riepilogo di cosa è davvero configurato.

---

## Sviluppo

```bash
npm test          # 92 test sulle parti che decidono: chi contattare, come giudicare un sito,
                  # come firmare un link, come classificare una risposta
npm run build     # build di produzione
```

La logica delicata è isolata in funzioni pure e verificabili senza server né database:
`outreachPlan.ts` (chi viene contattato e chi no), `leadScore.ts` (l'ordine della lista),
`websiteCheck.ts` (il giudizio sul sito), `replies.ts` (rifiuto o interesse),
`photos.ts` (nessuna chiave nelle pagine pubbliche), `signing.ts` (i link firmati).

## Stack

Next.js 15 (App Router) · Prisma + SQLite · Google Places API / Puppeteer · Resend · whatsapp-web.js · Anthropic (opzionale).
