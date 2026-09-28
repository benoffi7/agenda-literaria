#!/usr/bin/env node
/**
 * **El resumen diario de lo que entró a la bandeja** — roadmap 2.1.
 *
 * Con cuatro formularios públicos abiertos —las propuestas de actividades y las
 * fichas de librerías, suscripciones, lugares y bibliotecas—, lo que entra se
 * contesta el mismo día solo si alguien se entera el mismo día. La bandeja tenía
 * su contador en el panel, pero hay que abrir el panel para verlo. Esto manda
 * **un mail por día a las 9**, con lo que entró desde el día anterior. El dueño
 * eligió el resumen diario y no un mail por envío: con cuatro formularios, uno por
 * cada uno se vuelve ruido.
 *
 * ── Qué dice el mail, y qué no ─────────────────────────────────────────────
 * **Solo el título** de cada propuesta o el nombre de cada ficha, cuántas siguen
 * esperando, y el link al panel. **Nunca el contacto de quien propone ni su texto**:
 * el contacto es el dato personal de un tercero (07-seguridad.md), y un mail no se
 * borra. No es cuidado al armar el texto: la lectura **pide** solo esos campos
 * (`select`), así que el contacto no llega a la memoria de este proceso.
 *
 * ── Por qué un workflow y no una Function ──────────────────────────────────
 * La casilla de avisos del proyecto ya existe (B-1140) y su contraseña de
 * aplicación vive como secret de GitHub Actions. Una Function necesitaría la
 * misma contraseña **copiada** a Secret Manager: una credencial más, en dos
 * lugares. El workflow (`.github/workflows/resumen-diario.yml`) usa la que hay, y
 * lee la base con la cuenta del build (`deploy-ci@`). **No es una cuenta de solo
 * lectura** —puede desplegar reglas, Hosting y Functions (02-infraestructura §
 * Roles)—; acá solo se usa para leer, y la key vive en el `env` de un solo paso.
 *
 * **El texto no se imprime en el log**: el repo es público, sus logs también, y
 * los títulos los escribe cualquiera. El log dice cuántas, nada más.
 *
 * Uso:
 *   node scripts/resumen-de-la-bandeja.mjs            # arma y manda
 *   node scripts/resumen-de-la-bandeja.mjs --seco     # arma y no manda (tampoco imprime el texto)
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Las colecciones de la Guía que reciben fichas desde un formulario público. */
export const COLECCIONES_DE_FICHAS = [
  { coleccion: 'librerias', nombre: 'librería', plural: 'librerías' },
  { coleccion: 'suscripciones', nombre: 'suscripción', plural: 'suscripciones' },
  { coleccion: 'lugares', nombre: 'lugar', plural: 'lugares' },
  { coleccion: 'bibliotecas', nombre: 'biblioteca', plural: 'bibliotecas' },
];

/** Las propuestas que esperan una decisión. */
export const ESTADOS_PENDIENTES_DE_PROPUESTA = ['nueva', 'en-revision'];

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * El mail del día, o `null` si **no entró nada nuevo** en las últimas 24 horas.
 * Un mail diario que dice «nada» se aprende a ignorar, y el día que diga algo ya
 * nadie lo abre: si no hay novedades, no sale.
 *
 * @param {{
 *   propuestas: { titulo: string, creadoEn: Date | null }[],
 *   fichas: { coleccion: string, nombre: string, creadoEn: Date | null }[],
 *   ahora: Date,
 *   urlDelPanel: string,
 * }} entrada  lo pendiente, con solo los campos que el mail usa
 * @returns {{ asunto: string, cuerpo: string, nuevas: number } | null}
 */
export const resumenDeLaBandeja = ({ propuestas, fichas, ahora, urlDelPanel }) => {
  const desde = ahora.getTime() - DIA_MS;
  const esNueva = (x) => x.creadoEn !== null && x.creadoEn.getTime() > desde;
  const propuestasNuevas = propuestas.filter(esNueva);
  const fichasNuevas = fichas.filter(esNueva);
  const nuevas = propuestasNuevas.length + fichasNuevas.length;
  if (nuevas === 0) return null;

  // En una sola línea: un título con saltos podría escribir renglones falsos en el
  // mail —un «link al panel» que no es el nuestro—, y lo escribe cualquiera.
  const linea = (texto) => `  · ${texto.replace(/\s+/g, ' ').trim() || 'Sin título'}`;
  const bloques = [];
  if (propuestasNuevas.length > 0) {
    bloques.push(
      [`Propuestas de actividades (${propuestasNuevas.length}):`, ...propuestasNuevas.map((p) => linea(p.titulo))].join('\n'),
    );
  }
  for (const c of COLECCIONES_DE_FICHAS) {
    const deEsta = fichasNuevas.filter((f) => f.coleccion === c.coleccion);
    if (deEsta.length === 0) continue;
    bloques.push([`Fichas de ${c.plural} (${deEsta.length}):`, ...deEsta.map((f) => linea(f.nombre))].join('\n'));
  }

  const esperando = propuestas.length + fichas.length;
  return {
    /*
     * El asunto va **en ASCII** (`mail-de-aviso.sh`): un `Subject:` con acentos
     * sin codificar llega roto en varios clientes. Dice el número, que es lo que
     * decide si se abre ya.
     */
    asunto: `Agenda LEH: ${nuevas} ${nuevas === 1 ? 'envio nuevo' : 'envios nuevos'} en la bandeja`,
    cuerpo: [
      `Desde ayer a esta hora entraron ${nuevas} ${nuevas === 1 ? 'envío' : 'envíos'} por los formularios del sitio:`,
      '',
      bloques.join('\n\n'),
      '',
      `En total hay ${esperando} esperando una respuesta.`,
      `Para verlos y contestar: ${urlDelPanel}`,
      '',
      'Este mail no trae el contacto de quien propuso: está en la bandeja.',
      'Resumen automático del repo (roadmap 2.1).',
    ].join('\n'),
    nuevas,
  };
};

// ── Lo que toca la base y el correo ────────────────────────────────────────

const aFecha = (t) => (t && typeof t.toDate === 'function' ? t.toDate() : null);

const main = async () => {
  const { initializeApp, applicationDefault, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const crudo = process.env.FIREBASE_SERVICE_ACCOUNT;
  let credential;
  try {
    credential = crudo ? cert(JSON.parse(crudo)) : applicationDefault();
  } catch {
    // El mensaje de un JSON mal formado trae un pedazo del secreto: no se imprime.
    console.error('FIREBASE_SERVICE_ACCOUNT no es un JSON válido (su contenido no se imprime).');
    process.exit(1);
  }
  initializeApp({ credential, projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria' });
  const db = getFirestore();

  // `select` y no `get()` del documento entero: el contacto no viaja (ver arriba).
  const propuestas = (
    await db.collection('propuestas').where('estado', 'in', ESTADOS_PENDIENTES_DE_PROPUESTA).select('titulo', 'creadoEn').get()
  ).docs.map((d) => ({ titulo: String(d.get('titulo') ?? ''), creadoEn: aFecha(d.get('creadoEn')) }));

  const fichas = (
    await Promise.all(
      COLECCIONES_DE_FICHAS.map(async ({ coleccion }) =>
        (await db.collection(coleccion).where('estado', '==', 'pendiente').select('nombre', 'creadoEn').get()).docs.map(
          (d) => ({ coleccion, nombre: String(d.get('nombre') ?? ''), creadoEn: aFecha(d.get('creadoEn')) }),
        ),
      ),
    )
  ).flat();

  const sitio = (process.env.SITIO ?? 'https://agendaleh.ar').replace(/\/$/, '');
  const resumen = resumenDeLaBandeja({ propuestas, fichas, ahora: new Date(), urlDelPanel: `${sitio}/admin` });

  if (!resumen) {
    console.log(`Nada nuevo desde ayer (${propuestas.length + fichas.length} esperando). No se manda el mail.`);
    return;
  }
  console.log(`${resumen.nuevas} envío(s) nuevo(s); ${propuestas.length + fichas.length} esperando.`);
  if (process.argv.includes('--seco')) {
    console.log('--seco: no se manda.');
    return;
  }
  // `execFileSync` con los argumentos en un array: el texto no pasa por ninguna
  // shell, así que un título con comillas o `$(…)` no ejecuta nada.
  execFileSync('./scripts/mail-de-aviso.sh', [resumen.asunto, resumen.cuerpo], { stdio: ['ignore', 'inherit', 'inherit'] });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    // Solo el tipo de error: un mensaje de Firestore puede citar un documento.
    console.error(`El resumen falló: ${e?.code ?? e?.name ?? 'error'}`);
    process.exit(1);
  });
}
