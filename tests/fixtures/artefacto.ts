/**
 * Un `dist/` sintético para manejar `scripts/verificar-bundle.sh` — B-873.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * Los dos barridos del HTML construido (B-261 y D-254) vivían como tests que
 * leían el `dist/` del repo y **se salteaban si no estaba**, que es la clase de
 * bug que B-873 levantó: en los dos workflows `dist/` no existe cuando vitest
 * mira, así que la corrida salía verde salteando los casos y nada lo decía.
 *
 * Los barridos se mudaron al gate del artefacto —el paso que los dos workflows
 * corren **después** del build— y lo que queda de este lado es probar el gate.
 * Se lo maneja como `tests/que-deployar.test.ts` maneja su script: se le arma la
 * entrada y se mira la salida. Con un artefacto sintético **no hay nada que
 * saltear**: el fixture siempre existe porque lo escribe el propio caso.
 *
 * ── El fixture tiene que pasar las cuatro secciones ───────────────────────
 * El gate es una secuencia: credenciales (§1), App Check (§2), el HTML limpio
 * (§3) y lo que tiene que estar (§4). Para que un caso pueda afirmar «este
 * artefacto sale en verde», el fixture tiene que llegar entero hasta el final —
 * si no, un verde sería solo «falló antes de mirar lo que me importa».
 *
 * Por eso el `.js` de abajo lleva lo que la sección 2 exige, y desde B-880 la
 * base lleva además una `404.html` y una hoja con las clases de la grilla, que
 * es lo que la sección 4 exige.
 *
 * **Y nada de eso está escrito a mano**: la clave sale de `.env.production` y
 * el resto de los módulos que lo declaran (`noEncontrado`, `rutasPublicas`,
 * `components/sitio/estilos`). Son las mismas fuentes que el gate lee, así que
 * el día que una constante cambie el fixture la sigue solo — escrito dos veces,
 * el fixture se quedaría viejo y el caso pasaría a probar el valor de antes.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { CLASES_DE_PARED, CLASES_DEL_TRIPTICO } from '@/components/sitio/estilos';
import { CLAVE_BUSQUEDA, TITULO_NO_ENCONTRADO } from '@/lib/noEncontrado';
import { RUTA_AGENDA, RUTA_PASADAS } from '@/lib/rutasPublicas';

/** La raíz del repo, que es desde donde hay que invocar el gate. */
export const RAIZ = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const claveDeSitio = (): string => {
  const env = readFileSync(join(RAIZ, '.env.production'), 'utf8');
  const clave = /^PUBLIC_RECAPTCHA_SITE_KEY=[ \t]*(\S+)/m.exec(env)?.[1];
  if (!clave) throw new Error('.env.production no declara PUBLIC_RECAPTCHA_SITE_KEY');
  return clave;
};

/**
 * Un `.js` que pasa las secciones 1 y 2 del gate: sin rastros del Admin SDK, con
 * la clave de sitio viajando en el objeto literal de `activarAppCheck`, sin
 * emuladores y con el endpoint de canje de Enterprise.
 *
 * Es la forma **minificada** a propósito (`!1` en vez de `false`), que es la que
 * el gate se va a encontrar en un build real.
 */
export const jsQuePasaAppCheck = (): string =>
  `const c={hayNavegador:typeof window<"u",usarEmuladores:!1,claveDeSitio:"${claveDeSitio()}"};` +
  `export const canje="exchangeRecaptchaEnterpriseToken";export default c;\n`;

/** El HTML mínimo de una página construida, sin nada que el gate pueda objetar. */
export const paginaLimpia = (titulo: string): string =>
  `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>` +
  `<link rel="stylesheet" href="/_astro/Base.css">` +
  `<link rel="icon" href="/marca.svg">` +
  `</head><body><h1>${titulo}</h1><script type="module" src="/_astro/app.js"></script></body></html>`;

/**
 * La página de error tal como el gate la espera — B-310, B-880.
 *
 * Las cinco señales que la sección 4.1 exige, y las cinco salen de la constante
 * que las declara: el título, el `noindex`, el formulario por GET, el nombre del
 * campo de búsqueda y el enlace al archivo.
 */
export const pagina404 = (): string =>
  `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">` +
  `<title>${TITULO_NO_ENCONTRADO}</title>` +
  `<meta name="robots" content="noindex, nofollow">` +
  `<link rel="stylesheet" href="/_astro/Base.css">` +
  `</head><body><h1>${TITULO_NO_ENCONTRADO}</h1>` +
  `<form action="${RUTA_AGENDA}" method="get">` +
  `<label for="q-404">Buscar</label>` +
  `<input id="q-404" type="search" name="${CLAVE_BUSQUEDA}">` +
  `</form>` +
  `<a href="${RUTA_PASADAS}">al archivo</a>` +
  `<script type="module" src="/_astro/app.js"></script></body></html>`;

/**
 * Una hoja construida con los selectores que la sección 4.2 exige — B-600.
 *
 * Es lo que Tailwind emite cuando ve el archivo que declara las clases: una
 * regla por utilidad del tríptico, más el marcador de la pared, que es el que
 * prueba que `components/sitio/estilos.ts` entró al scan. El cuerpo de la regla
 * da igual —el gate busca el selector—, así que va vacío.
 */
export const hojaConLaGrilla = (): string =>
  [
    "@font-face{font-family:'Public Sans';src:url('/fuentes/public-sans-v21-latin.woff2')}",
    ...[
      ...new Set([
        ...Object.values(CLASES_DEL_TRIPTICO).flatMap((c) => c.split(' ')),
        CLASES_DE_PARED[2],
      ]),
    ].map((clase) => `.${clase.replace(/:/g, '\\:')}{}`),
  ].join('\n') + '\n';

/** Los archivos que trae un artefacto sintético si el caso no dice otra cosa. */
const BASE = (): Record<string, string> => ({
  'index.html': paginaLimpia('Agenda'),
  'ayuda/index.html': paginaLimpia('Ayuda'),
  '404.html': pagina404(),
  '_astro/app.js': jsQuePasaAppCheck(),
  '_astro/Base.css': hojaConLaGrilla(),
});

export interface Corrida {
  /** El estado de salida del gate: 0 es verde. */
  estado: number;
  /** `stdout` y `stderr` juntos — los `::error::` del gate salen por `stdout`. */
  salida: string;
}

/**
 * Escribe un artefacto sintético, le corre el gate encima y lo borra.
 *
 * `archivos` se mezcla sobre la base: una clave con contenido la reemplaza o la
 * agrega, y `null` la saca (así se puede probar el artefacto sin páginas, que es
 * la guarda de B-873).
 */
export const correrGate = (archivos: Record<string, string | null> = {}): Corrida => {
  const dir = mkdtempSync(join(tmpdir(), 'artefacto-'));
  try {
    const contenido: Record<string, string | null> = { ...BASE(), ...archivos };
    for (const [rel, texto] of Object.entries(contenido)) {
      if (texto === null) continue;
      const destino = join(dir, rel);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, texto);
    }
    const r = spawnSync('./scripts/verificar-bundle.sh', [dir], {
      cwd: RAIZ,
      encoding: 'utf8',
    });
    return { estado: r.status ?? -1, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
