"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "🔍 Cerca", exact: true },
  { href: "/leads", label: "📋 Lead" },
  { href: "/whatsapp", label: "💬 WhatsApp" },
  { href: "/settings", label: "⚙️ Impostazioni" },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();

  // La pagina di accesso e le pagine pubbliche non hanno bisogno del menu:
  // chi le vede o non è ancora entrato, o non è di casa.
  if (path === "/login") return null;

  async function esci() {
    await fetch("/api/login", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="brand">Lead<span className="dot">·</span>Machine</div>
      <div className="tagline">Trova → Demo → Contatta</div>
      <nav>
        {LINKS.map((l) => {
          const active = l.exact ? path === l.href : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={`navlink ${active ? "active" : ""}`}>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <Link href="/privacy" className="muted" style={{ fontSize: ".76rem", display: "block", marginBottom: 8 }}>
          Informativa privacy
        </Link>
        <button
          onClick={esci}
          className="muted"
          style={{ background: "none", border: "none", padding: 0, font: "inherit", fontSize: ".76rem", cursor: "pointer" }}
        >
          Esci
        </button>
      </div>
    </aside>
  );
}
