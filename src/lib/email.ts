// Invio email via Resend (HTTP, nessun SDK). Senza chiave: log in console (dry-run).

interface SendResult {
  ok: boolean;
  id?: string;
  dryRun?: boolean;
  error?: string;
}

export function hasEmailKey(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(opts: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log("[email dry-run] →", opts.to, "|", opts.subject);
    return { ok: true, dryRun: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: opts.from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        reply_to: opts.replyTo,
      }),
    });
    const data = (await res.json()) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: data.message || `HTTP ${res.status}` };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Costruisce un'email HTML semplice e pulita da testo + link demo.
// unsubscribeUrl è un link vero, non solo "risponda con STOP": una richiesta
// di fermarsi non deve dipendere da qualcuno che legga a mano ogni risposta.
export function buildEmailHtml(bodyText: string, demoUrl: string, unsubscribeUrl?: string): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapeForEmail(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:560px;margin:0 auto;padding:8px">
  ${paragraphs}
  <p style="margin:22px 0">
    <a href="${demoUrl}" style="display:inline-block;background:#1f3a4d;color:#fff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:600">👉 Guarda la demo del sito</a>
  </p>
  <p style="font-size:12px;color:#9ca3af;margin-top:28px">Non vuole più ricevere queste email?
  ${unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color:#9ca3af">Clicchi qui</a>` : `Risponda con "STOP"`}.</p>
  </body></html>`;
}

function escapeForEmail(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
