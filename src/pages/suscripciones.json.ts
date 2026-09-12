import type { APIRoute } from 'astro';
import { indiceDeSuscripciones } from '@/lib/contenidoDelSitio';

/**
 * `/suscripciones.json` — el índice que el listado de `/guia/suscripciones`
 * filtra en memoria. B-832, § 5 del PRD 3.
 *
 * ── Por qué es un archivo propio y no una parte de `events.json` ──────────
 * Porque `events.json` lo baja **toda** persona que abre la agenda, y sumarle un
 * catálogo que el 90% no va a mirar le cobra el peso a la mayoría. Es la misma
 * lógica con la que el panel se corta del bundle público (§9) y la misma decisión
 * que tomó `/librerias.json`.
 *
 * ── La URL no lleva `/guia/` ─────────────────────────────────────────────
 * `/guia/` es una decisión de navegación y de SEO, y esto **no es una página
 * navegable**: es un artefacto, como `/events.json`, `/librerias.json` y
 * `/version.json`. Por eso no entra al `sitemap.xml` — un endpoint de datos
 * ofrecido al buscador es una URL para que indexe un JSON.
 *
 * ── La lectura no vive acá ───────────────────────────────────────────────
 * **Qué documentos se leen** lo decide el lector (`contenidoDelSitio.ts`, con su
 * `where('estado','==','publicado')` y su `.select()`), **qué sale de cada uno**
 * lo decide la proyección (`suscripcionPublica.ts`, una whitelist), y acá solo se
 * serializa. Sin ese corte, la cláusula del estado se copiaría una vez más y la
 * copia que se olvide publica lo pendiente — con el contacto interno de quien lo
 * cargó, y con el precio crudo.
 *
 * ── La cabecera de cache vive en `firebase.json` ─────────────────────────
 * En un sitio estático la de esta `Response` solo vale en el dev server. La de
 * producción es la de `firebase.json` (`no-cache`), que es lo que impide que el
 * índice quede más viejo que el HTML que lo acompaña (B-37). Acá eso importa un
 * poco más que en los otros dos artefactos: el índice lleva **precios con su
 * fecha**, y un JSON viejo serviría una frase que ya no es la del build.
 */
export const prerender = true;

export const GET: APIRoute = async () => {
  const indice = await indiceDeSuscripciones();

  return new Response(`${JSON.stringify(indice, null, 2)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
};
