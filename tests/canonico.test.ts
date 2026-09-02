/**
 * **El dominio se escribe una sola vez** — B-109, D-165.
 *
 * ── La clase de bug ──────────────────────────────────────────────────────
 * Tres salidas necesitan la URL absoluta del sitio: el `canonical` del `<head>`,
 * el Open Graph y el `sitemap.xml` (más el `url` del JSON-LD, que son cuatro).
 * Escrito a mano en cada una serían cuatro lugares donde puede quedar viejo, y
 * los cuatro modos de falla son silenciosos:
 *
 * | Copia vieja | Qué pasa |
 * |---|---|
 * | `canonical` | Google indexa el otro dominio, o ninguno |
 * | `og:url` | el link pegado en Instagram lleva a otra parte |
 * | `sitemap.xml` | se le ofrecen al buscador URLs que no responden |
 * | JSON-LD | el resultado enriquecido apunta a otro sitio |
 *
 * Ninguno se ve mirando la página. Es la clase de B-88 —un productor y un
 * consumidor derivando el mismo formato por separado— con cuatro consumidores.
 *
 * ── La red ───────────────────────────────────────────────────────────────
 * `SITIO` (`src/lib/rutasPublicas.ts`) es la única aparición del dominio en el
 * repo, y este archivo lo sostiene de las cuatro formas en que puede romperse:
 *
 * 1. la constante tiene la forma de un origen (https, sin barra, sin path);
 * 2. `astro.config.mjs` la **importa** en vez de copiarla;
 * 3. ningún otro archivo de `src/` escribe el dominio;
 * 4. la canónica que sale al HTML es **absoluta** y la arma el layout una vez.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  RUTA_PASADAS,
  SITIO,
  rutaCanonica,
  rutaDeDetalle,
  rutaDeMes,
  urlAbsoluta,
  urlDeDetalle,
  urlDeMes,
} from '@/lib/rutasPublicas';

const fuente = (rel: string): string => readFileSync(rel, 'utf8');

/**
 * El archivo **sin comentarios**, que es lo que se barre buscando el dominio.
 *
 * Un comentario no llega a ninguna salida: `src/pages/version.json.ts` trae el
 * `curl -s https://agendaleh.ar/version.json` que se copia a mano para chequear
 * qué está publicado, y `Base.astro` nombra el espejo de Firebase justamente para
 * explicar por qué la canónica tiene que ser absoluta. Barrer el texto crudo
 * fallaría contra su propia documentación, y la salida fácil sería dejar de
 * explicarlo — el mismo recorte que hace `tests/pagina-de-detalle.test.ts`.
 */
const sinComentarios = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Los archivos versionados de `src/`, que es donde no puede haber un dominio. */
const archivosDeSrc = (): string[] =>
  execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' }).split('\n').filter(Boolean);

describe('SITIO — la forma del origen', () => {
  it('es https y no lleva barra final ni path', () => {
    /*
     * La barra la pone `rutaCanonica`, que es la que sabe cuándo va. Con la
     * barra acá, toda URL saldría con `//` en el medio: los navegadores lo
     * toleran y Google lo cuenta como **otra** URL, así que el canonical y el
     * sitemap dejarían de coincidir con lo que la gente visita.
     */
    expect(SITIO).toMatch(/^https:\/\/[a-z0-9.-]+$/);
    expect(SITIO.endsWith('/')).toBe(false);
  });

  it('no es el espejo de Firebase', () => {
    /*
     * `agenda-literaria.web.app` **va a seguir sirviendo el sitio para siempre**:
     * Firebase no lo apaga. Si el canónico fuera ése, el dominio propio quedaría
     * como el duplicado — al revés de la decisión del dueño (D-165).
     */
    expect(SITIO).not.toContain('web.app');
    expect(SITIO).not.toContain('firebaseapp.com');
  });
});

describe('rutaCanonica — la forma que contesta 200', () => {
  it('la raíz es `/`', () => {
    expect(rutaCanonica('/')).toBe('/');
    expect(rutaCanonica('')).toBe('/');
  });

  it('una página lleva barra final', () => {
    /*
     * Medido contra producción el 2026-09-02: Firebase responde `/cartelera`
     * con un **301** a `/cartelera/`. Una canónica que apunta a una redirección
     * es un aviso en Search Console, y una entrada de sitemap que apunta a una
     * redirección es una URL menos rastreada.
     *
     * MUTACIÓN PROBADA: devolver `sinBarraFinal` (o sea, canónica sin la barra)
     * pone en rojo estos casos y el del sitemap — y el HTML se ve igual.
     */
    expect(rutaCanonica('/pasadas')).toBe('/pasadas/');
    expect(rutaCanonica('/pasadas/')).toBe('/pasadas/');
    expect(rutaCanonica('/actividad/taller-de-cronica')).toBe('/actividad/taller-de-cronica/');
    expect(rutaCanonica('/agenda/2026-09')).toBe('/agenda/2026-09/');
  });

  it('un archivo NO lleva barra final', () => {
    // `/sitemap.xml/` es un 404. Los cuatro endpoints del sitio viven en la raíz.
    expect(rutaCanonica('/sitemap.xml')).toBe('/sitemap.xml');
    expect(rutaCanonica('/robots.txt')).toBe('/robots.txt');
    expect(rutaCanonica('/events.json')).toBe('/events.json');
    expect(rutaCanonica('/version.json')).toBe('/version.json');
  });

  it('pero una página de más de un segmento sí, aunque tenga un punto', () => {
    /*
     * **La regla es «un solo segmento con un punto», no «tiene un punto»**, y
     * este caso es el que lo fija. `slugify` no produce puntos, pero un documento
     * editado a mano en la consola de Firestore sí puede tener un `slug` con uno
     * —el mismo razonamiento por el que `esTonoElegible` valida lo que se lee— y
     * con la regla laxa esa página quedaría sin la barra, o sea con una canónica
     * que redirige.
     *
     * Lo encontró el barrido de centinelas, cuyo slug de prueba es literalmente
     * `CENTINELA.slug`.
     */
    expect(rutaCanonica('/actividad/taller.de.cronica')).toBe('/actividad/taller.de.cronica/');
  });

  it('descarta query y fragmento', () => {
    // La canónica es la URL limpia: `/?cuando=2026-09` y `/` son la misma página
    // (§6.2), y publicar la primera como canónica multiplicaría la home por cada
    // combinación de filtros.
    expect(rutaCanonica('/?cuando=2026-09&tipo=taller')).toBe('/');
    expect(rutaCanonica('/pasadas#listado')).toBe('/pasadas/');
  });

  it('una ruta sin barra inicial se normaliza', () => {
    expect(rutaCanonica('pasadas')).toBe('/pasadas/');
  });

  it('una URL absoluta corta el build en vez de duplicar el origen', () => {
    /*
     * Sin este `throw`, `urlAbsoluta('https://otro.com/x')` devuelve
     * `https://agendaleh.arhttps://otro.com/x`: una canónica malformada que no se
     * ve mirando la página y que publica el deploy siguiente. Un build que muere
     * con el motivo escrito es la respuesta correcta.
     */
    expect(() => rutaCanonica('https://agendaleh.ar/pasadas')).toThrow(/URL absoluta/);
    expect(() => rutaCanonica('mailto:hola@ejemplo.com')).toThrow(/URL absoluta/);
  });
});

describe('urlAbsoluta — de la que salen las cuatro salidas', () => {
  it('pega el origen y la ruta canónica', () => {
    expect(urlAbsoluta('/')).toBe(`${SITIO}/`);
    expect(urlAbsoluta(RUTA_PASADAS)).toBe(`${SITIO}/pasadas/`);
  });

  it('las URLs de actividad y de mes salen de las mismas rutas que los `href`', () => {
    /*
     * Es la propiedad que importa: la URL absoluta **no** es una segunda
     * derivación del path. Si `rutaDeDetalle` cambiara a `/taller/{slug}`, la
     * canónica, el sitemap y el JSON-LD lo siguen solos.
     */
    expect(urlDeDetalle('taller-de-cronica')).toBe(
      `${SITIO}${rutaCanonica(rutaDeDetalle('taller-de-cronica'))}`,
    );
    expect(urlDeMes('2026-09')).toBe(`${SITIO}${rutaCanonica(rutaDeMes('2026-09'))}`);
    expect(urlDeDetalle('taller-de-cronica')).toContain('/actividad/');
  });
});

describe('nadie más escribe el dominio', () => {
  const DUEÑO = 'src/lib/rutasPublicas.ts';

  /** El dominio sin el `https://`, que es lo que hay que buscar en el texto. */
  const HOST = SITIO.replace(/^https:\/\//, '');

  it('control positivo: el barrido ve archivos y el dueño está entre ellos', () => {
    // Sin esto, un `git ls-files` vacío haría pasar el caso de abajo sin haber
    // mirado nada.
    const archivos = archivosDeSrc();
    expect(archivos.length).toBeGreaterThan(20);
    expect(archivos).toContain(DUEÑO);
  });

  it('ningún archivo de `src/` tiene el dominio escrito, salvo el que lo define', () => {
    /*
     * MUTACIÓN PROBADA: escribir `href="https://agendaleh.ar/sitemap.xml"` en
     * `robots.txt.ts` en vez de derivarlo de `SITIO` pone este caso en rojo. Es
     * la mutación que pide B-109: «una URL absoluta escrita a mano en vez de
     * derivada».
     *
     * Se exceptúa **el que lo define**, y ninguno más por patrón: una excepción
     * por carpeta dejaría entrar la próxima copia sin que nadie la decida.
     */
    const conDominio = archivosDeSrc()
      .filter((f) => f !== DUEÑO)
      .filter((f) => sinComentarios(fuente(f)).includes(HOST));

    expect(
      conDominio,
      `estos archivos escriben «${HOST}» en vez de derivarlo de SITIO ` +
        '(`src/lib/rutasPublicas.ts`): el día que el dominio cambie, la copia que ' +
        'quede vieja publica una canónica a otro sitio y nada falla.',
    ).toEqual([]);
  });

  it('`astro.config.mjs` importa SITIO en vez de copiarlo', () => {
    /*
     * `site` es de donde Astro resuelve todo lo demás, así que es la copia más
     * cara. Y es la única que no puede atarse por tipos: la config es `.mjs` y no
     * la ve `tsc`.
     *
     * MUTACIÓN PROBADA: reemplazar `site: SITIO` por el literal
     * `site: 'https://agendaleh.ar'` deja el build idéntico y pone esto en rojo.
     */
    const config = fuente('astro.config.mjs');
    expect(config).toContain("import { SITIO } from './src/lib/rutasPublicas.ts'");
    expect(config).toMatch(/site:\s*SITIO,/);
    expect(config).not.toContain(HOST);
  });
});

describe('la canónica del HTML la pone el layout, una sola vez', () => {
  const base = fuente('src/layouts/Base.astro');

  it('sale de `urlAbsoluta` y del pathname, y es absoluta', () => {
    /*
     * MUTACIÓN PROBADA: `href={Astro.url.pathname}` —la canónica **relativa**—
     * deja la página idéntica en el navegador y pone esto en rojo. Es la segunda
     * mutación que pide B-109, y es la que importa más: una canónica relativa se
     * resuelve contra el host que la sirvió, así que en
     * `agenda-literaria.web.app` diría que la página buena es la del espejo.
     */
    expect(base).toContain('const canonical = urlAbsoluta(Astro.url.pathname);');
    expect(base).toContain('<link rel="canonical" href={canonical} />');
    // El `href` de la canónica no puede ser el pathname pelado.
    expect(base).not.toMatch(/rel="canonical"\s+href=\{Astro\.url/);
  });

  it('el `og:image` sale absoluto aunque la prop venga relativa', () => {
    /*
     * **Lo pidió el `auditor-privacidad`.** El docblock de la prop decía
     * «absoluta o nada» y nada lo verificaba: hoy llega la portada de la
     * actividad, que es absoluta, pero **B-291** —las cinco imágenes por tipo—
     * va a llegar como `/og/taller.png`. Un `og:image` relativo lo ignoran los
     * scrapers en silencio: no hay preview y no hay error.
     *
     * MUTACIÓN PROBADA: emitir `content={imagen}` en vez de `content={imagenAbsoluta}`
     * deja la página igual, el preview del flyer sigue andando, y pone esto en
     * rojo — que es cuándo hay que mirarlo, o sea antes de B-291.
     */
    expect(base).toContain('const imagenAbsoluta = imagen');
    expect(base).toContain('urlAbsoluta(imagen)');
    expect(base).toContain('<meta property="og:image" content={imagenAbsoluta} />');
    expect(base).not.toMatch(/property="og:image" content=\{imagen\}/);
  });

  it('la barra final depende del host: `cleanUrls` y `trailingSlash` siguen sin tocarse', () => {
    /*
     * **La otra mitad del par, y la pidió el `auditor-privacidad`.**
     * `rutaCanonica` **predice** el comportamiento de Firebase —`/cartelera`
     * responde 301 a `/cartelera/`, medido contra producción el 2026-09-02— y
     * quien hace cierta esa predicción no es este repo: es la config del host más
     * el formato de salida de Astro.
     *
     * Con `"cleanUrls": true` en `firebase.json` —el cambio más natural del
     * mundo, «URLs más lindas»— la redirección se **invierte**: `/cartelera/`
     * pasa a redirigir a `/cartelera`, y entonces **toda** canónica y **todo**
     * `<loc>` del sitemap apuntan a un 301. En silencio: los tests de acá y de
     * `tests/sitemap.test.ts` afirman sobre la forma que producimos, no sobre la
     * que el host sirve. Lo mismo con `build.format: 'file'` en Astro, que emite
     * `cartelera.html` en vez de `cartelera/index.html`.
     *
     * Así que se afirma la ausencia de las tres, con el motivo: el día que
     * alguien las quiera tocar, este caso lo manda a cambiar `rutaCanonica` en el
     * mismo commit.
     */
    const hosting = fuente('firebase.json');
    expect(hosting).not.toContain('cleanUrls');
    expect(hosting).not.toContain('trailingSlash');
    expect(fuente('astro.config.mjs')).not.toContain('build:');
    // Control positivo: se está leyendo el archivo que se cree.
    expect(hosting).toContain('"hosting"');
  });

  it('el Open Graph mínimo está, y su `og:url` es la misma canónica', () => {
    for (const propiedad of ['og:type', 'og:site_name', 'og:title', 'og:url', 'og:description']) {
      expect(base, `falta ${propiedad}`).toContain(`property="${propiedad}"`);
    }
    expect(base).toContain('<meta property="og:url" content={canonical} />');
    expect(base).toContain('name="twitter:card"');
  });

  it('ninguna página se arma su propia canónica ni su propio Open Graph', () => {
    /*
     * Dos canónicas en la misma página es una canónica indefinida, y una página
     * con su propio `og:` se desalinea del resto en el primer cambio. La única
     * que puede emitirlos es el layout.
     */
    const paginas = archivosDeSrc().filter((f) => f.startsWith('src/pages/') && f.endsWith('.astro'));
    expect(paginas.length).toBeGreaterThan(3);
    const propias = paginas.filter((f) => {
      const codigo = sinComentarios(fuente(f));
      return codigo.includes('rel="canonical"') || codigo.includes('property="og:');
    });
    expect(propias).toEqual([]);
  });
});
