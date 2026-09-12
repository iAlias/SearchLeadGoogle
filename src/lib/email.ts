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
  headers?: Record<string, string>;
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
        headers: opts.headers,
      }),
    });
    const data = (await res.json()) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: data.message || `HTTP ${res.status}` };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Le intestazioni che permettono a Gmail e Outlook di mostrare il loro
 * "Annulla iscrizione" accanto al mittente. Non è un dettaglio estetico:
 * dal 2024 i grandi provider pretendono la disiscrizione con un clic per la
 * posta commerciale, e chi non ce l'ha finisce classificato come spam a
 * prescindere dal contenuto. RFC 8058: il link deve rispondere a una POST.
 */
export function unsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// Costruisce un'email HTML semplice e pulita da testo + link demo.
// Il link di disiscrizione è un link vero, non un "risponda con STOP": una
// richiesta di fermarsi non deve dipendere da qualcuno che legga a mano ogni
// risposta. Accanto c'è l'informativa: i dati non ce li ha dati il
// destinatario, quindi va detto da dove arrivano (art. 14 GDPR).
export function buildEmailHtml(
  bodyText: string,
  demoUrl: string,
  links: { unsubscribeUrl?: string; privacyUrl?: string } = {}
): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapeForEmail(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const piede: string[] = [];
  if (links.unsubscribeUrl) {
    piede.push(
      `Non vuole più ricevere queste email? <a href="${links.unsubscribeUrl}" style="color:#9ca3af">Clicchi qui</a>.`
    );
  } else {
    piede.push(`Non vuole più ricevere queste email? Risponda con "STOP".`);
  }
  if (links.privacyUrl) {
    piede.push(`<a href="${links.privacyUrl}" style="color:#9ca3af">Come trattiamo i suoi dati</a>.`);
  }

  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:560px;margin:0 auto;padding:8px">
  ${paragraphs}
  <p style="margin:22px 0">
    <a href="${demoUrl}" style="display:inline-block;background:#1f3a4d;color:#fff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:600">👉 Guarda la demo del sito</a>
  </p>
  <p style="font-size:12px;color:#9ca3af;margin-top:28px">${piede.join(" ")}</p>
  </body></html>`;
}

export function buildEmailText(
  bodyText: string,
  demoUrl: string,
  links: { unsubscribeUrl?: string; privacyUrl?: string } = {}
): string {
  const righe = [bodyText, "", demoUrl];
  if (links.unsubscribeUrl) righe.push("", "Per non ricevere più email: " + links.unsubscribeUrl);
  if (links.privacyUrl) righe.push("Come trattiamo i suoi dati: " + links.privacyUrl);
  return righe.join("\n");
}

function escapeForEmail(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
