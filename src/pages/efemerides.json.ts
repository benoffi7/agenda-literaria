import type { APIRoute } from 'astro';
import { indiceDeEfemerides } from '@/lib/contenidoDelSitio';

/**
 * `/efemerides.json` — todas las efemérides publicadas, para que el navegador
 * elija **la de hoy** (B-959, §2.5).
 *
 * ── Por qué un archivo propio y no una parte de `events.json` ────────────
 * `events.json` lo baja el buscador de la home para filtrar actividades, y una
 * efeméride no es una actividad: meterla ahí obligaría a cada consumidor del
 * índice a saber descartarla. Y este archivo es chico a propósito —título, día,
 * mes, año y slug; sin la descripción—, porque lo baja toda persona que abre la
 * home para pintar un renglón.
 *
 * ── Por qué el día no lo elige el build ──────────────────────────────────
 * El contenido de «la efeméride de hoy» cambia todos los días sin que nadie
 * edite nada, y el sitio es estático: elegirla en el build sería un rebuild por
 * día para siempre. El JSON las lleva todas y el script de la home elige con la
 * zona de Buenos Aires (`efemeridesDeHoy`).
 *
 * La lectura y la proyección no viven acá: la query está en
 * `contenidoDelSitio.ts` (con su `where('estado','==','publicado')`) y la
 * whitelist en `efemeridePublica.ts`. La cabecera de cache de producción es la
 * de `firebase.json` (`no-cache`), como la de los otros índices.
 */
export const prerender = true;

export const GET: APIRoute = async () => {
  const indice = await indiceDeEfemerides();

  return new Response(`${JSON.stringify(indice)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
};
