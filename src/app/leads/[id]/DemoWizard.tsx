"use client";

import { useMemo, useState } from "react";
import {
  DEMO_STYLES,
  DEMO_SECTIONS,
  CATEGORY_PRIMARY,
  CATEGORY_THEME,
  shortenSiteTitle,
  type DemoStyleKey,
} from "@/lib/demoOptions";
import type { Category } from "@/lib/types";

interface Props {
  leadId: string;
  leadName: string;
  category: string;
  // Scelte già salvate da una generazione precedente (se questa è una rigenerazione).
  saved?: {
    style?: DemoStyleKey;
    sections?: string[];
    siteTitle?: string;
    menuMode?: "completo" | "solo-contatti";
    primaryColor?: string;
  } | null;
  onClose: () => void;
  onGenerated: () => void;
}

export default function DemoWizard({ leadId, leadName, category, saved, onClose, onGenerated }: Props) {
  const catKey = (category in CATEGORY_PRIMARY ? category : "generico") as Category;
  const defaultColor = CATEGORY_PRIMARY[catKey];

  // Il tema consigliato per la categoria, se non ce n'è uno salvato valido
  // (una scelta fatta con un tema che non esiste più ricade qui).
  const savedStyleValid = saved?.style && DEMO_STYLES.some((s) => s.key === saved.style) ? saved.style : undefined;
  const [style, setStyle] = useState<DemoStyleKey>(savedStyleValid || CATEGORY_THEME[catKey]);
  const [siteTitle, setSiteTitle] = useState(saved?.siteTitle || leadName);
  const [menuMode, setMenuMode] = useState<"completo" | "solo-contatti">(saved?.menuMode || "completo");
  const [primaryColor, setPrimaryColor] = useState(saved?.primaryColor || defaultColor);
  const [sections, setSections] = useState<Record<string, boolean>>(() => {
    const iniziali: Record<string, boolean> = {};
    const scelte = saved?.sections;
    for (const s of DEMO_SECTIONS) {
      iniziali[s.key] = scelte ? scelte.includes(s.key) : s.defaultOn;
    }
    return iniziali;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const suggerimentoTitolo = useMemo(() => {
    const corto = shortenSiteTitle(leadName, 42);
    return corto !== leadName.trim() ? corto : null;
  }, [leadName]);

  function toggleSection(key: string) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  async function genera() {
    setBusy(true);
    setError("");
    try {
      const body = {
        style,
        sections: Object.keys(sections).filter((k) => sections[k]),
        siteTitle: siteTitle.trim(),
        menuMode,
        primaryColor,
      };
      const r = await fetch(`/api/leads/${leadId}/demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Errore nella generazione");
      onGenerated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wizard">
        <div className="wizard-head">
          <div>
            <h2 style={{ marginBottom: 0 }}>Come deve essere questa demo?</h2>
            <p className="muted">Ogni scelta qui sotto è facoltativa: puoi rigenerare in qualunque momento.</p>
          </div>
          <button className="close-x" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        {error && <div className="notice err">{error}</div>}

        <label>Nome del sito</label>
        <input
          value={siteTitle}
          maxLength={80}
          onChange={(e) => setSiteTitle(e.target.value)}
          placeholder={leadName}
        />
        {suggerimentoTitolo && siteTitle === leadName && (
          <p className="field-hint">
            È lungo per un logo. <button type="button" onClick={() => setSiteTitle(suggerimentoTitolo)}>Usa &quot;{suggerimentoTitolo}&quot;</button>
          </p>
        )}

        <label style={{ marginTop: 16 }}>Stile grafico</label>
        <div className="style-cards">
          {DEMO_STYLES.map((s) => (
            <button
              type="button"
              key={s.key}
              className={`style-card${style === s.key ? " active" : ""}`}
              onClick={() => setStyle(s.key)}
            >
              <b>{s.label}</b>
              <span>{s.description}</span>
            </button>
          ))}
        </div>

        <label style={{ marginTop: 18 }}>Menu</label>
        <div className="menu-choice">
          <label className={`radio-card${menuMode === "completo" ? " active" : ""}`}>
            <input type="radio" name="menuMode" checked={menuMode === "completo"} onChange={() => setMenuMode("completo")} />
            <span>
              <span className="section-check t" style={{ display: "block" }}>Menu completo</span>
              <span className="section-check d" style={{ display: "block" }}>Le voci di navigazione più il pulsante Contattaci</span>
            </span>
          </label>
          <label className={`radio-card${menuMode === "solo-contatti" ? " active" : ""}`}>
            <input type="radio" name="menuMode" checked={menuMode === "solo-contatti"} onChange={() => setMenuMode("solo-contatti")} />
            <span>
              <span className="section-check t" style={{ display: "block" }}>Solo Contattaci</span>
              <span className="section-check d" style={{ display: "block" }}>Niente voci di menu, solo il pulsante</span>
            </span>
          </label>
        </div>

        <label style={{ marginTop: 18 }}>Colore primario</label>
        <div className="color-row">
          <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
          <code>{primaryColor}</code>
          {primaryColor.toLowerCase() !== defaultColor.toLowerCase() && (
            <button type="button" className="btn ghost sm" onClick={() => setPrimaryColor(defaultColor)}>Ripristina il colore della categoria</button>
          )}
        </div>

        <label style={{ marginTop: 18 }}>Sezioni della pagina</label>
        <div className="section-grid">
          {DEMO_SECTIONS.map((s) => (
            <label key={s.key} className="section-check">
              <input type="checkbox" checked={!!sections[s.key]} onChange={() => toggleSection(s.key)} />
              <span>
                <span className="t" style={{ display: "block" }}>{s.label}</span>
                <span className="d" style={{ display: "block" }}>{s.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="wizard-foot">
          <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
          <button className="btn" onClick={genera} disabled={busy}>
            {busy ? <span className="spinner" /> : "🎨"} Genera demo
          </button>
        </div>
      </div>
    </div>
  );
}
