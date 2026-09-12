// Wrapper su whatsapp-web.js (metodo non ufficiale, gratis).
// Client singleton tenuto vivo sul processo del server (next dev/start e persistente).
// Caricamento lazy: se la libreria non e installata, lo stato lo segnala senza crashare.

type WaState = "disconnected" | "initializing" | "qr" | "authenticated" | "ready" | "error";

interface WaStore {
  client: any | null;
  state: WaState;
  qrDataUrl: string | null;
  error: string | null;
  initPromise: Promise<void> | null;
  lastMessageAt: number;
}

const g = globalThis as unknown as { __wa?: WaStore };
if (!g.__wa) {
  g.__wa = { client: null, state: "disconnected", qrDataUrl: null, error: null, initPromise: null, lastMessageAt: 0 };
}
const store = g.__wa;

export function getWaStatus() {
  return {
    state: store.state,
    qr: store.qrDataUrl,
    error: store.error,
  };
}

export async function initWhatsApp(): Promise<void> {
  if (store.state === "ready" || store.state === "authenticated") return;
  if (store.initPromise) return store.initPromise;

  store.initPromise = (async () => {
    store.state = "initializing";
    store.error = null;
    store.qrDataUrl = null;

    let WAWeb: any;
    let QRCode: any;
    try {
      WAWeb = await import("whatsapp-web.js");
      QRCode = (await import("qrcode")).default ?? (await import("qrcode"));
    } catch {
      store.state = "error";
      store.error = "whatsapp-web.js non installato. Esegui `npm install`.";
      store.initPromise = null;
      return;
    }

    const { Client, LocalAuth } = WAWeb.default ?? WAWeb;

    try {
      const client = new Client({
        authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
        puppeteer: {
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      });

      client.on("qr", async (qr: string) => {
        store.state = "qr";
        try {
          store.qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
        } catch {
          store.qrDataUrl = null;
        }
      });
      client.on("authenticated", () => {
        store.state = "authenticated";
        store.qrDataUrl = null;
      });
      client.on("ready", () => {
        store.state = "ready";
        store.qrDataUrl = null;
      });
      client.on("auth_failure", (m: string) => {
        store.state = "error";
        store.error = "Autenticazione fallita: " + m;
      });
      client.on("disconnected", () => {
        store.state = "disconnected";
        store.client = null;
      });

      // Le risposte in arrivo. Senza questo il follow-up parte anche a chi
      // ha già scritto "no grazie", e la promessa fatta nell'email resta
      // una frase gentile senza niente dietro.
      client.on("message", (msg: any) => {
        void gestisciMessaggio(msg);
      });

      store.client = client;
      await client.initialize();
    } catch (e) {
      store.state = "error";
      store.error = (e as Error).message;
    } finally {
      store.initPromise = null;
    }
  })();

  return store.initPromise;
}

export async function logoutWhatsApp(): Promise<void> {
  if (store.client) {
    try {
      await store.client.logout();
      await store.client.destroy();
    } catch {
      /* ignora */
    }
  }
  store.client = null;
  store.state = "disconnected";
  store.qrDataUrl = null;
}

export async function sendWhatsApp(phoneWa: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (store.state !== "ready" || !store.client) {
    return { ok: false, error: "WhatsApp non connesso. Vai su /whatsapp e scansiona il QR." };
  }
  try {
    const chatId = `${phoneWa}@c.us`;
    // Verifica che il numero sia registrato su WhatsApp prima di inviare.
    const registered = await store.client.isRegisteredUser(chatId).catch(() => true);
    if (!registered) return { ok: false, error: "Numero non su WhatsApp" };
    await store.client.sendMessage(chatId, message);
    store.lastMessageAt = Date.now();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function isWaReady(): boolean {
  return store.state === "ready";
}

/**
 * Un messaggio in arrivo da una chat privata. I gruppi, gli stati e i
 * messaggi inviati da noi non sono risposte e vanno ignorati: solo il
 * mittente vero conta.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function gestisciMessaggio(msg: any): Promise<void> {
  try {
    const from: string = String(msg?.from || "");
    if (!from.endsWith("@c.us")) return; // gruppo, canale o stato
    if (msg?.fromMe) return;
    const testo: string = String(msg?.body || "").trim();
    if (!testo) return;

    const numero = from.replace("@c.us", "").replace(/\D/g, "");
    if (!numero) return;

    // Import differito: tiene fuori il database dal percorso di avvio del
    // client, che deve poter partire anche se il resto non è pronto.
    const { handleInbound } = await import("./inbound");
    await handleInbound({ from: numero, channel: "whatsapp", text: testo });
  } catch (e) {
    console.error("wa inbound:", (e as Error).message);
  }
}
