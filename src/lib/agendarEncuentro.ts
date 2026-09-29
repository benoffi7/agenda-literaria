/**
 * **«Agendar este encuentro» y «Compartir»** — roadmap 1.1.
 *
 * Quien llega a la página de una actividad desde Instagram quiere dos cosas que
 * la página no le daba: agendarse **un** encuentro sin suscribirse a la agenda
 * entera, y mandárselo a la amiga con la que va. Las dos son **links**, no
 * botones con JavaScript: la página de detalle no lleva scripts de más (D-140), y
 * un link anda en el navegador interno de Instagram, que es donde está la gente.
 *
 * ── Qué dice el evento, y qué no ───────────────────────────────────────────
 * **El mismo título que el calendario público** (`tituloDeEvento`, de
 * `@calendario`) y **el mismo lugar** (`construirUbicacion`, que solo mira la
 * sede proyectada). La descripción **no** es la del calendario: es solo el link
 * a la página. La del calendario se arma desde el documento crudo —saca los links
 * de reunión pegados en el texto comparando contra `online.url`, que acá no está
 * y no tiene que estar—, así que reusarla sobre la proyección pública sería
 * perder esa defensa (trampa 5). Y el link es mejor dato: el evento agendado
 * lleva a la página, que se actualiza sola cuando cambia la sede o el horario, y
 * un evento copiado al calendario de alguien no se actualiza nunca.
 *
 * **Sin el link de la reunión**, entonces, por construcción: nada de lo que entra
 * acá lo trae.
 *
 * ── Dos formas del mismo evento ────────────────────────────────────────────
 * El link de la **plantilla de Google Calendar** (abre el calendario con el evento
 * precargado; no se carga nada de Google hasta que alguien lo toca) y un **`.ics`**
 * de un solo evento, que es lo que abre el calendario del iPhone y Outlook. El
 * `.ics` lo genera el build (`src/pages/actividad/[slug]/[encuentro].ics.ts`), así
 * que lo barre el mismo chequeo que barre todo lo publicable.
 */

import { DOMINIO } from '@/lib/rutasPublicas';
import { diaSiguiente } from '@calendario';

/** Lo que hace falta para agendar un encuentro. Todo ya es público. */
export interface EventoParaAgendar {
  /** Estable y único: el UID del `.ics`, para que agendarlo dos veces no lo duplique. */
  uid: string;
  titulo: string;
  inicioIso: string;
  finIso: string;
  /**
   * B-2175 — `AAAA-MM-DD` cuando el horario es a confirmar: el evento se agenda
   * **de día completo** y `inicioIso`/`finIso` —el relleno de 00:00 a 23:59— no
   * se usan. Ausente, el evento tiene hora.
   */
  dia?: string;
  ubicacion: string;
  /** La página de la actividad, absoluta. Es la descripción entera. */
  url: string;
  /**
   * El `DTSTAMP`: cuándo se generó. Es el **reloj del build** (B-1850) y no un
   * `new Date()` en el endpoint, así que dos builds del mismo índice dan el mismo
   * archivo byte a byte (lo señaló el `auditor-trampas`).
   */
  generadoIso: string;
}

/** `20261012T220000Z` — la forma de fecha que piden la plantilla de Google y el `.ics`. */
export const fechaCompacta = (iso: string): string =>
  new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const descripcionDe = (e: EventoParaAgendar) => `Más información e inscripción: ${e.url}`;

/** `2026-10-03` → `20261003`: la forma `DATE` del `.ics` y de la plantilla de Google. */
const diaCompacto = (dia: string): string => dia.replace(/-/g, '');

/**
 * Las dos fechas del evento, ya en forma compacta. De día completo (B-2175) el fin
 * es **exclusivo** —el día siguiente—, que es lo que piden las dos formas.
 */
const fechasCompactas = (e: EventoParaAgendar): { desde: string; hasta: string } =>
  e.dia
    ? { desde: diaCompacto(e.dia), hasta: diaCompacto(diaSiguiente(e.dia)) }
    : { desde: fechaCompacta(e.inicioIso), hasta: fechaCompacta(e.finIso) };

/**
 * La plantilla de evento de Google Calendar. Las fechas van en UTC (`…Z`), que
 * no depende de ninguna zona: es el instante exacto (trampa 1).
 */
export const linkDeGoogleCalendar = (e: EventoParaAgendar): string => {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.titulo,
    dates: `${fechasCompactas(e).desde}/${fechasCompactas(e).hasta}`,
    details: descripcionDe(e),
    ...(e.ubicacion ? { location: e.ubicacion } : {}),
    ctz: 'America/Argentina/Buenos_Aires',
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
};

/** RFC 5545 §3.3.11: `\`, `;`, `,` y el salto de línea se escapan en un TEXT. */
const escaparTexto = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/**
 * RFC 5545 §3.1: una línea de más de 75 octetos se pliega con CRLF + espacio. Se
 * cuenta en **bytes** UTF-8 y no en caracteres: «Encuentro» con tildes ocupa más
 * de lo que se ve, y cortar un carácter de dos bytes al medio rompe el archivo.
 */
const plegar = (linea: string): string => {
  const bytes = new TextEncoder();
  const partes: string[] = [];
  let actual = '';
  for (const ch of linea) {
    const limite = partes.length === 0 ? 75 : 74; // la continuación lleva el espacio
    if (bytes.encode(actual + ch).length > limite) {
      partes.push(actual);
      actual = ch;
    } else {
      actual += ch;
    }
  }
  partes.push(actual);
  return partes.join('\r\n ');
};

/** El `.ics` de un solo evento. */
export const icsDeEvento = (e: EventoParaAgendar): string =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Agenda LEH//${DOMINIO}//ES`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${fechaCompacta(e.generadoIso)}`,
    // B-2175 — `VALUE=DATE` es el evento de día completo del RFC 5545 §3.3.4.
    e.dia ? `DTSTART;VALUE=DATE:${fechasCompactas(e).desde}` : `DTSTART:${fechasCompactas(e).desde}`,
    e.dia ? `DTEND;VALUE=DATE:${fechasCompactas(e).hasta}` : `DTEND:${fechasCompactas(e).hasta}`,
    `SUMMARY:${escaparTexto(e.titulo)}`,
    `DESCRIPTION:${escaparTexto(descripcionDe(e))}`,
    ...(e.ubicacion ? [`LOCATION:${escaparTexto(e.ubicacion)}`] : []),
    `URL:${e.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .map(plegar)
    .join('\r\n') + '\r\n';

/**
 * «Compartir por WhatsApp»: un `wa.me` sin número abre el selector de contactos
 * con el texto precargado. Es un link común —el navegador interno de Instagram no
 * ofrece «compartir» cómodo, y la Web Share API pediría un script—, y no carga
 * nada de WhatsApp hasta que alguien lo toca.
 */
export const linkParaCompartirPorWhatsApp = (titulo: string, url: string): string =>
  `https://wa.me/?text=${encodeURIComponent(`${titulo} ${url}`)}`;
