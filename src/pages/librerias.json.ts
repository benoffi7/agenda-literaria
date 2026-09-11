import type { APIRoute } from 'astro';
import { indiceDeLibrerias } from '@/lib/contenidoDelSitio';

/**
 * `/librerias.json` — el índice que el listado de `/guia/librerias` filtra en
 * memoria. B-831, § 4 del PRD 2.
 *
 * ── Por qué es un archivo propio y no una parte de `events.json` ──────────
 * Porque `events.json` lo baja **toda** persona que abre la agenda, y sumarle un
 * catálogo que el 90% no va a mirar le cobra el peso a la mayoría. Es la misma
 * lógica con la que el panel se corta del bundle público (§9), y está decidida en
 * el PRD.
 *
 * ── La URL no lleva `/guia/` ─────────────────────────────────────────────
 * `/guia/` es una decisión de navegación y de SEO, y esto **no es una página
 * navegable**: es un artefacto, como `/events.json` y `/version.json`. Decidido
 * el 2026-09-08 (`docs/prd/README.md`); si mañana el JSON también se mueve, es un
 * cambio de `rutasPublicas.ts` y del `fetch` del island, no del modelo.
 *
 * ── La lectura no vive acá ───────────────────────────────────────────────
 * Igual que `events.json.ts` y `sitemap.xml.ts`: **qué documentos se leen** lo
 * decide el lector (`contenidoDelSitio.ts`, con su `where('estado','==','publicado')`
 * y la cláusula de credenciales de D-123), **qué sale de cada uno** lo decide la
 * proyección (`libreriaPublica.ts`, una whitelist), y acá solo se serializa. Sin
 * ese corte, la cláusula del estado se copiaría una vez más y la copia que se
 * olvide publica lo pendiente — con el contacto interno de quien lo cargó.
 *
 * ── La cabecera de cache vive en `firebase.json` ─────────────────────────
 * En un sitio estático la de esta `Response` solo vale en el dev server. La de
 * producción es la de `firebase.json` (`no-cache`), que es lo que impide que el
 * índice quede más viejo que el HTML que lo acompaña (B-37).
 */
export const prerender = true;

export const GET: APIRoute = async () => {
  const indice = await indiceDeLibrerias();

  return new Response(`${JSON.stringify(indice, null, 2)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
};
