import type { APIRoute } from 'astro';
import { indiceDelSitio } from '@/lib/contenidoDelSitio';
import { separarIndice } from '@/lib/eventsJson';

/**
 * `/events.json` — el índice que el listado filtra en memoria — B-106.
 *
 * ── Por qué es un endpoint del build y no una Cloud Function (§2.4) ───────
 * Decisión cerrada del `CLAUDE.md`: **no existe una Function que genere el
 * JSON.** Astro lo produce en build time leyendo Firestore con el Admin SDK, y
 * el resultado es un archivo estático que sirve el CDN. Con eso el público hace
 * **un** fetch cacheado y **cero** lecturas de Firestore (§2.5), lo que hace que
 * el costo de la parte pública sea prácticamente nulo.
 *
 * ── La lectura ya no vive acá — B-227 ────────────────────────────────────
 * Cuando este endpoint era el único consumidor de Firestore en el build, la
 * query y la cláusula de credenciales de D-123 estaban en este archivo. Desde que
 * el sitio público existe son **tres** los que necesitan exactamente lo mismo —el
 * índice, el HTML de la home y cada página de detalle— y las tres cosas se leen
 * una sola vez desde `src/lib/contenidoDelSitio.ts`.
 *
 * No es sólo ahorrar lecturas: copiar la query dos veces más es copiar el
 * `where('estado','==','publicado')` dos veces más, y la copia que se olvide de
 * actualizarse publica los borradores en el HTML mientras el JSON sigue limpio.
 * Es la clase de B-72, sobre la cláusula del §5.3.
 *
 * El §3.2 del diseño ya lo decía: las dos cláusulas las decide **el lector de
 * Firestore**, porque «seguir con lista vacía» es una respuesta que solo puede
 * dar él — es su valor de retorno.
 *
 * ── Lleva lo vigente, no todo — B-2191, D-1276 ────────────────────────────
 * Lo que terminó antes del mes pasado va a `/pasadas.json` (`separarIndice`).
 * La home sigue haciendo un solo pedido; `/pasadas`, los favoritos y la frescura
 * leen los dos. Las páginas que arma el build siguen usando el índice entero.
 *
 * ── La cabecera de cache vive en `firebase.json` ──────────────────────────
 * En un sitio estático las cabeceras de esta `Response` solo valen en el dev
 * server. La de producción es la de `firebase.json` (`no-cache`), y con eso
 * **cierra B-37**: el índice no puede quedar cacheado más viejo que el HTML que
 * lo acompaña.
 */
export const prerender = true;

export const GET: APIRoute = async () => {
  const { vigente: indice } = separarIndice(await indiceDelSitio());

  // B-2191 — sin sangría: la home baja y parsea este archivo en cada visita, y la
  // sangría eran 278 KB de espacios (un 35 % del archivo sin comprimir).
  return new Response(`${JSON.stringify(indice)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
};
