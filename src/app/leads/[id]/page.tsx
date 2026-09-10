"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DemoWizard from "./DemoWizard";

interface Lead {
  id: string; name: string; category: string; city?: string | null; address?: string | null;
  phone?: string | null; email?: string | null; emailSource?: string | null;
  website?: string | null; websiteStatus: string; rating?: number | null; reviewCount: number;
  outreachChannel: string; status: string; demoSlug?: string | null; demoOptions?: string | null; notes?: string | null;
  outcome?: string | null;
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [previewBust, setPreviewBust] = useState(0);

  const load = useCallback(async () => {
    const data = await fetch(`/api/leads/${id}`).then((r) => r.json());
    setLead(data);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const savedDemoOptions = useMemo(() => {
    if (!lead?.demoOptions) return null;
    try { return JSON.parse(lead.demoOptions); } catch { return null; }
  }, [lead?.demoOptions]);

  async function save(patch: Partial<Lead>) {
    setBusy(true);
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
    setBusy(false);
  }

  async function del() {
    if (!confirm("Eliminare questo lead?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    router.push("/leads");
  }

  async function onWizardGenerated() {
    setWizardOpen(false);
    setMsg("Demo generata.");
    setPreviewBust((n) => n + 1); // forza l'anteprima a ricaricarsi, anche con lo stesso slug
    await load();
  }

  if (!lead) return <p><span className="spinner" /> Carico…</p>;

  return (
    <div>
      <a className="muted" href="#" onClick={(e) => { e.preventDefault(); router.back(); }}>← indietro</a>
      <h1 style={{ marginTop: 10 }}>{lead.name}</h1>
      <p className="sub">{lead.city} · {lead.category} · {lead.rating ? `⭐ ${lead.rating.toFixed(1)} (${lead.reviewCount})` : "nessuna recensione"}</p>

      {msg && <div className="notice ok">{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 22, alignItems: "start" }}>
        <div>
          <div className="panel">
            <h2>Contatti</h2>
            <label>Email</label>
            <input defaultValue={lead.email || ""} onBlur={(e) => e.target.value !== (lead.email || "") && save({ email: e.target.value })} />
            <div className="muted" style={{ fontSize: ".74rem", margin: "4px 0 12px" }}>fonte: {lead.emailSource || "—"}</div>
            <label>Telefono</label>
            <input defaultValue={lead.phone || ""} onBlur={(e) => e.target.value !== (lead.phone || "") && save({ phone: e.target.value })} />
            <label style={{ marginTop: 12 }}>Indirizzo</label>
            <input defaultValue={lead.address || ""} onBlur={(e) => e.target.value !== (lead.address || "") && save({ address: e.target.value })} />
            {lead.website && <p style={{ marginTop: 12, fontSize: ".85rem" }}>Sito attuale: <a href={lead.website} target="_blank" rel="noopener">{lead.website}</a></p>}
          </div>

          <div className="panel">
            <h2>Azioni</h2>
            <div className="grid">
              <button className="btn" disabled={busy} onClick={() => setWizardOpen(true)}>🎨 {lead.demoSlug ? "Rigenera" : "Genera"} demo…</button>
              {lead.demoSlug && <a className="btn ghost" href={`/demo/${lead.demoSlug}`} target="_blank" rel="noopener">↗ Apri demo</a>}
              {lead.status !== "approved" && <button className="btn green" disabled={busy} onClick={() => save({ status: "approved" })}>✓ Approva per invio</button>}
              <button className="btn ghost" disabled={busy} onClick={() => save({ status: "won", outcome: "won" })}>🎉 Segna come cliente</button>
              <button className="btn ghost" disabled={busy} onClick={() => save({ status: "skipped" })}>Scarta</button>
              <button className="btn red" onClick={del}>🗑 Elimina</button>
            </div>
          </div>

          <div className="panel">
            <h2>Note</h2>
            <textarea defaultValue={lead.notes || ""} onBlur={(e) => e.target.value !== (lead.notes || "") && save({ notes: e.target.value })} placeholder="Appunti su questo contatto…" />
          </div>
        </div>

        <div className="panel" style={{ padding: 0, overflow: "hidden", position: "sticky", top: 20 }}>
          {lead.demoSlug ? (
            <iframe
              key={previewBust}
              src={`/demo/${lead.demoSlug}?_=${previewBust}`}
              style={{ width: "100%", height: "78vh", border: "none", background: "#fff" }}
              title="Anteprima demo"
            />
          ) : (
            <div style={{ padding: 60, textAlign: "center" }} className="muted">
              Nessuna demo ancora. Premi &quot;Genera demo…&quot; per scegliere stile e sezioni e crearla con i dati di questa attività.
            </div>
          )}
        </div>
      </div>

      {wizardOpen && (
        <DemoWizard
          leadId={lead.id}
          leadName={lead.name}
          category={lead.category}
          saved={savedDemoOptions}
          onClose={() => setWizardOpen(false)}
          onGenerated={onWizardGenerated}
        />
      )}
    </div>
  );
}
