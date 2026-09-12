"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Lead {
  id: string;
  name: string;
  category: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  emailSource?: string | null;
  website?: string | null;
  websiteStatus: string;
  rating?: number | null;
  reviewCount: number;
  leadScore: number;
  outreachChannel: string;
  status: string;
  demoSlug?: string | null;
  emailOpenedAt?: string | null;
  repliedAt?: string | null;
}

interface OutreachRun {
  id: string;
  state: string;
  emailsSent: number;
  waSent: number;
  skipped: number;
  queued: number;
  planned: number;
  currentLead?: string | null;
  errors: string[];
}

const WS_TAG: Record<string, string> = { none: "none", bad: "bad", good: "good" };
const WS_LABEL: Record<string, string> = { none: "nessun sito", bad: "sito scadente", good: "ha sito ok" };
const ST_TAG: Record<string, string> = {
  scraped: "gray", demo_ready: "blue", approved: "blue",
  email_sent: "good", wa_sent: "good", da_richiamare: "bad", replied: "green", won: "green", lost: "none", skipped: "gray",
};
const ST_LABEL: Record<string, string> = {
  scraped: "da valutare", demo_ready: "demo pronta", approved: "approvato",
  email_sent: "email inviata", wa_sent: "whatsapp inviato", da_richiamare: "da richiamare", replied: "ha risposto",
  won: "cliente", lost: "perso", skipped: "scartato",
};

const PAGINA = 50;

function LeadsInner() {
  const sp = useSearchParams();
  const campaignId = sp.get("campaignId") || "";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [onlyLeads, setOnlyLeads] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<OutreachRun | null>(null);
  const cercaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (campaignId) params.set("campaignId", campaignId);
    if (onlyLeads) params.set("onlyLeads", "1");
    if (statusFilter) params.set("status", statusFilter);
    if (q) params.set("q", q);
    params.set("limit", String(PAGINA));
    params.set("offset", String(offset));
    const data = await fetch(`/api/leads?${params}`).then((r) => r.json());
    setLeads(Array.isArray(data.items) ? data.items : []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [campaignId, onlyLeads, statusFilter, q, offset]);

  useEffect(() => { load(); }, [load]);

  // Lo stato dell'invio vive sul server, non in questa pagina: se chiudi il
  // browser il giro continua, e riaprendo lo ritrovi dov'era.
  const leggiRun = useCallback(async () => {
    const d = await fetch("/api/outreach/run").then((r) => r.json());
    setRun(d.run || null);
    return d.run as OutreachRun | null;
  }, []);

  useEffect(() => {
    leggiRun();
  }, [leggiRun]);

  useEffect(() => {
    if (run?.state !== "running") return;
    const t = setInterval(async () => {
      const aggiornato = await leggiRun();
      if (aggiornato?.state !== "running") load();
    }, 3000);
    return () => clearInterval(t);
  }, [run?.state, leggiRun, load]);

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSel((s) => (s.size === leads.length ? new Set() : new Set(leads.map((l) => l.id))));
  }

  function cerca(valore: string) {
    if (cercaTimer.current) clearTimeout(cercaTimer.current);
    cercaTimer.current = setTimeout(() => {
      setOffset(0);
      setQ(valore.trim());
    }, 350);
  }

  async function bulk(action: string) {
    if (!sel.size) return;
    setBusy(true);
    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...sel], action }),
    });
    const d = await res.json().catch(() => ({}));
    if (d.esclusi) {
      setMsg({ kind: "", text: `${d.count} approvati. ${d.esclusi} esclusi: hanno chiesto di non essere contattati.` });
    }
    setSel(new Set());
    await load();
    setBusy(false);
  }

  async function genDemos() {
    if (!sel.size) return;
    setBusy(true);
    setMsg({ kind: "", text: `Genero ${sel.size} demo…` });
    let ok = 0;
    let falliti = 0;
    for (const id of sel) {
      const r = await fetch(`/api/leads/${id}/demo`, { method: "POST" });
      if (r.ok) ok++;
      else falliti++;
    }
    setMsg({
      kind: falliti ? "err" : "ok",
      text: `${ok} demo generate${falliti ? `, ${falliti} non riuscite` : ""}.`,
    });
    setSel(new Set());
    await load();
    setBusy(false);
  }

  async function lanciaInvio() {
    setBusy(true);
    const r = await fetch("/api/outreach/run", { method: "POST" });
    const d = await r.json();
    setRun(d.run || null);
    if (!r.ok) setMsg({ kind: "err", text: d.error || "Errore" });
    else if (!d.ok) setMsg({ kind: "", text: d.reason || "Invio già in corso." });
    else setMsg(null);
    setBusy(false);
  }

  async function fermaInvio() {
    const r = await fetch("/api/outreach/run", { method: "DELETE" });
    const d = await r.json();
    setRun(d.run || null);
    setMsg({ kind: "", text: "Mi fermo dopo il messaggio in corso." });
  }

  const inCorso = run?.state === "running";

  return (
    <div>
      <h1>Lead</h1>
      <p className="sub">
        Approva i lead buoni, genera le demo, poi lancia l&apos;invio. La lista è ordinata dal contatto
        più promettente in giù: chi non ha un sito e si può raggiungere viene per primo.
      </p>

      {msg && <div className={`notice ${msg.kind}`}>{msg.text}</div>}

      {run && (
        <div className={`notice ${run.state === "failed" ? "err" : run.state === "done" ? "ok" : ""}`}>
          {inCorso ? (
            <>
              <span className="spinner" style={{ marginRight: 8 }} />
              Invio in corso: {run.emailsSent + run.waSent} di {run.planned}
              {run.currentLead ? ` — sto scrivendo a ${run.currentLead}` : ""}.{" "}
              <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={fermaInvio}>Ferma</button>
              <div className="muted" style={{ fontSize: ".78rem", marginTop: 6 }}>
                Fra un messaggio WhatsApp e il successivo passano 30-90 secondi, per non far bloccare il numero.
                Puoi chiudere la pagina: il giro va avanti da solo.
              </div>
            </>
          ) : (
            <>
              Ultimo invio ({etichettaStato(run.state)}): {run.emailsSent} email, {run.waSent} WhatsApp,{" "}
              {run.skipped} saltati
              {run.queued > 0 && `, ${run.queued} rimasti in coda per domani (limite giornaliero)`}.
              {run.errors.length > 0 && (
                <div className="muted" style={{ fontSize: ".78rem", marginTop: 6 }}>
                  {run.errors.slice(0, 3).join(" · ")}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="toolbar">
        <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={onlyLeads} onChange={(e) => { setOffset(0); setOnlyLeads(e.target.checked); }} />
          Solo senza sito / sito scadente
        </label>
        <select style={{ width: 170 }} value={statusFilter} onChange={(e) => { setOffset(0); setStatusFilter(e.target.value); }}>
          <option value="">Tutti gli stati</option>
          <option value="scraped">Da valutare</option>
          <option value="demo_ready">Demo pronta</option>
          <option value="approved">Approvati</option>
          <option value="email_sent">Email inviata</option>
          <option value="wa_sent">WhatsApp inviato</option>
          <option value="da_richiamare">Da richiamare</option>
          <option value="replied">Hanno risposto</option>
          <option value="won">Clienti</option>
          <option value="skipped">Scartati</option>
        </select>
        <input
          style={{ width: 200 }}
          placeholder="Cerca nome, città, email…"
          defaultValue={q}
          onChange={(e) => cerca(e.target.value)}
        />
        <div className="grow" />
        <a className="btn ghost sm" href={`/api/leads/export${campaignId ? `?campaignId=${campaignId}` : ""}`}>⬇ CSV</a>
        <button className="btn green sm" disabled={busy || inCorso} onClick={lanciaInvio}>🚀 Lancia invio</button>
      </div>

      <div className="toolbar">
        <span className="muted">{sel.size} selezionati · {total} in lista</span>
        <button className="btn sm" disabled={!sel.size || busy} onClick={() => bulk("approve")}>✓ Approva</button>
        <button className="btn sm" disabled={!sel.size || busy} onClick={genDemos}>🎨 Genera demo</button>
        <button className="btn ghost sm" disabled={!sel.size || busy} onClick={() => bulk("skip")}>Scarta</button>
        <button className="btn ghost sm" disabled={!sel.size || busy} onClick={() => bulk("won")}>🎉 Cliente</button>
      </div>

      {loading ? (
        <p><span className="spinner" /> Carico…</p>
      ) : leads.length === 0 ? (
        <p className="muted">Nessun lead. Avvia una ricerca dalla home, o togli i filtri.</p>
      ) : (
        <>
          <div className="panel" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 30 }}><input type="checkbox" style={{ width: "auto" }} checked={sel.size === leads.length && leads.length > 0} onChange={toggleAll} /></th>
                  <th style={{ width: 54 }}>Punti</th>
                  <th>Attività</th>
                  <th>Contatti</th>
                  <th>Sito</th>
                  <th>Recensioni</th>
                  <th>Stato</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td><input type="checkbox" style={{ width: "auto" }} checked={sel.has(l.id)} onChange={() => toggle(l.id)} /></td>
                    <td>
                      <b style={{ color: colorePunteggio(l.leadScore) }}>{l.leadScore}</b>
                    </td>
                    <td>
                      <Link href={`/leads/${l.id}`}><b>{l.name}</b></Link>
                      <div className="muted" style={{ fontSize: ".78rem" }}>{l.city} · {l.category}</div>
                    </td>
                    <td style={{ fontSize: ".82rem" }}>
                      {l.phone ? <div>📞 {l.phone}</div> : <span className="muted">no tel</span>}
                      {l.email ? <div>✉ {l.email}</div> : <div className="muted">no email</div>}
                    </td>
                    <td><span className={`tag ${WS_TAG[l.websiteStatus] || "gray"}`}>{WS_LABEL[l.websiteStatus] || l.websiteStatus}</span></td>
                    <td>{l.rating ? `⭐ ${l.rating.toFixed(1)} (${l.reviewCount})` : <span className="muted">—</span>}</td>
                    <td>
                      <span className={`tag ${ST_TAG[l.status] || "gray"}`}>{ST_LABEL[l.status] || l.status}</span>
                      {l.emailOpenedAt && !l.repliedAt && (
                        <div className="muted" style={{ fontSize: ".72rem", marginTop: 3 }}>ha aperto l&apos;email</div>
                      )}
                    </td>
                    <td className="right">
                      {l.demoSlug && <a className="btn ghost sm" href={`/demo/${l.demoSlug}`} target="_blank" rel="noopener">Demo ↗</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > PAGINA && (
            <div className="toolbar">
              <button className="btn ghost sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGINA))}>← Precedenti</button>
              <span className="muted">{offset + 1}–{Math.min(offset + PAGINA, total)} di {total}</span>
              <button className="btn ghost sm" disabled={offset + PAGINA >= total} onClick={() => setOffset(offset + PAGINA)}>Successivi →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function colorePunteggio(score: number): string {
  if (score >= 70) return "var(--green)";
  if (score >= 45) return "var(--amber)";
  return "var(--muted)";
}

function etichettaStato(state: string): string {
  return state === "done" ? "completato" : state === "cancelled" ? "fermato" : state === "failed" ? "interrotto" : state;
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<p><span className="spinner" /> Carico…</p>}>
      <LeadsInner />
    </Suspense>
  );
}
