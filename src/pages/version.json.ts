import type { APIRoute } from 'astro';
import { INFO_VERSION } from '@/lib/version';

/**
 * `/version.json` — cuál es la versión publicada.
 *
 * Es el único recurso que el panel consulta para saber si quedó viejo, así que
 * **no puede cachearse**: las cabeceras que lo garantizan en producción están
 * en `firebase.json` (`no-store`), porque en un sitio estático las cabeceras de
 * esta `Response` solo valen en el dev server.
 *
 * Es un endpoint y no un archivo suelto en `public/` para que el valor salga
 * del mismo lugar que el del bundle (`src/lib/version.ts`): dos fuentes se
 * desincronizan y el panel se recargaría en loop.
 *
 * También sirve para chequear a mano qué está publicado:
 *   curl -s https://agenda-literaria.web.app/version.json
 */
export const prerender = true;

export const GET: APIRoute = () =>
  new Response(`${JSON.stringify(INFO_VERSION, null, 2)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
