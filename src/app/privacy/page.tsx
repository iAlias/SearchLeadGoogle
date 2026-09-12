import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Informativa privacy — Lead Machine",
};

// Chi riceve la nostra email non ci ha dato i suoi dati: li abbiamo presi da
// Google e dal suo sito. L'art. 14 del GDPR dice che in quel caso
// l'informativa va data al primo contatto, e deve dire da dove arrivano i
// dati e come opporsi. È il pezzo che rende difendibile tutto il resto,
// quindi il link è nel piede di ogni email e nella pagina di disiscrizione.

export default async function PrivacyPage() {
  const s = await getSettings();
  const titolare = s.sellerName || "(da compilare in Impostazioni)";
  const contatto = s.sellerEmail || s.emailFrom || "(da compilare in Impostazioni)";
  const giorni = s.retentionDays || 180;

  return (
    <div style={{ maxWidth: 720 }}>
      <h1>Informativa sul trattamento dei dati</h1>
      <p className="sub">Ultimo aggiornamento: alla data di consultazione di questa pagina.</p>

      <div className="panel">
        <h2>Chi tratta i dati</h2>
        <p>
          Titolare del trattamento: <b>{titolare}</b>. Per qualunque richiesta, compresa la cancellazione
          immediata: <b>{contatto}</b>
          {s.sellerPhone ? <> — {s.sellerPhone}</> : null}.
        </p>
      </div>

      <div className="panel">
        <h2>Quali dati e da dove arrivano</h2>
        <p>
          Trattiamo esclusivamente dati di contatto <b>di attività economiche</b>, già pubblici: denominazione,
          indirizzo, numero di telefono, indirizzo email pubblicato, sito web, valutazioni e recensioni visibili
          pubblicamente, orari di apertura e fotografie della scheda.
        </p>
        <p className="muted">
          Fonti: le schede pubbliche di Google Maps (Google Places API) e le pagine pubbliche del sito web
          dell&apos;attività stessa. Non acquistiamo liste, non usiamo dati provenienti da terzi e non trattiamo
          categorie particolari di dati.
        </p>
      </div>

      <div className="panel">
        <h2>Perché</h2>
        <p>
          Per proporre alla sua attività la realizzazione di un sito web, mostrandole una versione dimostrativa
          costruita con i suoi dati pubblici. È una comunicazione commerciale fra operatori economici.
        </p>
        <p className="muted">
          Base giuridica: legittimo interesse del titolare a proporre i propri servizi ad attività
          potenzialmente interessate (art. 6, par. 1, lett. f del Regolamento UE 2016/679). L&apos;interesse è
          stato bilanciato limitando i dati ai soli recapiti professionali pubblici, contattando una sola volta
          per canale e interrompendo ogni contatto alla prima richiesta.
        </p>
      </div>

      <div className="panel">
        <h2>A chi vengono comunicati</h2>
        <p>
          A nessun altro destinatario per finalità proprie. I dati sono elaborati su strumenti che agiscono come
          responsabili del trattamento: il servizio di invio email (Resend), l&apos;infrastruttura su cui gira
          questo programma e, se attivo, il servizio che genera i testi della pagina dimostrativa (Anthropic).
          Non vendiamo né cediamo dati a terzi.
        </p>
      </div>

      <div className="panel">
        <h2>Per quanto tempo</h2>
        <p>
          I contatti mai raggiunti da alcun messaggio vengono cancellati automaticamente dopo <b>{giorni} giorni</b>.
          I contatti che hanno ricevuto un messaggio o hanno risposto sono conservati finché serve a gestire il
          rapporto e a dimostrare la correttezza di quanto fatto.
        </p>
        <p className="muted">
          Unica eccezione: se ci chiede di non essere più contattato, conserviamo per sempre il suo recapito in
          un elenco di esclusione. È l&apos;unico modo per garantirle che non le scriveremo di nuovo per errore
          in futuro.
        </p>
      </div>

      <div className="panel">
        <h2>I suoi diritti</h2>
        <p>
          Può in ogni momento chiedere l&apos;accesso ai dati che la riguardano, la loro rettifica o
          cancellazione, la limitazione del trattamento e <b>opporsi</b> al trattamento per finalità commerciali
          (artt. 15-22 GDPR). L&apos;opposizione non richiede motivazione e viene eseguita subito.
        </p>
        <p>
          Il modo più rapido è il link <b>&laquo;Non vuole più ricevere queste email&raquo;</b> in fondo al
          messaggio che ha ricevuto, oppure una risposta con scritto <b>&laquo;no grazie&raquo;</b>: in entrambi i
          casi il suo recapito viene spento automaticamente su tutti i canali, email e WhatsApp insieme.
        </p>
        <p className="muted">
          Se ritiene che il trattamento violi la normativa, può proporre reclamo al Garante per la protezione dei
          dati personali (www.garanteprivacy.it).
        </p>
      </div>
    </div>
  );
}
