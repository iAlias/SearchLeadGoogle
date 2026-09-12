"use client";

import { useEffect, useState } from "react";

interface Stato {
  email: boolean; places: boolean; ai: boolean; webhook: boolean; cron: boolean; password: boolean;
}

interface Settings {
  sellerName: string; sellerPhone: string; sellerEmail: string; emailFrom: string; emailSubject: string;
  emailBody: string; waBody: string; dailyEmailMax: number; dailyWaMax: number;
  waFollowupDays: number; priceLine: string; retentionDays: number;
  stato?: Stato;
}

const SPIEGAZIONI: Array<{ chiave: keyof Stato; attivo: string; spento: string }> = [
  { chiave: "places", attivo: "Ricerca con Google Places", spento: "Nessuna chiave Places: si usa lo scraping di Maps, più lento" },
  { chiave: "email", attivo: "Invio email reale (Resend)", spento: "Nessuna chiave Resend: le email vengono solo scritte in console" },
  { chiave: "webhook", attivo: "Rimbalzi e segnalazioni spam registrati", spento: "Webhook Resend non configurato: non sapremo chi rimbalza o ci segnala" },
  { chiave: "ai", attivo: "Testi delle demo scritti dall'AI", spento: "Nessuna chiave Anthropic: testo predefinito per categoria" },
  { chiave: "cron", attivo: "Invii automatici abilitati", spento: "CRON_SECRET non impostato: i follow-up partono solo a mano" },
  { chiave: "password", attivo: "Accesso protetto da password", spento: "Nessuna password: chiunque raggiunga l'indirizzo entra" },
];

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setS);
  }, []);

  function up<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((p) => (p ? { ...p, [k]: v } : p));
    setSaved(false);
  }

  async function save() {
    if (!s) return;
    setBusy(true);
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    setBusy(false);
    setSaved(true);
  }

  if (!s) return <p><span className="spinner" /> Carico…</p>;

  return (
    <div>
      <h1>Impostazioni</h1>
      <p className="sub">Dati del venditore, messaggi e limiti di invio. I segnaposto disponibili: <code>{"{{nome}} {{citta}} {{demo}} {{prezzo}} {{venditore}}"}</code>.</p>

      {saved && <div className="notice ok">Salvato.</div>}

      {s.stato && (
        <div className="panel">
          <h2>Cosa è attivo</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: ".86rem", lineHeight: 1.9 }}>
            {SPIEGAZIONI.map((r) => {
              const on = s.stato![r.chiave];
              return (
                <li key={r.chiave}>
                  <span className={`tag ${on ? "good" : "gray"}`} style={{ marginRight: 8 }}>{on ? "sì" : "no"}</span>
                  {on ? r.attivo : r.spento}
                </li>
              );
            })}
          </ul>
          <p className="muted" style={{ fontSize: ".78rem", marginBottom: 0 }}>
            Si configurano nel file <code>.env</code>, non da qui: sono chiavi, non preferenze.
          </p>
        </div>
      )}

      <div className="panel">
        <h2>Tu (il venditore)</h2>
        <div className="row">
          <div><label>Nome</label><input value={s.sellerName} onChange={(e) => up("sellerName", e.target.value)} /></div>
          <div><label>Tuo numero WhatsApp (per la CTA nelle demo)</label><input value={s.sellerPhone} onChange={(e) => up("sellerPhone", e.target.value)} placeholder="es. 347 1234567" /></div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <div>
            <label>Email di contatto (mostrata nell&apos;informativa privacy)</label>
            <input value={s.sellerEmail} onChange={(e) => up("sellerEmail", e.target.value)} placeholder="a chi scrivere per cancellare i propri dati" />
          </div>
          <div>
            <label>Listino / prezzo mostrato</label>
            <input value={s.priceLine} onChange={(e) => up("priceLine", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Email</h2>
        <label>Mittente (From)</label>
        <input value={s.emailFrom} onChange={(e) => up("emailFrom", e.target.value)} placeholder="Nome Cognome <nome@tuodominio.it>" />
        <label style={{ marginTop: 14 }}>Oggetto</label>
        <input value={s.emailSubject} onChange={(e) => up("emailSubject", e.target.value)} />
        <label style={{ marginTop: 14 }}>Testo email</label>
        <textarea value={s.emailBody} onChange={(e) => up("emailBody", e.target.value)} style={{ minHeight: 180 }} />
        <p className="muted" style={{ fontSize: ".78rem", marginBottom: 0 }}>
          Il link di disiscrizione e quello all&apos;informativa vengono aggiunti in fondo da soli: non serve
          scriverli nel testo, e non vanno tolti.
        </p>
      </div>

      <div className="panel">
        <h2>WhatsApp</h2>
        <label>Testo messaggio</label>
        <textarea value={s.waBody} onChange={(e) => up("waBody", e.target.value)} style={{ minHeight: 140 }} />
      </div>

      <div className="panel">
        <h2>Limiti (anti-blocco)</h2>
        <div className="row">
          <div><label>Max email / giorno</label><input type="number" value={s.dailyEmailMax} onChange={(e) => up("dailyEmailMax", Number(e.target.value))} /></div>
          <div><label>Max WhatsApp / giorno</label><input type="number" value={s.dailyWaMax} onChange={(e) => up("dailyWaMax", Number(e.target.value))} /></div>
          <div><label>Follow-up WhatsApp dopo (giorni)</label><input type="number" value={s.waFollowupDays} onChange={(e) => up("waFollowupDays", Number(e.target.value))} /></div>
        </div>
      </div>

      <div className="panel">
        <h2>Conservazione dei dati</h2>
        <div className="row">
          <div style={{ maxWidth: 220 }}>
            <label>Cancella i contatti mai raggiunti dopo (giorni)</label>
            <input type="number" min={30} value={s.retentionDays} onChange={(e) => up("retentionDays", Number(e.target.value))} />
          </div>
        </div>
        <p className="muted" style={{ fontSize: ".8rem", marginBottom: 0 }}>
          Vale solo per chi non è mai stato contattato e non ha mai risposto. Chi è stato contattato, chi ha
          risposto e la lista di chi ha chiesto di non essere disturbato restano. La pulizia gira insieme agli
          invii automatici.
        </p>
      </div>

      <button className="btn" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : "💾"} Salva impostazioni</button>
    </div>
  );
}
