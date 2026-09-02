import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `medicionSitio.ts` es el transporte impuro (DOM, `localStorage`, `gtag.js`)
 * y por eso no tiene test de comportamiento como `analyticsSitio.ts` — es el
 * mismo criterio que el panel aplica a `analytics.ts`. Pero dos detalles de
 * este archivo puntual **sí** se pueden fijar por texto, sin DOM, y valen la
 * pena: los encontró el `auditor-privacidad` (D-253) y los dos son la clase
 * de bug que no rompe nada visible.
 */

const raiz = new URL('..', import.meta.url);
const src = readFileSync(fileURLToPath(new URL('src/lib/medicionSitio.ts', raiz)), 'utf8');
const sinComentarios = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('el shim de gtag usa el snippet real de Google (D-253)', () => {
  it('empuja `arguments`, no un array armado con rest params', () => {
    /*
     * `dataLayer.push(arguments)` es el snippet documentado. Un
     * `dataLayer.push([...algo])` es una forma distinta, y el riesgo —que
     * `gtag.js` la ignore en silencio una vez cargado— no vale la pena
     * correrlo pudiendo igualar el snippet real.
     *
     * MUTACIÓN PROBADA: volver a `window.gtag = function (...args) {
     * window.dataLayer.push(args); }` deja este `it` en rojo.
     */
    expect(sinComentarios).toContain('dataLayer!.push(arguments)');
    expect(sinComentarios).not.toMatch(/push\(\s*\[?\.\.\.\w*\]?\s*\)/);
  });
});

describe('el `page_location` y el `page_referrer` van siempre recortados (D-253)', () => {
  it('el `config` inicial pisa los dos campos con `ubicacionSinQuery`', () => {
    /*
     * Recortar solo `page_location` no alcanzaba: sin pisar también el
     * `page_referrer`, la URL de origen entera —con el texto del buscador si
     * se venía de `/?q=...`— viajaba igual, por el campo de al lado.
     *
     * MUTACIÓN PROBADA: borrar la línea de `page_referrer` del objeto de
     * `gtag('config', ...)` deja este `it` en rojo.
     */
    const config = /gtag\('config',\s*measurementId,\s*\{([\s\S]*?)\}\)/.exec(sinComentarios);
    expect(config, 'no se encontró la llamada a gtag(\'config\', ...)').not.toBeNull();
    expect(config![1]).toContain('page_location: ubicacionSinQuery(window.location.href)');
    expect(config![1]).toContain('page_referrer:');
    expect(config![1]).toContain('ubicacionSinQuery(document.referrer)');
  });
});

describe('nada se ejecuta al importar el módulo', () => {
  it('`cargarGtag` no se llama a nivel de módulo, solo desde funciones exportadas', () => {
    // Un side-effect al importar sería medir sin que nadie haya llamado a
    // nada — justo lo que el resto de este archivo se cuida de no hacer.
    const lineas = sinComentarios.split('\n').filter((l) => !/^\s*(export\s+)?const\s/.test(l));
    const llamadaSuelta = lineas.some((l) => /^\s*cargarGtag\(\)/.test(l));
    expect(llamadaSuelta).toBe(false);
  });
});
