import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Ningún host de tercero se contacta antes de que la persona decida — D-254.
 *
 * ── Qué pasó ──────────────────────────────────────────────────────────────
 * `Base.astro` tenía `<link rel="preconnect" href="https://www.googletagmanager.com">`
 * sin ninguna condición de consentimiento (solo `conChrome`, para no ofrecerlo
 * en `/admin`). Lo encontró el coordinador leyendo `dist/index.html`
 * de un build real, con un `grep` a mano — no un chequeo, así que la próxima
 * vez no había garantía de encontrarlo.
 *
 * Un `preconnect` **no es una pista pasiva**: el navegador resuelve DNS, abre
 * TCP y completa el handshake TLS (con SNI) **en el load**, antes de que
 * exista ningún script y sin que la persona haya tocado el banner. No manda
 * la URL ni cookies, pero sí le dice al borde de Google que este navegador,
 * desde esta IP, entró al sitio — y eso pasaba también para quien **rechaza**.
 * Contradice la promesa de D-250 («hasta que la persona decide, no se mide»)
 * y es exactamente lo que una auditoría de banner de cookies busca primero.
 *
 * ── Por qué no se condicionó, y se sacó ────────────────────────────────────
 * En un sitio estático el HTML es el mismo para todo el mundo: la decisión de
 * consentimiento vive en el `localStorage` de cada visitante, y `Base.astro`
 * no sabe cuál es cuando genera el HTML. Un `preconnect` condicional no
 * existe acá. Ponerlo por JavaScript, un instante antes de inyectar el script
 * del tag, tampoco ahorra nada: el pedido del script sale en el mismo tick.
 *
 * ── Qué verifica este archivo, y qué NO ────────────────────────────────────
 * Lee el **HTML construido** (no el fuente: un chequeo sobre el fuente tendría
 * que reimplementar el parser de Astro, la misma razón por la que
 * `tests/sin-comentarios-en-el-html.test.ts` también lee `dist/`) y exige que
 * todo host de un `<link rel="preconnect"|"dns-prefetch"|"prefetch"|"preload"|"stylesheet">`,
 * `<script src="...">` o `<iframe src="...">` **absoluto** esté en la lista
 * blanca de abajo, con su motivo escrito al lado.
 *
 * **No mira `<img>`.** Una actividad puede traer una imagen externa (un flyer
 * en Instagram, por decisión de producto — D-131 y compañía): ese host varía
 * por documento, ya es una salida pública decidida y auditada en
 * `07-seguridad.md`, y no tiene nada que ver con el consentimiento de
 * analítica. Lo que este chequeo cuida es la **infraestructura fija** que
 * sale igual en todas las páginas porque viene de un layout o componente
 * compartido — que es exactamente la clase de bug que causó esto.
 *
 * ── Requiere `dist/` ────────────────────────────────────────────────────────
 * Se saltea si no hay build, como los de emulador: correr `npm run build`
 * antes. En CI el build siempre corre, así que ahí no se saltea nunca.
 *
 * ── La lista blanca, y por qué cada uno está ───────────────────────────────
 * Los dos son de tipografía (`docs/referencias/sistema-visual.md`, B-260) y
 * son anteriores a todo esto — no tocarlos en este ítem. Que quede escrito
 * como pendiente y no como aceptado: autoalojar las tipografías eliminaría
 * esta conexión a un tercero en el load — **B-481** en el `BACKLOG`.
 */
const PERMITIDOS: { host: string; motivo: string }[] = [
  {
    host: 'fonts.googleapis.com',
    motivo:
      'la hoja de estilos de las tres familias tipográficas del sistema visual (B-260). Anterior a la analítica y sin relación con el consentimiento — B-481 propone autoalojarlas.',
  },
  {
    host: 'fonts.gstatic.com',
    motivo:
      'de donde Google sirve los archivos .woff2 que esa hoja de estilos referencia. Mismo caso que fonts.googleapis.com.',
  },
];

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const paginas = (): string[] => {
  try {
    return execFileSync('find', [raiz('dist'), '-name', '*.html'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
};

/** El host de una URL absoluta, o `null` si no lo es (relativa, `data:`, etc). */
const hostDe = (url: string): string | null => {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

interface Hallazgo {
  etiqueta: string;
  host: string;
}

/**
 * Los hosts absolutos de las etiquetas que hacen una conexión propia en el
 * load: `<link>` de precarga/hoja de estilos, `<script src>` y `<iframe src>`.
 * Deliberadamente NO mira `<img>` — ver el docblock.
 */
const hostsDeInfraestructura = (html: string): Hallazgo[] => {
  const hallazgos: Hallazgo[] = [];

  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const etiqueta = m[0];
    const rel = /\brel=["']?([\w -]+)["']?/i.exec(etiqueta)?.[1]?.toLowerCase() ?? '';
    const esDeConexion = /(^|\s)(preconnect|dns-prefetch|prefetch|preload|stylesheet)(\s|$)/.test(
      rel,
    );
    if (!esDeConexion) continue;
    const href = /\bhref=["']([^"']+)["']/i.exec(etiqueta)?.[1];
    const host = href ? hostDe(href) : null;
    if (host) hallazgos.push({ etiqueta, host });
  }

  for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const host = hostDe(m[1]!);
    if (host) hallazgos.push({ etiqueta: m[0], host });
  }

  for (const m of html.matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const host = hostDe(m[1]!);
    if (host) hallazgos.push({ etiqueta: m[0], host });
  }

  return hallazgos;
};

describe('ningún host de tercero se contacta antes del consentimiento — D-254', () => {
  const html = paginas();

  it.skipIf(html.length === 0)('el barrido encuentra páginas construidas', () => {
    // Control positivo: sin build, los asertos de abajo pasarían sin mirar nada.
    expect(html.length).toBeGreaterThan(2);
    expect(html.some((f) => f.endsWith('/index.html'))).toBe(true);
  });

  it.skipIf(html.length === 0)(
    'la lista blanca no está vacía por un regex roto — control positivo',
    () => {
      // Si el parseo de arriba dejara de reconocer los `<link>` de fuentes,
      // este test pasaría comparando dos listas vacías. Se exige encontrar al
      // menos uno de los dos hosts permitidos en alguna página.
      const encontrados = new Set<string>();
      for (const archivo of html) {
        for (const h of hostsDeInfraestructura(readFileSync(archivo, 'utf8'))) {
          encontrados.add(h.host);
        }
      }
      const permitidosEncontrados = PERMITIDOS.filter((p) => encontrados.has(p.host));
      expect(
        permitidosEncontrados.length,
        'no se encontró ningún host permitido: ¿se rompió el parseo?',
      ).toBeGreaterThan(0);
    },
  );

  it.skipIf(html.length === 0)(
    'todo host de un <link> de conexión, <script> o <iframe> está en la lista blanca',
    () => {
      /*
       * MUTACIÓN PROBADA: se repuso a mano el
       * `<link rel="preconnect" href="https://www.googletagmanager.com">` en
       * `src/layouts/Base.astro`, se corrió `npm run build` y este `it` pasó
       * a rojo nombrando `www.googletagmanager.com` y el archivo exacto. Se
       * sacó de nuevo y se confirmó que vuelve a pasar.
       */
      const permitidos = new Set(PERMITIDOS.map((p) => p.host));
      const violaciones: string[] = [];

      for (const archivo of html) {
        const contenido = readFileSync(archivo, 'utf8');
        for (const h of hostsDeInfraestructura(contenido)) {
          if (!permitidos.has(h.host)) {
            const relativo = archivo.split('/dist/')[1] ?? archivo;
            violaciones.push(`${relativo} — ${h.host} — ${h.etiqueta.slice(0, 120)}`);
          }
        }
      }

      expect(
        violaciones,
        'un host de tercero aparece en el HTML sin pasar por el consentimiento. ' +
          'Si es legítimo (tipografía, CDN propio), agregalo a PERMITIDOS con el motivo ' +
          'escrito; si es analítica o un tercero de tracking, no se puede: tiene que ' +
          'inyectarse por JavaScript, condicionado a `debeCargarGA`/consentimiento ' +
          '(ver src/lib/medicionSitio.ts).',
      ).toEqual([]);
    },
  );
});
