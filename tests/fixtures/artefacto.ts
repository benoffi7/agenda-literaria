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
 * ── El fixture tiene que pasar las secciones 1 y 2 ────────────────────────
 * El gate es una secuencia: credenciales (§1), App Check (§2) y recién después
 * el HTML (§3). Para que un caso pueda afirmar «este artefacto sale en verde»,
 * el fixture tiene que llegar entero hasta el final — si no, un verde sería solo
 * «falló antes de mirar lo que me importa».
 *
 * Por eso el `.js` de abajo lleva lo que la sección 2 exige, y **la clave sale
 * de `.env.production`**, no escrita a mano: es el mismo archivo que el gate
 * lee, así que si la clave del proyecto cambia el fixture la sigue sola.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

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

/** Los archivos que trae un artefacto sintético si el caso no dice otra cosa. */
const BASE = (): Record<string, string> => ({
  'index.html': paginaLimpia('Agenda'),
  'ayuda/index.html': paginaLimpia('Ayuda'),
  '_astro/app.js': jsQuePasaAppCheck(),
  '_astro/Base.css': "@font-face{font-family:'Public Sans';src:url('/fuentes/public-sans-v21-latin.woff2')}\n",
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
