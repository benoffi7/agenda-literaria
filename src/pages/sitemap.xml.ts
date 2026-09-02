import type { APIRoute } from 'astro';
import { sitemapDelSitio } from '@/lib/contenidoDelSitio';
import { xmlDelSitemap } from '@/lib/sitemap';

/**
 * `/sitemap.xml` — B-109, §5.6 del diseño.
 *
 * ── A mano, no con `@astrojs/sitemap` ────────────────────────────────────
 * Las reglas de qué entra son propias (90 días para las pasadas, 30 para las
 * canceladas, meses con 3 o más) y no se expresan en la configuración de un
 * integrador, que además armaría el sitemap **de lo que hay en `dist/`** — donde
 * están, a propósito, todas las páginas que no tienen que estar acá. El
 * razonamiento completo y las reglas están en `src/lib/sitemap.ts`.
 *
 * Y hay una razón de repo además de la de diseño: una dependencia nueva es una
 * decisión que este cambio no necesita tomar.
 *
 * ── Este archivo solo serializa ───────────────────────────────────────────
 * Igual que `events.json.ts`: **qué documentos se leen** lo decide el lector
 * (`contenidoDelSitio.ts`, con la cláusula de credenciales de D-123 y las dos
 * queries de estado de B-110), **qué rutas entran** lo decide `lib/sitemap.ts`, y
 * acá se pega el XML. La plantilla no ve el índice ni el documento: recibe una
 * lista de rutas y nada más (D-140).
 *
 * ── Cero lecturas nuevas de Firestore ─────────────────────────────────────
 * `contenidoDelSitio()` está memoizada, así que este endpoint es el quinto
 * consumidor de **la misma** lectura del build (§3 del diseño).
 *
 * ── La cabecera de cache ──────────────────────────────────────────────────
 * En un sitio estático la de esta `Response` solo vale en el dev server; la de
 * producción es la de `firebase.json`. Un sitemap con la cache por defecto de
 * Hosting es correcto: Google lo relee cada varias horas y una hora de retraso no
 * cambia nada.
 */
export const prerender = true;

export const GET: APIRoute = async () =>
  new Response(xmlDelSitemap(await sitemapDelSitio()), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
