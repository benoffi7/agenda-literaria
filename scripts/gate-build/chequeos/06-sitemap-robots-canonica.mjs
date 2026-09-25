/**
 * Paso 7 del gate (B-109, B-112), sobre los archivos que se suben.
 */
import {
  SLUG_BORRADOR,
  SLUG_CANCELADA,
  SLUG_CANCELADA_NUNCA,
  SLUG_PUBLICADA,
} from '../semilla.mjs';

export const nombre = "el sitemap, el robots.txt, la canónica y /pasadas";

/** @param {import('../chequeos.mjs').Contexto} ctx */
export const chequear = async (ctx) => {
  const { fallo, htmlDe, leer: leerDist } = ctx;
  /*
   * 7 · B-109 — **el sitemap, el robots.txt y la canónica, sobre los archivos
   * que se suben.**
   *
   * Los unitarios afirman sobre el valor de retorno de `rutasDelSitemap` y
   * sobre el texto de las plantillas; acá se mira lo que quedó en `dist/`, que
   * es lo único que ve Google. Es la misma diferencia que el punto 3: «la
   * proyección recorta» contra «el archivo que se sube no lo tiene».
   *
   * **El dominio no se escribe en este archivo**, y eso es a propósito: `SITIO`
   * (`src/lib/rutasPublicas.ts`) es la única aparición del dominio en el repo y
   * un `.mjs` no puede importar un `.ts`. Así que lo que se afirma es la
   * **forma** —absoluta, con barra final— y, sobre todo, que las cuatro salidas
   * coincidan en un solo origen: el del `Sitemap:` del robots, el de cada `loc`
   * del sitemap y el de la canónica de la página. Si alguien copia el dominio a
   * mano en una de las cuatro, empiezan a discrepar.
   */
  const robots = await leerDist('robots.txt');
  const sitemap = await leerDist('sitemap.xml');
  const htmlPublicada = await htmlDe(SLUG_PUBLICADA);

  if (robots === null || sitemap === null) {
    fallo(
      'no se generó dist/robots.txt o dist/sitemap.xml.\n' +
        '  Son los dos endpoints de B-109: sin ellos el sitio no se le ofrece a ningún buscador.',
    );
  } else if (htmlPublicada === null) {
    fallo(`no se generó dist/actividad/${SLUG_PUBLICADA}/index.html.`);
  } else {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const origenDe = (url) => {
      try {
        return new URL(url).origin;
      } catch {
        return null;
      }
    };

    // 7a · La publicada está, con la URL absoluta y con la barra final, que es
    // la forma que contesta 200 en Firebase (`/x` redirige a `/x/`).
    const suUrl = locs.find((u) => u.includes(`/actividad/${SLUG_PUBLICADA}/`));
    if (!suUrl) {
      fallo(
        `el sitemap.xml no lista /actividad/${SLUG_PUBLICADA}/.\n` +
          `  Salió con ${locs.length} URL(s) y ninguna es la de la actividad sembrada:\n` +
          '  el sitemap no vio los datos, o la ruta de detalle dejó de entrar.',
      );
    }

    const malFormadas = locs.filter((u) => !/^https:\/{2}[^/]+\/{1}/.test(u) || !u.endsWith('/'));
    if (malFormadas.length > 0) {
      fallo(
        'el sitemap.xml tiene URLs que no son absolutas o no llevan la barra final:\n' +
          malFormadas.map((u) => `    ${u}`).join('\n') +
          '\n  El protocolo las exige absolutas, y sin la barra Firebase contesta un 301:\n' +
          '  una entrada de sitemap que apunta a una redirección es una URL menos rastreada.',
      );
    }

    // 7b · Los controles negativos: ni el borrador, ni la cancelada que nunca
    // se publicó, ni el panel.
    const queNoVan = [
      [SLUG_BORRADOR, 'un borrador'],
      [SLUG_CANCELADA_NUNCA, 'una cancelada que nunca estuvo publicada'],
    ].filter(([slug]) => sitemap.includes(slug));
    if (queNoVan.length > 0) {
      fallo(
        'el sitemap.xml ofrece páginas que no existen:\n' +
          queNoVan.map(([slug, qué]) => `    ${slug} → ${qué}`).join('\n'),
      );
    }
    if (sitemap.includes('/admin')) {
      fallo('el sitemap.xml lista /admin: el panel no se indexa.');
    }
    // 7b-bis · Desde B-112, la publicada SÍ lleva `lastmod`, con la fecha de
    // su `updatedAt` recortada al día — el fixture la sembró con
    // `updatedAt: new Date()`, o sea hoy.
    const hoy = new Date().toISOString().slice(0, 10);
    const bloquePublicada = sitemap.slice(
      sitemap.indexOf(`<loc>${suUrl}</loc>`),
      sitemap.indexOf('</url>', sitemap.indexOf(`<loc>${suUrl}</loc>`)),
    );
    if (!bloquePublicada.includes(`<lastmod>${hoy}</lastmod>`)) {
      fallo(
        `el sitemap.xml no lleva <lastmod>${hoy}</lastmod> en /actividad/${SLUG_PUBLICADA}/.\n` +
          '  Desde B-112 el lastmod sale de `updatedAt` recortado al día (D-138); el ' +
          'fixture\n' +
          '  la sembró con `updatedAt: new Date()`, o sea hoy.',
      );
    }

    // Y la home —que no es una actividad— sigue sin uno: `lastmod` es por
    // ruta y no un booleano global del archivo entero. La URL de la home se
    // ubica por su `pathname` y no por el dominio (que no se escribe acá,
    // ver el comentario de arriba de este bloque).
    const urlHome = locs.find((u) => {
      try {
        return new URL(u).pathname === '/';
      } catch {
        return false;
      }
    });
    const bloqueHome = urlHome
      ? sitemap.slice(
          sitemap.indexOf(`<loc>${urlHome}</loc>`),
          sitemap.indexOf('</url>', sitemap.indexOf(`<loc>${urlHome}</loc>`)),
        )
      : '';
    if (bloqueHome.includes('lastmod')) {
      fallo(
        'el sitemap.xml lleva `lastmod` en la home.\n' +
          '  Solo las actividades tienen una fecha de edición que valga la pena declarar ' +
          '(B-112); la home, los hubs y los meses siguen sin `lastmod`.',
      );
    }
    if (sitemap.includes('changefreq') || sitemap.includes('priority')) {
      fallo('el sitemap.xml lleva `changefreq` o `priority`: Google los ignora desde hace años.');
    }

    // 7c · La cancelada **reciente** sí está: el fixture tiene `updatedAt` de
    // ahora, o sea dentro de la ventana de 30 días del §7.3.
    if (!sitemap.includes(`/actividad/${SLUG_CANCELADA}/`)) {
      fallo(
        `el sitemap.xml no lista la cancelada reciente (/actividad/${SLUG_CANCELADA}/).\n` +
          '  Se canceló hoy (updatedAt del fixture), así que está dentro de los 30 días\n' +
          '  del §7.3: su URL se sigue ofreciendo para que Google la relea y la tache.',
      );
    }

    // 7d · El robots.txt: bloquea el panel y anuncia el sitemap.
    if (!/^Disallow: \/admin$/m.test(robots)) {
      fallo('el robots.txt no bloquea /admin.');
    }
    const anuncio = /^Sitemap: (\S+)$/m.exec(robots);
    if (!anuncio) {
      fallo('el robots.txt no anuncia el sitemap.');
    }

    // 7e · **Las cuatro salidas, un solo origen.**
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(htmlPublicada);
    if (!canonical) {
      fallo(
        `dist/actividad/${SLUG_PUBLICADA}/index.html no lleva <link rel="canonical">.\n` +
          '  Es lo único que le dice a Google cuál de los tres nombres del sitio es el bueno.',
      );
    }
    const origenes = new Set(
      [anuncio?.[1], canonical?.[1], suUrl].filter(Boolean).map(origenDe),
    );
    if (origenes.size !== 1 || origenes.has(null)) {
      fallo(
        'el robots.txt, el sitemap.xml y la canónica de la página no coinciden en un ' +
          `origen: ${[...origenes].join(', ')}.\n` +
          '  Las cuatro salidas absolutas salen de `SITIO`; si discrepan, alguna copió el ' +
          'dominio a mano.',
      );
    }

    // 7f · Y la canónica de la página es **exactamente** su URL del sitemap:
    // dos formas distintas de la misma página son dos URLs para Google.
    if (canonical && suUrl && canonical[1] !== suUrl) {
      fallo(
        `la canónica de la página (${canonical[1]}) no es la URL que el sitemap ofrece ` +
          `(${suUrl}).`,
      );
    }

    // 7g · El Open Graph, que es la otra mitad de B-107: un link pegado en
    // Instagram sin `og:` se ve como un link pelado.
    for (const propiedad of ['og:title', 'og:url', 'og:site_name']) {
      if (!htmlPublicada.includes(`property="${propiedad}"`)) {
        fallo(`la página de la publicada no lleva ${propiedad}.`);
      }
    }

    // 7h · `/pasadas` existe y no publica el borrador. El fixture publicado es
    // de mañana, así que el archivo sale vacío — y eso también se afirma.
    const htmlPasadas = await leerDist('pasadas/index.html');
    if (htmlPasadas === null) {
      fallo(
        'no se generó dist/pasadas/index.html.\n' +
          '  Es la única página que enlaza una actividad que ya pasó una vez que su\n' +
          '  entrada del sitemap venció a los 90 días (§2.1).',
      );
    } else if (htmlPasadas.includes(SLUG_BORRADOR) || htmlPasadas.includes(SLUG_CANCELADA)) {
      fallo(
        '/pasadas publica un borrador o una cancelada.\n' +
          '  Recibe `EntradaDeIndice[]`, así que ninguno de los dos debería poder llegar (§7.3).',
      );
    }
  }
};
