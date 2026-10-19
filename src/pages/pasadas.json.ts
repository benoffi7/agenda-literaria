import type { APIRoute } from 'astro';
import { indiceDelSitio } from '@/lib/contenidoDelSitio';
import { separarIndice } from '@/lib/eventsJson';

/**
 * `/pasadas.json` — lo que terminó antes del mes pasado — B-2191, D-1276.
 *
 * Es la otra mitad de `/events.json`, con la misma forma y las mismas opciones:
 * la parte la decide `separarIndice`, una sola vez para los dos archivos. Lo leen
 * `/pasadas`, los favoritos y `verificarFrescuraDelSitio`; la home, no.
 *
 * La cabecera de producción es la de `firebase.json` (`no-cache`), igual que el
 * índice vigente: los dos tienen que corresponder al mismo build.
 */
export const prerender = true;

export const GET: APIRoute = async () => {
  const { pasado } = separarIndice(await indiceDelSitio());
  return new Response(`${JSON.stringify(pasado)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
};
