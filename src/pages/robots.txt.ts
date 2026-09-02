import type { APIRoute } from 'astro';
import { textoDeRobots } from '@/lib/sitemap';

/**
 * `/robots.txt` — B-109, §5.6 del diseño.
 *
 * Tres líneas y **no** un archivo en `public/`: la línea `Sitemap:` lleva la URL
 * absoluta, o sea el dominio, y el dominio se escribe en un solo lugar del repo
 * (`SITIO`, en `lib/rutasPublicas.ts`). Un `public/robots.txt` estático sería la
 * segunda copia, y la que queda vieja el día que el dominio cambie apunta el
 * sitemap a un host que no responde — sin que nada falle de este lado.
 *
 * El contenido y el razonamiento de qué se bloquea —`/admin` sí, los endpoints de
 * datos no, y por qué el `Disallow` **no** reemplaza al `noindex` de la página—
 * están en `textoDeRobots` (`lib/sitemap.ts`), que es puro y por eso testeable.
 *
 * No lee Firestore: no depende de los datos.
 */
export const prerender = true;

export const GET: APIRoute = () =>
  new Response(textoDeRobots(), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
