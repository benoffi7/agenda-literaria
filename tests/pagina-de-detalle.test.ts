/**
 * Las plantillas del sitio público, verificadas sobre su **fuente** — B-227.
 *
 * ── Por qué se lee el archivo y no se lo importa ──────────────────────────
 * Un `.astro` no se puede importar desde vitest: no hay forma de renderizarlo
 * acá. La respuesta de este cambio no fue dejarlo sin cobertura, fue partirlo en
 * dos (**D-140**):
 *
 * | Mitad | Quién la cubre |
 * |---|---|
 * | **qué se decide publicar** | `lib/detallePublico.ts`, y lo barre `barrido-de-salidas-publicas.test.ts` |
 * | **que la plantilla no reciba nada más** | este archivo |
 *
 * Sin la segunda mitad, el barrido no afirma nada útil: alguien podría pasarle
 * la `ActividadPublica` a la página «para tener todo a mano» y el barrido del
 * view-model seguiría verde mientras el HTML publica el link de la reunión.
 *
 * Es el mismo patrón que ya usan `tests/autoguardado.test.ts` y
 * `tests/bundle-panel.test.ts`: lo que se afirma es una propiedad del grafo de
 * imports y de lo que el archivo nombra, y eso solo se ve leyéndolo.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PREFIJO_ACTIVIDAD, rutaDeDetalle } from '@/lib/rutasPublicas';

const DETALLE = 'src/pages/actividad/[slug].astro';
const HOME = 'src/pages/index.astro';

const fuente = (rel: string): string => readFileSync(rel, 'utf8');

/**
 * El archivo **sin comentarios**, que es lo que hay que mirar para preguntar
 * «¿nombra este campo?».
 *
 * Los docblocks de estas plantillas explican justamente por qué NO se publica
 * `difusion` ni `online.url`, así que un barrido sobre el texto crudo falla
 * contra su propia documentación — y la salida fácil sería dejar de explicarlo.
 * Es el mismo recorte que hace `tests/autoguardado.test.ts`.
 */
const sinComentarios = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** El frontmatter del `.astro`: lo que va entre los dos `---`. */
const frontmatter = (src: string): string => {
  const m = /^---\n([\s\S]*?)\n---/.exec(src);
  expect(m, 'no se encontró el frontmatter').not.toBeNull();
  return m![1]!;
};

describe('la página de detalle recibe el view-model y nada más (D-140)', () => {
  const src = fuente(DETALLE);
  const cabecera = frontmatter(src);

  it('control positivo: el archivo existe y tiene frontmatter', () => {
    // Sin esto, un error de path haría que todos los `not.toContain` de abajo
    // pasen sobre una cadena vacía.
    expect(src.length).toBeGreaterThan(500);
    expect(cabecera).toContain('getStaticPaths');
  });

  it('las props son solo `detalle`', () => {
    /*
     * La frontera de privacidad es un **tipo**. Si mañana aparece una segunda
     * prop —la actividad, el índice, las opciones crudas— esto falla y hay que
     * venir a decidirlo, que es lo que se quiere: la decisión no puede tomarla
     * un `props:` agregado con apuro.
     */
    const props = /interface Props \{\n([\s\S]*?)\n\}/.exec(cabecera);
    expect(props, 'la plantilla tiene que declarar su `interface Props`').not.toBeNull();
    const campos = [...props![1]!.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
    expect(campos).toEqual(['detalle']);
  });

  it('`getStaticPaths` delega en el módulo testeable, no arma los caminos acá', () => {
    // Es lo que hace que la query del §5.3 quede cubierta por un test de
    // integración: un `getStaticPaths` escrito en la plantilla es código sin
    // ninguna forma de probarse.
    expect(cabecera).toContain('caminosDeDetalle');
    expect(cabecera).toContain('export const getStaticPaths');
  });

  it('y la llama ENVUELTA, no aliasada — B-237', () => {
    /*
     * `export const getStaticPaths = caminosDeDetalle;` es lo que uno escribe, y
     * rompe el build entero: **Astro llama a `getStaticPaths` con un argumento
     * propio** (`{ paginate, rss }`), que caía en el primer parámetro de la
     * función y pisaba el reloj — `ahora.getTime is not a function`, y ninguna
     * página de detalle se genera.
     *
     * No lo vio ningún test unitario, porque todos la llaman bien. Lo encontró
     * `scripts/build-contra-emulador.mjs`, o sea el build de verdad — el §
     * "Verificar contra el sistema real" de `05-patrones.md` haciendo exactamente
     * lo que promete. Ésta es la alarma barata para que no vuelva; la red
     * profunda es que `caminosDeDetalle` ignora un `ahora` que no sea `Date`.
     */
    expect(cabecera).not.toMatch(/getStaticPaths\s*=\s*caminosDeDetalle\s*;/);
    expect(cabecera).toMatch(/getStaticPaths\s*=\s*\(\)\s*=>\s*caminosDeDetalle\(\)/);
  });

  const codigo = sinComentarios(src);

  it('del lector importa SOLO `caminosDeDetalle` (D-140)', () => {
    /*
     * Lo pidió el `auditor-privacidad`, y es más fuerte que la lista negra de
     * abajo: el camino que quedaba abierto era **más corto que cualquiera de los
     * cuatro nombres prohibidos**, porque la plantilla ya importa de
     * `@/lib/contenidoDelSitio`. Agregar
     *
     *     const { actividades } = await contenidoDelSitio();
     *
     * compila, no nombra nada prohibido, y le pone en la mano el array completo
     * de `ActividadPublica` —con `online.url` cuando el flag está en true— de
     * **todas** las publicadas. Es exactamente el atajo que uno escribe para
     * «mostrar otras tres actividades del mismo barrio al pie».
     *
     * Afirmar el import en vez de enumerar prohibidos invierte la carga: lo que
     * no está en la lista blanca no entra, y agregar algo obliga a venir acá.
     */
    const imp = /import \{([^}]*)\} from '@\/lib\/contenidoDelSitio'/.exec(cabecera);
    expect(imp, 'la plantilla tiene que importar del lector con llaves').not.toBeNull();
    expect(imp![1]!.split(',').map((s) => s.trim()).filter(Boolean)).toEqual(['caminosDeDetalle']);
  });

  it('no ve el documento ni la proyección completa', () => {
    /*
     * La lista es corta a propósito y son los cuatro caminos por los que la
     * plantilla podría volver a tener la actividad entera en la mano.
     */
    for (const prohibido of ['firebase-admin', 'adminDb', 'toPublic', 'ActividadPublica']) {
      expect(codigo, `la plantilla no puede nombrar ${prohibido}`).not.toContain(prohibido);
    }
  });

  it('no nombra ninguno de los campos que el §5.1 mantiene privados', () => {
    /*
     * Barrido por **nombre de campo**, que es lo que el de centinelas no puede
     * ver: aquél corre sobre el valor de `detalleDeActividad`, y una plantilla
     * que interpolara `detalle.algo.url` con un dato que hoy no existe no
     * aparecería ahí hasta que el campo existiera. Acá se prohíbe el nombre.
     */
    for (const prohibido of [
      'difusion',
      'createdBy',
      'updatedBy',
      'storagePath',
      'calendarEventId',
      'searchText',
      'urlPublica',
    ]) {
      expect(codigo, `la plantilla no puede nombrar ${prohibido}`).not.toContain(prohibido);
    }
  });

  it('la plataforma se muestra, el link de la reunión no (D-139)', () => {
    // Control en las dos direcciones: que `plataforma` esté es lo que evita que
    // el `not.toContain` de arriba pase porque el bloque «Cómo se cursa» no
    // existe.
    expect(codigo).toContain('m.plataforma');
    expect(codigo).not.toContain('.online.url');
  });

  it('no lleva JavaScript: cero islands (§4.3, presupuesto de 0 KB)', () => {
    /*
     * Es la pantalla que recibe el tráfico y la que se abre en el navegador
     * embebido de Instagram. Una directiva `client:` acá no rompe nada visible
     * —por eso hace falta el test— pero convierte una página de 0 KB de JS en una
     * que baja React.
     */
    expect(src).not.toMatch(/client:(load|idle|visible|only|media)/);
  });

  it('es estática (`prerender`), no una ruta servida', () => {
    expect(cabecera).toContain('export const prerender = true;');
  });

  it('emite el JSON-LD como `application/ld+json`', () => {
    expect(src).toContain('application/ld+json');
    expect(src).toContain('datosEstructurados');
  });

  it('no inventa una URL absoluta mientras el dominio no esté decidido (B-109)', () => {
    /*
     * `canonical` y Open Graph necesitan `site` en `astro.config.mjs`, que
     * necesita el dominio. Una canónica equivocada le dice a Google que la página
     * buena es otra, que es peor que no tener canónica.
     */
    expect(src).not.toContain('rel="canonical"');
    expect(src).not.toContain('og:');
    expect(src).not.toContain('https://agenda-literaria');
  });
});

describe('la home', () => {
  const src = fuente(HOME);

  it('control positivo: existe y monta el buscador', () => {
    expect(src).toContain('<Buscador');
  });

  it('el destino de «Saltar al listado» sobrevive a que la island tome el control', () => {
    /*
     * La island **saca del DOM** la lista del build (`idListadoEstatico`) y monta
     * la suya adentro de su propio árbol. Si el `id="listado"` estuviera solo en
     * el contenedor de la lista del build, después de hidratar el link de salto
     * apuntaría a un div vacío: un link de accesibilidad roto en la página que más
     * se usa, invisible en el HTML del build —que es lo único que se mira— y que
     * ningún test de markup estático vería.
     *
     * Por eso el `id="listado"` envuelve al buscador **y** a la lista: se afirma
     * que el `<Buscador` está adentro de ese contenedor.
     */
    const anclaje = src.indexOf('id="listado"');
    const buscador = src.indexOf('<Buscador');
    const listaDelBuild = src.indexOf('id={ID_LISTADO}');
    expect(anclaje, 'la home tiene que tener el ancla #listado').toBeGreaterThan(-1);
    expect(buscador, 'el buscador va DENTRO de #listado').toBeGreaterThan(anclaje);
    expect(listaDelBuild, 'la lista del build también').toBeGreaterThan(anclaje);
    expect(src).toContain('href="#listado"');
  });

  it('imprime el listado completo en el HTML, para el buscador y para sin-JS (§6.3)', () => {
    /*
     * «El HTML es la verdad; `events.json` es el índice». Si el listado lo
     * renderizara solo la island, la home sería una página vacía para Google y
     * para quien tiene JavaScript apagado — y el §2.3 pide SEO real.
     *
     * `ListaDeActividades` va **sin** directiva de cliente: Astro la renderiza a
     * HTML y no manda un byte por ella.
     */
    expect(src).toContain('<ListaDeActividades');
    expect(src).not.toMatch(/<ListaDeActividades[^>]*client:/);
  });

  it('la única island es el buscador, y es `client:load`', () => {
    const islands = [...src.matchAll(/<(\w+)[^>]*client:(\w+)/g)].map((m) => [m[1], m[2]]);
    expect(islands).toEqual([['Buscador', 'load']]);
  });

  it('tampoco ve el documento crudo', () => {
    const codigo = sinComentarios(src);
    for (const prohibido of ['firebase-admin', 'adminDb', 'toPublic', 'difusion', 'createdBy']) {
      expect(codigo, `la home no puede nombrar ${prohibido}`).not.toContain(prohibido);
    }
  });

  it('el reloj del HTML es el `generadoEn` del índice, no `new Date()`', () => {
    /*
     * Si el build usara su propio reloj, el HTML y el `events.json` que lo
     * acompaña hablarían de momentos distintos y una actividad que termina justo
     * en el medio saldría en uno y no en el otro.
     */
    expect(src).toContain('new Date(indice.generadoEn)');
  });
});

/**
 * La ruta de una actividad se escribe **en un solo lugar** — clase de B-88.
 *
 * Lo señaló el `auditor-privacidad`: el path se deriva hoy en dos lados y el
 * tercero ya está escrito en un comentario de `textoRedes.ts`, esperando a que el
 * sitio exista. El día que las páginas se muevan a `/taller/{slug}`, el listado
 * linkea a 404 y el posteo publica una URL rota en Instagram — de donde no se
 * vuelve. Se ata ahora, que es cuando todavía es gratis.
 */
describe('la ruta de la página de detalle no se deriva dos veces (B-88)', () => {
  it('el prefijo del helper es el directorio real de la página', () => {
    /*
     * El productor de la ruta no es una función: es **dónde está el archivo**,
     * porque Astro deriva el path del nombre. Así que la punta que hay que atar es
     * ésa. Mover la página sin tocar `rutasPublicas.ts` pone esto en rojo.
     */
    expect(existsSync(`src/pages${PREFIJO_ACTIVIDAD}/[slug].astro`)).toBe(true);
    expect(rutaDeDetalle('taller-de-cronica')).toBe('/actividad/taller-de-cronica');
  });

  it('nadie más arma el path a mano', () => {
    // Control de que el helper no quedó de adorno con la copia vieja al lado.
    const conElPathAMano: string[] = [];
    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(dir)) {
        const ruta = join(dir, entrada);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.(ts|tsx|astro)$/.test(entrada)) {
          const src = sinComentarios(readFileSync(ruta, 'utf8'));
          if (
            ruta.replace(/\\/g, '/') !== 'src/lib/rutasPublicas.ts' &&
            /['"`]\/actividad\//.test(src)
          ) {
            conElPathAMano.push(ruta);
          }
        }
      }
    };
    recorrer('src');
    expect(
      conElPathAMano,
      'estos arman `/actividad/…` a mano en vez de usar `rutaDeDetalle`',
    ).toEqual([]);
  });
});

describe('la puerta a Firestore del sitio es una sola (§5.3)', () => {
  /**
   * `tests/build-credenciales.test.ts` ya exige que nadie hable con el Admin SDK
   * salvo `lib/firebase-admin.ts`. Esto es el escalón de arriba, y es el que
   * protege el `where`: **nadie lee Firestore salvo `contenidoDelSitio.ts`**.
   *
   * El modo de falla que cierra: una página nueva que llame a `adminDb()` por su
   * cuenta —para armar un hub, un sitemap, lo que sea— y se olvide del
   * `where('estado','==','publicado')`. Ahí se publican los borradores en HTML
   * indexado, con el `events.json` impecable al lado y toda la suite en verde.
   */
  const LECTOR = 'src/lib/contenidoDelSitio.ts';

  it('solo el lector importa `@/lib/firebase-admin`', () => {
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(dir)) {
        const ruta = join(dir, entrada);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.(ts|tsx|astro)$/.test(entrada)) archivos.push(ruta);
      }
    };
    recorrer('src');
    expect(archivos.length).toBeGreaterThan(20);

    const colados = archivos.filter(
      (a) =>
        !['src/lib/firebase-admin.ts', LECTOR].includes(a.replace(/\\/g, '/')) &&
        /from\s+'@\/lib\/firebase-admin'/.test(readFileSync(a, 'utf8')),
    );
    expect(
      colados,
      'estos archivos leen Firestore sin pasar por contenidoDelSitio.ts, así que pueden ' +
        'olvidarse del where del §5.3 y publicar borradores',
    ).toEqual([]);
  });

  it('y el lector lleva el where, con el estado correcto', () => {
    // Control positivo del de arriba: si la cláusula se borrara, el chequeo de
    // «una sola puerta» seguiría verde sobre una puerta que deja pasar todo. El
    // comportamiento lo verifica `sitio-publico.integracion.test.ts` contra el
    // emulador; esto es la alarma barata que corre siempre.
    const src = fuente(LECTOR);
    expect(src).toContain(".where('estado', '==', ESTADO_PUBLICO)");
    expect(src).toContain("const ESTADO_PUBLICO = 'publicado'");
  });
});
