import { NextRequest } from "next/server";
import { addSuppression } from "@/lib/suppression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Link cliccabile nel footer di ogni email: un GET, senza login, perché il
// destinatario non ha e non deve avere un account per fermarsi. Registra il
// contatto una volta per sempre, su qualunque campagna futura.
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("e");

  if (email) {
    await addSuppression(email, "email", "richiesta");
  }

  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
     <body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;color:#1f2937;text-align:center;line-height:1.6">
     <h1 style="font-size:1.3rem">Fatto.</h1>
     <p>Non ricevera' piu' nessuna email da parte nostra. La richiesta resta valida per sempre.</p>
     </body>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
