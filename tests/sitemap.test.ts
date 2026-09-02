import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import {
  DIAS_DE_CANCELADA,
  DIAS_DE_PASADA,
  RUTAS_FIJAS,
  RUTA_BLOQUEADA,
  rutasDelSitemap,
  textoDeRobots,
  xmlDelSitemap,
} from '@/lib/sitemap';
import { MINIMO_DE_ACTIVIDADES } from '@/lib/mesPublico';
import { SITIO, rutaCanonica, rutaDeDetalle, urlAbsoluta } from '@/lib/rutasPublicas';
import { entradaDePrueba } from './fixtures/indice';

/**
 * `sitemap.xml` y `robots.txt` — B-109, §5.6 del diseño.
 *
 * ── Qué se puede romper acá, que no es que se rompa ───────────────────────
 * Nada de lo que este módulo haga mal deja el build en rojo, y el sitemap se ve
 * bien igual: es una lista de URLs válidas. Los cinco modos de falla:
 *
 * 1. **Una pasada de más de 90 días sigue en el sitemap.** Se le pide a Google
 *    que rastree para siempre páginas que no cambian nunca, y el índice del sitio
 *    se llena de talleres de 2024.
 * 2. **Una cancelada de más de 30 días sigue en el sitemap.** Peor que la
 *    anterior: se ofrece activamente algo que no va a pasar.
 * 3. **Un mes con dos actividades entra.** El corte de tres del §2.2 existe para
 *    que la página de mes no sea un casi-duplicado de la home compitiendo con la
 *    página de detalle de cada actividad; ofrecerla en el sitemap es pedirle a
 *    Google que indexe justamente eso.
 * 4. **`/admin` se cuela.** El panel en Google, con su bundle rastreado.
 * 5. **Una URL escrita a mano** en vez de derivada de `SITIO`: la mitad del
 *    sitemap apuntando a un dominio y la otra mitad al otro.
 *
 * Los cinco tienen su caso acá, con la mutación anotada.
 *
 * ── El reloj entra como parámetro ─────────────────────────────────────────
 * Todo se mide contra `AHORA`, así que ningún caso depende de qué día es hoy —
 * que en un test de ventanas de 30 y 90 días es la diferencia entre un test y
 * una bomba de tiempo.
 */
const AHORA = new Date('2026-09-10T15:00:00Z');

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const fuente = (rel: string): string => readFileSync(raiz(rel), 'utf8');

/** Una actividad de una sola fecha, con su slug. */
const suelta = (slug: string, iso: string) =>
  entradaDePrueba({ id: slug, slug, titulo: slug, fechas: [iso] });

/** Cuántos días antes de `AHORA`, en ISO. */
const haceDias = (dias: number): string =>
  new Date(AHORA.getTime() - dias * 24 * 60 * 60 * 1000).toISOString();

const rutas = (o: {
  entradas?: ReturnType<typeof entradaDePrueba>[];
  canceladas?: { slug: string; editadaEn: string | null }[];
}) =>
  rutasDelSitemap({
    entradas: o.entradas ?? [],
    canceladas: o.canceladas ?? [],
    ahora: AHORA,
  });

describe('las páginas fijas', () => {
  it('están todas, y ninguna es un endpoint de datos', () => {
    expect(rutas({})).toEqual([...RUTAS_FIJAS]);
    for (const endpoint of ['/events.json', '/version.json', '/sitemap.xml', '/robots.txt']) {
      expect(RUTAS_FIJAS).not.toContain(endpoint);
    }
  });

  it('`/admin` no está, ni en la lista fija ni en ninguna salida', () => {
    /*
     * MUTACIÓN PROBADA: agregar `'/admin'` a `RUTAS_FIJAS` deja el sitemap
     * perfectamente válido —la URL responde— y pone este caso en rojo. Es la
     * cuarta mutación que pide B-109.
     *
     * Y se afirma sobre el XML además de sobre la lista: es la salida de verdad.
     */
    const todas = rutas({ entradas: [suelta('taller', '2026-09-20T22:00:00Z')] });
    expect(todas.some((r) => r.startsWith(RUTA_BLOQUEADA))).toBe(false);
    expect(xmlDelSitemap(todas)).not.toContain('/admin');
  });

  it('cada ruta fija resuelve a una página que existe', () => {
    /*
     * Una entrada de sitemap que da 404 es peor que no tenerla: es una URL que se
     * le ofrece al buscador y que le contesta que no existe. El chequeo mira el
     * disco porque es lo único que no se puede desincronizar.
     */
    const archivoDe = (ruta: string): string[] =>
      ruta === '/'
        ? ['src/pages/index.astro']
        : [`src/pages${ruta}.astro`, `src/pages${ruta}/index.astro`];

    const sinPagina = RUTAS_FIJAS.filter((r) => !archivoDe(r).some((f) => existsSync(raiz(f))));
    expect(
      sinPagina,
      'estas rutas están en el sitemap y no tienen página: se le ofrece un 404 al buscador',
    ).toEqual([]);
  });

  it('toda página estática del sitio está en la lista o exceptuada con motivo', () => {
    /*
     * La dirección que se olvida: **una página nueva no entra sola al sitemap**.
     * Sin esto, `/pasadas` habría podido nacer sin entrada —o sea sin la única
     * cosa que la hace útil para lo que existe (§2.1)— y nada lo habría dicho.
     *
     * Las excepciones son una lista explícita con su motivo, no un patrón: una
     * excepción por carpeta dejaría entrar la próxima página sin que nadie la
     * decida.
     */
    const EXCEPTUADAS: Record<string, string> = {
      '/admin': 'el panel no se indexa: `noIndex` en la página y `Disallow` en el robots.txt',
    };

    const paginas = execFileSync('git', ['ls-files', 'src/pages'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f.endsWith('.astro'))
      // Las dinámicas (`[slug]`, `[mes]`) entran por su propia regla, no por la
      // lista fija.
      .filter((f) => !f.includes('['));
    expect(paginas.length).toBeGreaterThan(3);

    const rutaDe = (archivo: string): string =>
      archivo.replace(/^src\/pages/, '').replace(/(\/index)?\.astro$/, '') || '/';

    const faltantes = paginas
      .map(rutaDe)
      .filter((r) => !RUTAS_FIJAS.includes(r) && !(r in EXCEPTUADAS));
    expect(
      faltantes,
      'estas páginas existen y no están en el sitemap ni exceptuadas: una página sin ' +
        'entrada y sin links internos vale casi nada para un buscador (§2.1)',
    ).toEqual([]);

    // Y las excepciones tienen que seguir existiendo: una excepción para una
    // página borrada tapa algo distinto de lo que decía tapar.
    for (const r of Object.keys(EXCEPTUADAS)) {
      expect(paginas.map(rutaDe)).toContain(r);
    }
  });
});

describe('las actividades publicadas: 90 días desde la última fecha (§7.1)', () => {
  it('la que tiene fecha por venir entra', () => {
    expect(rutas({ entradas: [suelta('taller', '2026-09-20T22:00:00Z')] })).toContain(
      rutaDeDetalle('taller'),
    );
  });

  it('la que pasó hace menos de 90 días entra', () => {
    expect(rutas({ entradas: [suelta('reciente', haceDias(DIAS_DE_PASADA - 1))] })).toContain(
      rutaDeDetalle('reciente'),
    );
  });

  it('la que pasó hace más de 90 días NO entra, y su página sigue existiendo', () => {
    /*
     * MUTACIÓN PROBADA: sacar el filtro de `rutasDePublicadas` (o subir
     * `DIAS_DE_PASADA` a 9000) pone este caso en rojo y ningún otro se entera. Es
     * la tercera mutación que pide B-109.
     *
     * **Lo que este caso NO dice** es que la página desaparezca: el §7.1 es
     * explícito —la página se conserva indefinidamente, está linkeada de
     * Instagram y de grupos de WhatsApp (trampa 10)— y sigue en `/pasadas` para
     * siempre. Lo único que se acaba es la entrada del sitemap. Eso lo verifica
     * `tests/pasadas.test.ts` y el generador de caminos de detalle, que no mira
     * fechas.
     */
    const salida = rutas({ entradas: [suelta('vieja', haceDias(DIAS_DE_PASADA + 1))] });
    expect(salida).not.toContain(rutaDeDetalle('vieja'));
    expect(salida).toEqual([...RUTAS_FIJAS]);
  });

  it('el borde exacto de los 90 días entra', () => {
    // El `<=` de la ventana, escrito: sin este caso, un `<` estricto pasaría
    // desapercibido y la URL saldría un día antes.
    expect(rutas({ entradas: [suelta('borde', haceDias(DIAS_DE_PASADA))] })).toContain(
      rutaDeDetalle('borde'),
    );
  });

  it('sin ninguna fecha usable entra igual', () => {
    /*
     * Una actividad con todos sus encuentros cancelados (B-254) no tiene `hasta`,
     * así que no hay reloj contra el que medirla. Su página existe y está
     * publicada: excluirla sería decidir que es vieja sin ningún dato que lo
     * diga. Es el mismo criterio del error inofensivo con el que se eligió
     * `updatedAt` para las canceladas.
     */
    const todaCancelada = entradaDePrueba({
      id: 'sin-fecha',
      slug: 'sin-fecha',
      fechas: ['2026-09-20T22:00:00Z'],
      canceladas: [0],
    });
    expect(rutas({ entradas: [todaCancelada] })).toContain(rutaDeDetalle('sin-fecha'));
  });

  it('una actividad sin slug no puede tener URL, así que no entra', () => {
    // No debería pasar (el schema lo exige) y si pasa, mejor una entrada menos
    // que una `/actividad/` en el sitemap.
    expect(rutas({ entradas: [suelta('', '2026-09-20T22:00:00Z')] })).toEqual([...RUTAS_FIJAS]);
  });
});

describe('las canceladas: 30 días desde la última edición (§7.3)', () => {
  it('la cancelada hace poco entra', () => {
    expect(
      rutas({ canceladas: [{ slug: 'cancelada-nueva', editadaEn: haceDias(1) }] }),
    ).toContain(rutaDeDetalle('cancelada-nueva'));
  });

  it('la editada hace más de 30 días NO entra, y su página sigue existiendo', () => {
    /*
     * MUTACIÓN PROBADA: sacar el filtro de `rutasDeCanceladas` pone este caso en
     * rojo y ningún otro. Es la cuarta mutación que pide B-109.
     *
     * **La página no se borra a los 30 días** (§7.3, B-110): sigue existiendo
     * para quien tenga el link y para que Google pueda tachar el resultado que ya
     * indexó. Lo único que sale es la entrada del sitemap.
     */
    const salida = rutas({
      canceladas: [{ slug: 'cancelada-vieja', editadaEn: haceDias(DIAS_DE_CANCELADA + 1) }],
    });
    expect(salida).not.toContain(rutaDeDetalle('cancelada-vieja'));
    expect(salida).toEqual([...RUTAS_FIJAS]);
  });

  it('la ventana de las canceladas es más corta que la de las pasadas', () => {
    /*
     * No es un número arbitrario y conviene que un test lo diga: una pasada sigue
     * siendo la mejor respuesta a quien busca ese taller por su nombre, y una
     * cancelada no —no pasó nada que contar—. Si alguien igualara las dos
     * ventanas, esto lo pone en rojo y hay que venir a decidirlo.
     */
    expect(DIAS_DE_CANCELADA).toBeLessThan(DIAS_DE_PASADA);
  });

  it('sin fecha de edición no entra: acá el default es al revés', () => {
    /*
     * En las publicadas, sin fecha la URL se queda (la página existe y está
     * publicada). En las canceladas, sin fecha **no** entra: una cancelada está
     * en el sitemap solo mientras la cancelación sea noticia, y sin fecha no se
     * puede afirmar que lo sea.
     */
    expect(rutas({ canceladas: [{ slug: 'sin-fecha', editadaEn: null }] })).toEqual([
      ...RUTAS_FIJAS,
    ]);
    expect(rutas({ canceladas: [{ slug: 'vacia', editadaEn: '' }] })).toEqual([...RUTAS_FIJAS]);
  });
});

describe('los meses: solo los enlazables (§2.2)', () => {
  /** N actividades sueltas del mismo mes. */
  const delMes = (n: number, mes: string) =>
    Array.from({ length: n }, (_, i) =>
      suelta(`act-${mes}-${i}`, `${mes}-${String(10 + i).padStart(2, '0')}T22:00:00Z`),
    );

  it('un mes con 3 o más entra', () => {
    const salida = rutas({ entradas: delMes(MINIMO_DE_ACTIVIDADES, '2026-10') });
    expect(salida).toContain('/agenda/2026-10');
  });

  it('un mes con 2 NO entra', () => {
    /*
     * MUTACIÓN PROBADA: usar `mesesConActividad` en vez de `mesesEnlazables` —o
     * bajar `MINIMO_DE_ACTIVIDADES`— pone este caso en rojo. Es la quinta
     * mutación que pide B-109.
     *
     * Y el corte no se copia acá: sale de `MINIMO_DE_ACTIVIDADES`, que es la
     * constante que decide qué páginas se emiten. Con el número escrito a mano,
     * este test seguiría en verde el día que el corte cambie y el sitemap
     * ofrecería páginas que no existen.
     */
    const salida = rutas({ entradas: delMes(MINIMO_DE_ACTIVIDADES - 1, '2026-10') });
    expect(salida).not.toContain('/agenda/2026-10');
    expect(salida.filter((r) => r.startsWith('/agenda/'))).toEqual([]);
  });

  it('el mes vencido NO entra, aunque su página se emita', () => {
    /*
     * El §2.2 lo pide con estas palabras: la página del mes que terminó se emite
     * **una última vez** para que su URL no devuelva 404, con `noindex`, y sale
     * del sitemap. Ofrecerla y pedirle a la vez que no la indexe es mandarle dos
     * señales opuestas a Google.
     *
     * MUTACIÓN PROBADA: cambiar `mesesEnlazables` por `mesesDelSitio` en
     * `rutasDelSitemap` pone este caso en rojo y deja los otros dos en verde.
     */
    const salida = rutas({ entradas: delMes(MINIMO_DE_ACTIVIDADES, '2026-08') });
    expect(salida).not.toContain('/agenda/2026-08');
  });
});

describe('el XML', () => {
  const XML = xmlDelSitemap(rutas({ entradas: [suelta('taller', '2026-09-20T22:00:00Z')] }));

  it('parsea: declaración, urlset y un `loc` por ruta', () => {
    expect(XML.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(XML).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(XML.trimEnd().endsWith('</urlset>')).toBe(true);
    const locs = [...XML.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    expect(locs.length).toBe(RUTAS_FIJAS.length + 1);
  });

  it('todas las URLs son absolutas y del dominio canónico', () => {
    /*
     * MUTACIÓN PROBADA: emitir `<loc>${ruta}</loc>` —la ruta relativa, que es lo
     * que uno escribe— deja el XML válido y pone este caso en rojo. Un sitemap
     * con URLs relativas lo descarta Google entero.
     *
     * Y el dominio no se escribe acá: sale de `SITIO`. Es la primera mutación que
     * pide B-109 —«una URL absoluta escrita a mano en vez de derivada»— y la
     * cubre además `tests/canonico.test.ts` para todo `src/`.
     */
    const locs = [...XML.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    expect(locs.every((u) => u.startsWith(`${SITIO}/`))).toBe(true);
    expect(locs).toContain(urlAbsoluta('/'));
  });

  it('las URLs llevan la barra final, o sea la forma que contesta 200', () => {
    /*
     * Firebase responde `/cartelera` con un 301 a `/cartelera/` (medido contra
     * producción). Una entrada de sitemap que apunta a una redirección es una URL
     * menos rastreada, y encima distinta de la canónica que la propia página
     * declara — dos URLs para la misma página.
     *
     * MUTACIÓN PROBADA: sacar la barra en `rutaCanonica` pone en rojo este caso y
     * los de `tests/canonico.test.ts`.
     */
    const locs = [...XML.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    expect(locs.every((u) => u.endsWith('/'))).toBe(true);
    expect(locs).toContain(`${SITIO}${rutaCanonica(rutaDeDetalle('taller'))}`);
  });

  it('no lleva `lastmod`, y es una decisión (B-112)', () => {
    /*
     * `lastmod` sale de `updatedAt`, que no está en la proyección pública. La
     * alternativa disponible era la fecha del build en las 40 entradas, y eso le
     * enseña a Google que nuestras fechas mienten. Cuando exista B-112 se agrega.
     *
     * El caso está para que agregarlo sea una decisión: quien ponga un `lastmod`
     * con `new Date()` se encuentra este test en rojo y el motivo escrito.
     */
    expect(XML).not.toContain('lastmod');
    expect(XML).not.toContain('changefreq');
    expect(XML).not.toContain('priority');
  });

  it('escapa lo que rompería el XML', () => {
    /*
     * Hoy no puede hacer falta —`slugify` deja `[a-z0-9-]`— y va igual, por lo
     * mismo que `esTonoElegible` valida lo que viene de Firestore: un documento
     * editado a mano en la consola puede tener un slug con un `&`, y un `&` sin
     * escapar **rompe el sitemap entero**, no una línea. Google descarta el
     * archivo completo y eso no se ve mirando el sitio.
     */
    const xml = xmlDelSitemap([rutaDeDetalle('taller-&-cronica')]);
    expect(xml).toContain('taller-&amp;-cronica');
    expect(xml).not.toMatch(/<loc>[^<]*&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it('sin duplicados', () => {
    // Las dos listas vienen de dos queries distintas, así que la garantía se
    // afirma en vez de suponerse.
    const conRepetida = rutasDelSitemap({
      entradas: [suelta('taller', '2026-09-20T22:00:00Z')],
      canceladas: [{ slug: 'taller', editadaEn: haceDias(1) }],
      ahora: AHORA,
    });
    expect(conRepetida.length).toBe(new Set(conRepetida).size);
  });
});

describe('robots.txt', () => {
  const TEXTO = textoDeRobots();

  it('bloquea el panel', () => {
    expect(TEXTO).toContain('User-agent: *');
    expect(TEXTO).toContain(`Disallow: ${RUTA_BLOQUEADA}`);
    expect(RUTA_BLOQUEADA).toBe('/admin');
  });

  it('anuncia el sitemap con la URL absoluta derivada de SITIO', () => {
    /*
     * Es la única línea del archivo que lleva el dominio, y es la razón por la que
     * el `robots.txt` es un endpoint y no un archivo en `public/`: un estático
     * sería la segunda copia del dominio, y la que quede vieja apunta el sitemap a
     * un host que no responde sin que nada falle de este lado.
     */
    expect(TEXTO).toContain(`Sitemap: ${urlAbsoluta('/sitemap.xml')}`);
    expect(TEXTO).toContain(`Sitemap: ${SITIO}/sitemap.xml`);
  });

  it('no bloquea los endpoints de datos ni los assets', () => {
    /*
     * Bloquear `/events.json` no esconde nada —es público y se sirve igual, y es
     * la base de la búsqueda del §2.5— y bloquear `/_astro/` impediría que Google
     * renderice las páginas, que sí cuesta algo real.
     */
    expect(TEXTO).not.toContain('/events.json');
    expect(TEXTO).not.toContain('/version.json');
    expect(TEXTO).not.toContain('/_astro');
  });

  it('el panel conserva su `noindex`: el Disallow no lo reemplaza', () => {
    /*
     * **Son dos mitades distintas y hay que tener las dos.** Un `Disallow` impide
     * el rastreo, y por eso mismo impide **leer** el `noindex`: Google puede
     * listar una URL bloqueada si alguien la enlaza («indexada aunque bloqueada»),
     * porque nunca llegó a la etiqueta que le pedía no hacerlo. El `noindex` es
     * lo que cubre ese caso.
     *
     * MUTACIÓN PROBADA: sacarle el `noIndex` a `admin.astro` «porque ya está en
     * el robots.txt» pone este caso en rojo. Se mira **el atributo del `<Base>`**
     * y no el archivo entero: su comentario nombra el `noIndex` para explicarlo,
     * así que un `toContain` crudo pasaba con la etiqueta ya borrada — lo
     * encontró el barrido de mutaciones de B-109.
     */
    expect(fuente('src/pages/admin.astro')).toMatch(/<Base[^>]*\bnoIndex\b/s);
  });
});

describe('el endpoint solo serializa', () => {
  const ENDPOINT = fuente('src/pages/sitemap.xml.ts');

  it('no lee Firestore ni arma las reglas: pide la lista al lector', () => {
    /*
     * La misma frontera que el resto del sitio (D-140): el endpoint recibe una
     * lista de rutas y nada más, así que no puede publicar un campo aunque
     * quiera. Y **no** importa `firebase-admin` (§5.4).
     */
    expect(ENDPOINT).toContain('sitemapDelSitio');
    expect(ENDPOINT).toContain('xmlDelSitemap');
    expect(ENDPOINT).not.toContain('firebase-admin');
    expect(ENDPOINT).not.toContain('adminDb');
    expect(ENDPOINT).toContain('export const prerender = true;');
  });

  it('no se usa `@astrojs/sitemap`', () => {
    /*
     * Las reglas de qué entra son propias (§5.6) y el integrador armaría el
     * sitemap de lo que hay en `dist/` — donde están, a propósito, todas las
     * páginas que **no** tienen que entrar: la actividad de hace dos años, el mes
     * vencido, la cancelada de marzo.
     */
    expect(fuente('package.json')).not.toContain('@astrojs/sitemap');
    // En la config se busca el paquete y no la palabra: su comentario del `site`
    // nombra el sitemap justamente para explicar de dónde sale el dominio.
    expect(fuente('astro.config.mjs')).not.toContain('@astrojs/sitemap');
  });
});
