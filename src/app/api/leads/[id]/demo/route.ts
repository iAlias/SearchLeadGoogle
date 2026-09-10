import { NextRequest, NextResponse } from "next/server";
import { generateDemoForLead, type WizardDemoOptions } from "@/lib/outreach";
import { DEMO_STYLES, DEMO_SECTIONS } from "@/lib/demoOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STYLES = new Set<string>(DEMO_STYLES.map((s) => s.key));
const VALID_SECTIONS = new Set<string>(DEMO_SECTIONS.map((s) => s.key));

// Legge dal corpo della richiesta solo le scelte del wizard che sono valide,
// scartando il resto in silenzio: un valore sbagliato ricade sul
// comportamento di sempre invece di rompere la generazione.
function parseWizardOptions(body: unknown): WizardDemoOptions | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  const opts: WizardDemoOptions = {};

  if (typeof b.style === "string" && VALID_STYLES.has(b.style)) {
    opts.style = b.style as WizardDemoOptions["style"];
  }
  if (Array.isArray(b.sections)) {
    opts.sections = b.sections.filter((s): s is string => typeof s === "string" && VALID_SECTIONS.has(s));
  }
  if (typeof b.siteTitle === "string") {
    opts.siteTitle = b.siteTitle.trim().slice(0, 80);
  }
  if (b.menuMode === "completo" || b.menuMode === "solo-contatti") {
    opts.menuMode = b.menuMode;
  }
  if (typeof b.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(b.primaryColor)) {
    opts.primaryColor = b.primaryColor;
  }

  return opts;
}

// Genera (o rigenera) la demo del lead. Un corpo JSON con le scelte del
// wizard è opzionale: senza, si comporta come prima che il wizard esistesse.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json().catch(() => undefined);
    const options = parseWizardOptions(body);
    const { slug } = await generateDemoForLead(id, options);
    return NextResponse.json({ ok: true, slug, url: `/demo/${slug}` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
