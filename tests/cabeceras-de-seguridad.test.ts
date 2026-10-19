/**
 * **Las cabeceras de seguridad de Hosting** — B-2196.
 *
 * Hasta acá `firebase.json` solo declaraba `Cache-Control`: cualquier sitio podía
 * enmarcar `/proponer`, los `/guia/*\/sumar` o `/admin` en un iframe.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Regla = { source?: string; regex?: string; headers: { key: string; value: string }[] };
const reglas: Regla[] = JSON.parse(readFileSync('firebase.json', 'utf8')).hosting.headers;
const seguridad = reglas.find((r) => r.headers.some((h) => h.key === 'X-Frame-Options'));
const valor = (clave: string) => seguridad?.headers.find((h) => h.key === clave)?.value;

describe('las cabeceras de seguridad — B-2196', () => {
  it('nadie enmarca el sitio, ni el panel ni los formularios', () => {
    // Mutación probada: borrar la regla pone rojo todo el archivo.
    expect(valor('X-Frame-Options')).toBe('DENY');
    expect(valor('Content-Security-Policy')).toBe("frame-ancestors 'none'");
    expect(valor('X-Content-Type-Options')).toBe('nosniff');
    expect(valor('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('cubre todas las rutas del sitio, menos las reservadas `/__/` del login', () => {
    /*
     * El `authDomain` es `agenda-literaria.firebaseapp.com`, que es este mismo
     * sitio: `signInWithPopup` carga su `/__/auth/iframe` desde `agendaleh.ar`,
     * otro origen, y `frame-ancestors 'none'` ahí rompería el login. Hosting no
     * aplica cabeceras propias a `/__/` (medido el 2026-10-19), pero la regla lo
     * excluye igual. Va con regex y sin lookahead porque Hosting usa RE2.
     */
    const r = new RegExp(seguridad!.regex!);
    for (const ruta of ['/', '/proponer/', '/admin', '/admin/actividades', '/_astro/x.js', '/events.json'])
      expect(r.test(ruta), ruta).toBe(true);
    for (const ruta of ['/__/auth/iframe', '/__/auth/handler', '/__/firebase/init.js'])
      expect(r.test(ruta), ruta).toBe(false);
    expect(seguridad!.regex).not.toMatch(/\(\?[=!<]/);
  });
});
