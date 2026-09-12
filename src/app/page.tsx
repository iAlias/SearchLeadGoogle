"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  businessType: string;
  location: string;
  engine: string;
  status: string;
  error?: string | null;
  foundCount: number;
  processedCount: number;
  createdAt: string;
  _count?: { leads: number };
}

interface Stats {
  campaigns: number; total: number; withEmail: number; withPhone: number;
  emailSent: number; opened: number; replied: number; won: number; suppressed: number;
}

const STATUS_TAG: Record<string, string> = {
  pending: "gray", running: "blue", done: "good", failed: "none", cancelled: "gray",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "in attesa", running: "in corso", done: "completata", failed: "interrotta", cancelled: "annullata",
};

export default function Home() {
  const [businessType, setBusinessType] = useState("");
  const [location, setLocation] = useState("");
  const [engine, setEngine] = useState("auto");
  const [targetCount, setTargetCount] = useState(60);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      fetch("/api/campaigns").then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()),
    ]);
    setCampaigns(Array.isArray(c) ? c : []);
    setStats(s);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // polling per stato scraping
    return () => clearInterval(t);
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!businessType.trim() || !location.trim()) {
      setErr("Inserisci tipo di attività e luogo.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType, location, engine, targetCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore");
      setBusinessType("");
      setLocation("");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function azione(id: string, action: "cancel" | "rerun") {
    await fetch(`/api/campaigns/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await load();
  }

  function avanzamento(c: Campaign): string {
    if (c.status !== "running") return "";
    if (!c.foundCount) return "cerco le attività…";
    return `${c.processedCount}/${c.foundCount} controllate`;
  }

  return (
    <div>
      <h1>Cerca attività</h1>
      <p className="sub">
        Inserisci il tipo di attività e il luogo. Il sistema cerca su Google, trova telefono ed
        email, e prepara una demo personalizzata per ciascuna.
      </p>

      <form className="panel" onSubmit={submit}>
        <div className="row">
          <div style={{ flex: 2 }}>
            <label>Tipo di attività</label>
            <input
              placeholder="es. ristorante, parrucchiere, officina…"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
            />
          </div>
          <div style={{ flex: 2 }}>
            <label>Città / regione / nazione</label>
            <input
              placeholder="es. Catania, Sicilia, Italia"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <div>
            <label>Motore</label>
            <select value={engine} onChange={(e) => setEngine(e.target.value)}>
              <option value="auto">Auto (Places se configurato, altrimenti scraping)</option>
              <option value="places">Solo Google Places API</option>
              <option value="scrape">Solo scraping Maps (Puppeteer)</option>
            </select>
          </div>
          <div>
            <label>Numero max risultati</label>
            <input
              type="number" min={10} max={120} value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn" disabled={creating} type="submit">
              {creating ? <span className="spinner" /> : "🔍"} Avvia ricerca
            </button>
          </div>
        </div>
        {err && <div className="notice err" style={{ marginTop: 14, marginBottom: 0 }}>{err}</div>}
      </form>

      {stats && (
        <div className="cards" style={{ marginBottom: 26 }}>
          <div className="stat"><div className="n">{stats.total}</div><div className="l">Lead totali</div></div>
          <div className="stat"><div className="n">{stats.withEmail}</div><div className="l">Con email</div></div>
          <div className="stat"><div className="n">{stats.emailSent}</div><div className="l">Contattati</div></div>
          <div className="stat"><div className="n">{stats.opened}</div><div className="l">Hanno aperto</div></div>
          <div className="stat"><div className="n">{stats.replied}</div><div className="l">Hanno risposto</div></div>
          <div className="stat"><div className="n">{stats.won}</div><div className="l">Clienti 🎉</div></div>
        </div>
      )}

      <h2>Ricerche</h2>
      {campaigns.length === 0 ? (
        <p className="muted">Nessuna ricerca ancora. Avviane una qui sopra.</p>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Ricerca</th><th>Stato</th><th>Lead</th><th>Motore</th><th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/leads?campaignId=${c.id}`}><b>{c.businessType}</b> · {c.location}</Link>
                    {c.error && <div style={{ fontSize: ".78rem", color: "var(--red)" }}>{c.error}</div>}
                  </td>
                  <td>
                    <span className={`tag ${STATUS_TAG[c.status] || "gray"}`}>
                      {c.status === "running" && <span className="spinner" style={{ marginRight: 5 }} />}
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                    {c.status === "running" && (
                      <div className="muted" style={{ fontSize: ".76rem", marginTop: 4 }}>{avanzamento(c)}</div>
                    )}
                  </td>
                  <td>{c._count?.leads ?? 0}</td>
                  <td className="muted">{c.engine}</td>
                  <td className="right">
                    {c.status === "running" ? (
                      <button className="btn ghost sm" onClick={() => azione(c.id, "cancel")}>Ferma</button>
                    ) : (
                      <button className="btn ghost sm" onClick={() => azione(c.id, "rerun")} title="Ricontrolla siti, email e punteggi">
                        ↻ Aggiorna
                      </button>
                    )}{" "}
                    <Link className="btn ghost sm" href={`/leads?campaignId=${c.id}`}>Apri →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
