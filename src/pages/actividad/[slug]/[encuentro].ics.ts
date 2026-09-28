import type { APIRoute, GetStaticPaths } from 'astro';
import { icsDeEvento, type EventoParaAgendar } from '@/lib/agendarEncuentro';
import { caminosDeDetalle } from '@/lib/contenidoDelSitio';

/**
 * `/actividad/<slug>/<encuentro>.ics` — «Agendar este encuentro» para el
 * calendario del iPhone y Outlook (roadmap 1.1).
 *
 * **Sale del mismo `DetallePublico` que la página**, y del campo que ya decidió
 * qué encuentros se pueden agendar (`agendar`, en `detallePublico.ts`): acá no hay
 * ninguna actividad ni documento de Firestore, así que no se puede interpolar nada
 * que la proyección no haya decidido publicar (D-140). Uno por encuentro que
 * todavía puede pasar; los cancelados y los que ya pasaron no tienen archivo.
 *
 * Es un archivo del `dist/`, así que lo barre el gate como a todo lo publicable.
 */
export const prerender = true;

export const getStaticPaths = (async () => {
  const caminos = await caminosDeDetalle();
  return caminos.flatMap(({ props: { detalle } }) =>
    detalle.encuentros.flatMap((e) =>
      e.agendar ? [{ params: { slug: detalle.slug, encuentro: e.id }, props: { evento: e.agendar.evento } }] : [],
    ),
  );
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(icsDeEvento((props as { evento: EventoParaAgendar }).evento), {
    headers: { 'content-type': 'text/calendar; charset=utf-8' },
  });
