/**
 * Lógica pura de los reportes del panel → issues de GitHub.
 *
 * Sin dependencias de Firebase, de red ni del token: así lo delicado —qué
 * texto sale a un repo PÚBLICO y cuándo se reintenta— se testea sin
 * emuladores y sin crear un issue de verdad. La infraestructura (trigger,
 * secreto, llamada HTTP) vive en `reportes-trigger.js`.
 *
 * El §5.4 es taxativo: el PAT de GitHub no va al repo ni al bundle. Por eso el
 * panel no llama a la API de GitHub: escribe en `/reportes/{id}` y esta lógica
 * corre en una Cloud Function con el token en Secret Manager.
 */

/** Misma zona que el resto del proyecto (§14). Se define acá para que este
 *  módulo no dependa de `calendario.js`. */
export const TIMEZONE = 'America/Argentina/Buenos_Aires';

/** Intentos totales de creación del issue antes de dar el reporte por fallido. */
export const MAX_INTENTOS = 3;

/**
 * `github` es el repo del proyecto y **es público** (verificado con
 * `gh repo view benoffi7/agenda-literaria --json visibility` → PUBLIC).
 * Todo lo que arme este módulo se lee desde internet, así que:
 *
 *  - el reporte NO identifica a quien lo cargó (uid ni mail): eso queda en
 *    Firestore, que solo leen los admins;
 *  - el texto libre pasa por `redactar()`, que tapa mails y links de reunión
 *    (trampa 5) por si alguien pega uno para explicar el problema;
 *  - de la actividad referida solo salen título y slug **si está publicada**;
 *    el título de un borrador todavía no es público.
 */

/** "nueva-actividad" → "Nueva actividad". El slug crudo se ve roto en el issue. */
const desSlug = (slug) =>
  String(slug ?? '')
    .split('-')
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(' ');

const fecha = (t) => {
  const d = typeof t?.toDate === 'function' ? t.toDate() : t ? new Date(t) : new Date();
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
};

// Los links de reunión se tapan ANTES que los mails: si no, un mail dentro de
// una URL se reemplaza primero y el resto del link queda visible.
const LINK_REUNION =
  /https?:\/\/\S*?(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|meet\.jit\.si|whereby\.com|wa\.me|api\.whatsapp\.com)\S*/gi;
const MAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

/**
 * Tapa en el texto libre lo que no debe salir a un repo público: mails
 * (los de inscripción, sobre todo) y links de reunión (§5.1, trampa 5).
 * El texto completo queda en Firestore; esto solo recorta lo que se publica.
 */
export const redactar = (texto) =>
  String(texto ?? '')
    .replace(LINK_REUNION, '«link de reunión oculto»')
    .replace(MAIL, '«mail oculto»')
    .trim();

/**
 * ¿Qué hacer con el documento que disparó el trigger?
 *
 * El trigger es `onDocumentWritten`, así que también se dispara con la
 * escritura de vuelta del número de issue: la guarda es el estado, igual que
 * la del sync (§7.1, trampa 3). Y como la entrega de eventos de Firestore es
 * *al menos una vez*, sin este chequeo un evento repetido crearía un issue
 * duplicado.
 */
export const decidirAccion = (reporte) => {
  if (!reporte) return { accion: 'ignorar', motivo: 'el reporte ya no existe' };
  if (reporte.github?.numero) {
    return { accion: 'ignorar', motivo: `ya tiene el issue #${reporte.github.numero}` };
  }
  if (reporte.estado !== 'pendiente') {
    return { accion: 'ignorar', motivo: `estado "${reporte.estado}"` };
  }
  const intentos = reporte.intentos ?? 0;
  if (intentos >= MAX_INTENTOS) {
    return { accion: 'ignorar', motivo: `se agotaron los ${MAX_INTENTOS} intentos` };
  }
  return { accion: 'enviar', intento: intentos + 1 };
};

/**
 * ¿Vale la pena reintentar este fallo de la API de GitHub?
 *
 * 401/403/404 son configuración (token vencido, sin permiso, repo mal
 * escrito): reintentar no cambia nada y solo quema invocaciones. 5xx, 429 y la
 * ausencia de status (error de red) sí son transitorios.
 */
export const esReintentable = (status) => {
  if (status == null) return true;
  if (status === 429) return true;
  return status >= 500;
};

/** Estado siguiente del reporte después de un fallo. */
export const estadoTrasFallo = (intento, status) =>
  esReintentable(status) && intento < MAX_INTENTOS ? 'pendiente' : 'error';

const bloque = (titulo, cuerpo) => (cuerpo ? `### ${titulo}\n\n${cuerpo}\n` : '');

/**
 * Arma el issue. `actividad` ya viene filtrada por el llamador: es
 * `{ titulo, slug }` solo si la actividad está publicada, y `null` si no.
 *
 * @param {{ id: string, reporte: Record<string, any>,
 *           actividad?: { titulo: string, slug: string } | null }} args
 */
export const construirIssue = ({ id, reporte, actividad = null }) => {
  const tipo = reporte.tipo === 'sugerencia' ? 'sugerencia' : 'bug';
  // `redactar` también acá: el título va al `title` del issue, que es lo primero
  // que se ve desde internet. El formulario del panel promete que "si se cuela
  // un mail o un link de reunión, el panel lo tapa antes de publicar" — sin esta
  // llamada la promesa valía para la descripción y los pasos, pero no para el
  // renglón más visible de los tres (§5.1, trampa 5).
  const titulo = redactar(reporte.titulo) || '(sin título)';
  const c = reporte.contexto ?? {};

  const contexto = [
    ['Pantalla', desSlug(c.pantalla) || '—'],
    ['Ruta', c.url || '—'],
    ['Versión del panel', c.versionPanel || 'desconocida'],
    ['Navegador', c.navegador || '—'],
    ['Ventana', c.ventana || '—'],
    // La zona horaria importa: la trampa 1 del §13 son los eventos corridos
    // tres horas, y un reporte de fechas sin saber la zona del que reporta no
    // se puede diagnosticar.
    ['Zona horaria', c.zonaHoraria || '—'],
  ]
    .map(([k, v]) => `| ${k} | ${redactar(v)} |`)
    .join('\n');

  const referencia = reporte.actividad?.id
    ? actividad
      ? `\`${reporte.actividad.id}\` — **${redactar(actividad.titulo)}** (\`/${actividad.slug}\`)`
      : `\`${reporte.actividad.id}\` — sin publicar todavía, así que el título no ` +
        'se copia acá: se ve en el panel.'
    : '';

  const encabezado =
    // Sin punto final: el formato de hora en castellano ya termina en "p. m."
    // y quedaba "7:00 p. m..".
    `> Cargado desde el panel de carga el ${fecha(reporte.creadoEn)}\n` +
    `> Trazabilidad completa (quién lo cargó y el detalle sin recortar) en ` +
    `Firestore: \`reportes/${id}\`.\n\n` +
    `**Tipo:** ${tipo}` +
    (tipo === 'bug' && reporte.severidad ? ` · **Molestia:** ${desSlug(reporte.severidad)}` : '') +
    '\n';

  const pie =
    '---\n' +
    'Issue creado automáticamente por `reporteAIssue`. Este repo es público: el ' +
    'panel tapa mails y links de reunión antes de publicar el texto (§5.1). ' +
    'Contestar acá; el panel todavía no muestra las respuestas.';

  const cuerpo = [
    encabezado,
    bloque(tipo === 'bug' ? 'Qué pasa' : 'La idea', redactar(reporte.descripcion)),
    bloque('Cómo reproducirlo', redactar(reporte.pasos)),
    bloque('Actividad referida', referencia),
    `### Contexto\n\n| | |\n|---|---|\n${contexto}\n`,
    pie,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    title: `[${tipo}] ${titulo}`.slice(0, 200),
    body: cuerpo,
    // GitHub crea las etiquetas que no existan al crear el issue, pero conviene
    // tenerlas creadas antes para que queden con color y descripción.
    labels: ['reporte-panel', tipo],
  };
};

/**
 * Proyección de la actividad referida hacia el issue. Es la misma idea que
 * `toPublic.ts`: no se vuelca el documento, se elige qué sale.
 *
 * @param {Record<string, any> | null | undefined} actividad
 */
export const actividadParaIssue = (actividad) => {
  if (!actividad || actividad.estado !== 'publicado') return null;
  return { titulo: actividad.titulo ?? '', slug: actividad.slug ?? '' };
};
