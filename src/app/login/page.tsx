"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const destinazione = sp.get("da") || "/";

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function entra(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "Non è andata.");
      return;
    }
    router.replace(destinazione);
    router.refresh();
  }

  return (
    <div className="overlay" style={{ zIndex: 50 }}>
      <form className="wizard" style={{ maxWidth: 380 }} onSubmit={entra}>
        <div className="wizard-head">
          <div>
            <h2 style={{ margin: 0 }}>Lead Machine</h2>
            <p className="muted">Questo strumento è protetto da password.</p>
          </div>
        </div>
        <label>Password</label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        {err && <div className="notice err" style={{ marginTop: 14, marginBottom: 0 }}>{err}</div>}
        <button className="btn" style={{ marginTop: 18, width: "100%" }} disabled={busy || !password} type="submit">
          {busy ? <span className="spinner" /> : "🔓"} Entra
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
