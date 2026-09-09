/**
 * **Ninguna página del sitio público alcanza la plomería del panel** — B-841.
 *
 * ── El agujero que esto cierra, y por qué ninguna red lo veía ──────────────
 * Lo encontró el `auditor-privacidad` sobre la tanda de B-830. `campos/` salió
 * de `admin/` para que lo usen los formularios públicos de `prd/`, pero tres de
 * sus seis archivos siguen importando hacia adentro, y la cadena real es larga:
 *
 *   campos/{Seccion,TagsInput,TaxonomiaSelect}
 *     → @/lib/analytics          (la medición del **panel**)
 *       → @/lib/firebase-client
 *         → @/lib/appcheck       (estático desde B-836a)
 *           → firebase/app-check
 *
 * O sea que un formulario público a un `import` de distancia haría **dos** cosas
 * en el navegador de un visitante anónimo:
 *
 * 1. **medir sin consentimiento.** `debeMedir` tiene tres portones —navegador,
 *    no-emuladores, `measurementId`— y **ninguno es el consentimiento**: la
 *    analítica del panel nunca lo necesitó. La del sitio (salida 12) sí lo tiene.
 *    Un `Seccion` en una página pública dispararía `funcion_usada` y crearía el
 *    perfil de medición en `localStorage` para alguien que no tocó el banner, en
 *    la misma propiedad de GA4 que comparten los dos (B-801). Contradice D-250 y
 *    la promesa de `/apoyar`.
 * 2. **cargar dos terceros de Google antes del consentimiento**: `gtag.js` y el
 *    desafío de reCAPTCHA, este último con cuota facturable por visitante.
 *
 * **Y ninguna red lo diría.** `terceros-antes-del-consentimiento.test.ts` lee el
 * HTML de `dist/` buscando `<script src>` absolutos, y los dos los inyectan los
 * SDK en runtime desde un chunk local. `bundle-panel.test.ts` mira el chunk
 * inicial **del panel**, o sea la dirección contraria.
 * `build-credenciales.test.ts` barre `firebase-admin`, no el SDK cliente.
 *
 * ── Por qué esto y no el refactor ─────────────────────────────────────────
 * El arreglo de fondo es sacar la medición de esos tres componentes a una prop
 * opcional (`onMedir?`), que es el corte que hace a `campos/` genérico de verdad
 * — el panel pasa `medirFuncion`, un formulario público no pasa nada. Es B-841 y
 * va antes del primer formulario público con desplegable de taxonomía.
 *
 * Este archivo es lo que hace que se pueda **posponer sin riesgo**: si el
 * formulario nuevo importa `TaxonomiaSelect` antes de que B-841 esté hecho, se
 * pone rojo acá y no en producción.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const raiz = new URL('..', import.meta.url);
const ruta = (rel: string): string => fileURLToPath(new URL(rel, raiz));
const fuente = (rel: string): string => readFileSync(ruta(rel), 'utf8');

/**
 * Los especificadores que importa un archivo: estáticos, de efecto y
 * **diferidos**.
 *
 * Los `import()` cuentan igual, y es la diferencia que importa acá: para el
 * corte del bundle un diferido está bien —no entra al chunk inicial— y para
 * **esto** da lo mismo, porque el módulo se carga cuando el componente se usa y
 * mide igual. Son dos preguntas distintas sobre el mismo grafo.
 *
 * Las dos comillas, por lo mismo que en `bundle-panel.test.ts`: el repo no tiene
 * prettier, así que nada normaliza la comilla.
 */
const importsDe = (src: string): string[] => [
  ...[...src.matchAll(/^import\s+(?!type\s)[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!),
  ...[...src.matchAll(/^import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!),
  ...[...src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]!),
];

const aArchivo = (spec: string, desde: string): string | null => {
  let base: string;
  if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith('.')) {
    const partes = desde.split('/').slice(0, -1);
    for (const p of spec.split('/')) {
      if (p === '.') continue;
      else if (p === '..') partes.pop();
      else partes.push(p);
    }
    base = partes.join('/');
  } else return null;
  for (const cand of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.astro`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]) {
    if (cand.includes('.') && existsSync(ruta(cand))) return cand;
  }
  return null;
};

/** Todas las páginas de `src/pages`, incluidas las de subcarpetas. */
const paginas = (): string[] =>
  readdirSync(ruta('src/pages'), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.astro'))
    .map((f) => `src/pages/${f}`)
    .sort();

/** El primer camino de `pagina` a `objetivo`, o `null`. Devuelve la cadena. */
const caminoHasta = (pagina: string, objetivos: readonly string[]): string[] | null => {
  const via = new Map<string, string>([[pagina, '']]);
  const pendientes = [pagina];
  while (pendientes.length > 0) {
    const archivo = pendientes.pop()!;
    for (const spec of importsDe(fuente(archivo))) {
      if (objetivos.includes(spec)) {
        // La cadena, de la página al hallazgo, para que el mensaje diga por dónde.
        const cadena = [spec, archivo];
        for (let a = via.get(archivo); a; a = via.get(a)) cadena.push(a);
        return cadena.reverse();
      }
      const destino = aArchivo(spec, archivo);
      if (destino && !via.has(destino)) {
        via.set(destino, archivo);
        pendientes.push(destino);
      }
    }
  }
  return null;
};

/**
 * Lo que una página pública no puede alcanzar, y los tres son el mismo problema
 * a distinta profundidad: `@/lib/analytics` mide sin consentimiento,
 * `firebase-client` es su camino, y `appcheck` es lo que ese camino arrastra
 * desde B-836a.
 */
const PLOMERIA_DEL_PANEL = ['@/lib/analytics', '@/lib/firebase-client', '@/lib/appcheck'];

/**
 * `/admin` es el panel: **tiene** que alcanzarla. Es la única excepción, y no es
 * una lista para ir agregando — la segunda entrada acá sería una página pública
 * midiendo sin consentimiento.
 */
const ES_EL_PANEL = 'src/pages/admin.astro';

describe('la plomería del panel no llega al sitio público — B-841', () => {
  it('hay páginas que recorrer, y son varias', () => {
    // Control positivo: un `readdirSync` que devolviera vacío dejaría el caso de
    // abajo pasando sin haber mirado nada.
    const todas = paginas();
    expect(todas.length).toBeGreaterThan(8);
    expect(todas).toContain(ES_EL_PANEL);
    expect(todas).toContain('src/pages/index.astro');
  });

  it('CONTROL POSITIVO: `/admin` sí la alcanza, así que el grafo sabe encontrarla', () => {
    // Sin esto, «ninguna página la alcanza» podría querer decir que el recorrido
    // no resuelve los imports — que es el modo de falla de B-117.
    const camino = caminoHasta(ES_EL_PANEL, PLOMERIA_DEL_PANEL);
    expect(camino, 'el grafo no encuentra la medición ni desde el panel').not.toBeNull();
    expect(camino!.length).toBeGreaterThan(2);
  });

  it('ninguna otra página la alcanza, ni por `import()`', () => {
    const hallazgos = paginas()
      .filter((p) => p !== ES_EL_PANEL)
      .map((p) => [p, caminoHasta(p, PLOMERIA_DEL_PANEL)] as const)
      .filter(([, camino]) => camino !== null)
      .map(([p, camino]) => `${p}\n      ${camino!.join('\n        → ')}`);
    expect(
      hallazgos,
      'una página del sitio público alcanza la medición del **panel**, que no tiene ' +
        'portón de consentimiento (D-250), y su cadena arrastra App Check. Es B-841: ' +
        'el arreglo es que el componente reciba la medición por prop, no que la importe.',
    ).toEqual([]);
  });
});
