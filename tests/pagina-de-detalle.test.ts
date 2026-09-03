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

  it('las props son solo `detalle` y `urlMiniaturaPortada`', () => {
    /*
     * La frontera de privacidad es un **tipo**. Si mañana aparece una tercera
     * prop —la actividad, el índice, las opciones crudas— esto falla y hay que
     * venir a decidirlo, que es lo que se quiere: la decisión no puede tomarla
     * un `props:` agregado con apuro.
     *
     * `urlMiniaturaPortada` entró con D-210 (B-320/B-321) y es un
     * `string | null` **a propósito**. La primera versión pasaba el `Set` de
     * miniaturas confirmadas y dejaba el `.has()` en la plantilla; lo cambió el
     * `auditor-privacidad` por dos motivos que se refuerzan: ese set es la
     * enumeración del prefijo `miniaturas/` **entero** —borradores incluidos—,
     * que es justo lo que la trampa 13 existe para no entregar, y un `Set` es
     * **invisible** para los dos barridos que custodian estas props, porque los
     * dos serializan con `JSON.stringify` y `JSON.stringify(new Set([...]))` es
     * `{}`. Una prop que ninguna red puede mirar es peor que una prop de más.
     *
     * O sea que la regla que este `it` sostiene no es «cuántas props hay» sino
     * **de qué tipo pueden ser**: algo que el barrido pueda serializar.
     */
    const props = /interface Props \{\n([\s\S]*?)\n\}/.exec(cabecera);
    expect(props, 'la plantilla tiene que declarar su `interface Props`').not.toBeNull();
    const campos = [...props![1]!.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
    expect(campos).toEqual(['detalle', 'urlMiniaturaPortada']);

    expect(
      props![1]!,
      'una prop que `JSON.stringify` no puede ver es una prop que el barrido de ' +
        'salidas públicas no audita (D-210): nada de `Set`, `Map` ni funciones',
    ).not.toMatch(/:\s*(Readonly)?(Set|Map)\s*</);
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

  it('cero islands de framework (§4.3) — el presupuesto de 0 KB era del §6 antes de B-371', () => {
    /*
     * Es la pantalla que recibe el tráfico y la que se abre en el navegador
     * embebido de Instagram. Una directiva `client:` acá no rompe nada visible
     * —por eso hace falta el test— pero bajaría React entero.
     *
     * **El título decía «presupuesto de 0 KB» y ya no es cierto en bytes
     * totales**: B-371 aceptó el costo de GA4 (`docs/16-analitica-del-sitio.md`
     * §6) y B-375 agregó un `<script>` de un puñado de líneas para medir el
     * clic de inscripción — ver `tests/detalle-visual.test.ts`, que cuenta los
     * `<script>` de esta página y por qué ahora son dos. Lo que este `it` sigue
     * garantizando, y es lo único que garantizaba antes, es la mitad que
     * **no** cambió: **cero islands**. Ni React ni ningún framework se
     * hidratan acá.
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

  it('la canónica y el Open Graph los pone el layout, y esta página no escribe ninguna URL (B-109)', () => {
    /*
     * **Este caso estaba escrito al revés y era correcto que lo estuviera.**
     * Hasta B-109 exigía la *ausencia* de `rel="canonical"`, de `og:` y de
     * cualquier `https://agenda-literaria…`, porque las tres necesitaban `site`
     * en `astro.config.mjs` y `site` necesitaba el dominio: una canónica a un
     * dominio equivocado le dice a Google que la página buena es otra, que es
     * peor que no tener canónica.
     *
     * **La condición se cumplió** (el dominio existe, D-165), así que se da
     * vuelta: la canónica y el Open Graph tienen que estar, y **no acá**. Los
     * pone `Base.astro` una sola vez para todas las páginas, así que lo que se
     * afirma de esta plantilla es que sigue sin escribir el dominio — ni el
     * bueno ni el del espejo.
     *
     * MUTACIÓN PROBADA: pegar un `<link rel="canonical" href="https://agendaleh.ar/…">`
     * en esta plantilla pone este caso en rojo, aunque el HTML resultante se vea
     * bien: dos canónicas en la misma página es una canónica indefinida.
     */
    // Sobre el código y no sobre el archivo crudo: los comentarios de esta
     // plantilla nombran `og:image` justamente para explicar de dónde sale, y un
     // barrido sobre el texto crudo fallaría contra su propia documentación —
     // el mismo recorte que el resto de este archivo.
    const codigo = sinComentarios(src);
    expect(codigo).not.toContain('rel="canonical"');
    expect(codigo).not.toContain('og:');
    expect(codigo).not.toContain('https://agenda-literaria');
    expect(codigo).not.toContain('agendaleh');
    // Y la mitad positiva: la portada viaja al layout como `og:image`, que es lo
    // que hace que el link pegado en Instagram se vea con el flyer.
    expect(codigo).toMatch(/imagen=\{portada\?\.url/);
  });

  it('el enlace al mes sale de `detalle.mes` y no de la fecha — B-280', () => {
    /*
     * **La mitad de B-280 que vive en la plantilla, y el único lugar donde este
     * ítem puede producir un 404.**
     *
     * La página de mes existe solo para los meses vigentes con 3 o más
     * actividades (§2.2). La plantilla tiene `detalle.proxima.iso` en la mano, así
     * que el atajo —`rutaDeMes(detalle.proxima.iso.slice(0, 7))`— compila, se lee
     * bien y arma una URL válida; lo que no puede saber es si esa página se
     * generó, porque eso depende de **las otras** actividades del mes. El
     * view-model ya trae la respuesta en `detalle.mes`, que viene `null` cuando no
     * hay nada que enlazar.
     *
     * MUTACIÓN PROBADA: reemplazar `detalle.mes` por un recorte de
     * `detalle.proxima.iso` pone este caso en rojo, y el HTML se ve idéntico
     * mientras el mes tenga tres actividades — que es lo que hace que este bug
     * aparezca recién en el build de un mes flojo.
     */
    expect(codigo).toContain('detalle.mes');
    expect(codigo).toMatch(/rutaDeMes\(detalle\.mes\.clave\)/);
    // El atajo prohibido: la plantilla no puede armar una clave de mes por su
    // cuenta, ni de `proxima.iso` ni de ninguna otra fecha.
    expect(codigo).not.toMatch(/proxima[^\n]*slice/);
    expect(codigo).not.toContain('claveDeMes');
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

  it('del lector importa SOLO el índice y los tonos — lista blanca, como el detalle', () => {
    /*
     * La home tenía **solo** la lista negra de acá abajo, y no ataja el atajo más
     * corto: `const { actividades, opciones } = await contenidoDelSitio()` compila,
     * no nombra ningún prohibido, y entrega el array de `ActividadPublica` —con
     * `online.url` cuando el flag está en true— más las opciones **crudas**, con
     * `huellaCreador`, `usos` y `aprobada`. Es el mismo agujero que el detalle cerró
     * con lista blanca en B-227, y del que la home se salvaba por tener un solo
     * símbolo importado.
     *
     * Desde B-273 son dos (`tonosDelSitio`), que es cuando la lista blanca deja de
     * ser gratis y empieza a servir. Lo pidió el `auditor-privacidad`.
     *
     * **Y desde B-108 son tres**: `exploracionDeLaHome`, la tira «Explorá por». La
     * lista blanca hizo exactamente lo que tenía que hacer —el símbolo nuevo puso
     * este caso en rojo y obligó a venir a decidirlo— así que conviene dejar dicho
     * qué entrega: `GrupoDeExploracion[]`, o sea pares de ruta y texto ya armados,
     * sin una sola entrada de índice adentro. No es una puerta al documento.
     *
     * MUTACIÓN PROBADA: agregar `contenidoDelSitio` al import hace fallar este caso;
     * la lista negra de abajo lo deja pasar.
     */
    const imp = /import \{([^}]*)\} from '@\/lib\/contenidoDelSitio'/.exec(src);
    expect(imp, 'la home tiene que importar del lector con llaves').not.toBeNull();
    expect(
      imp![1]!
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .sort(),
    ).toEqual(['exploracionDeLaHome', 'indiceDelSitio', 'tonosDelSitio']);
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
    // Con barra final desde B-330: es la forma que Firebase contesta con un 200
    // (B-293), y el directorio de la página es el mismo.
    expect(rutaDeDetalle('taller-de-cronica')).toBe('/actividad/taller-de-cronica/');
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

  it('las canceladas entran por su propia query, no ampliando la de las publicadas', () => {
    /*
     * B-110. Leer los dos estados con un `where('estado','in',[…])` convertiría el
     * escalar en una **lista**, y a una lista alguien le agrega un elemento — que
     * es cómo un borrador termina con página. Con dos `==` no hay lista que
     * crecer, y lo peor que puede hacer un error en la query nueva es no generar
     * ninguna página de cancelada.
     *
     * Es una propiedad de la **forma** del código y no de su comportamiento: un
     * `in` con los dos estados correctos pasaría todos los tests de integración.
     * Por eso se afirma acá y no allá.
     */
    const src = fuente(LECTOR);
    expect(src).toContain(".where('estado', '==', ESTADO_CANCELADO)");
    expect(src).toContain("const ESTADO_CANCELADO = 'cancelado'");
    expect(src, 'el `in` es lo que este chequeo existe para impedir').not.toContain("'estado', 'in'");
  });

  it('la lectura del historial pregunta existencia y no trae contenido (§12)', () => {
    /*
     * **Lo pidió el `auditor-privacidad`.** `estuvoPublicada` consulta
     * `/actividades/{id}/versiones`, y una versión es el documento **entero** de
     * aquel momento: `difusion`, `online.url`, uids, `storagePath`. Hoy no entra
     * nada de eso al build porque la query pide **existencia** —`.limit(1)` y un
     * `.select()` sin argumentos, que devuelve documentos sin ningún campo— y el
     * valor de retorno es un booleano.
     *
     * El modo de falla no es hipotético: el pedido que viene después de B-110 es
     * «poné *cancelada el 19 de agosto* en la franja», y para eso alguien saca el
     * `.select()` o pide `guardadoEn`. Ahí el proceso que genera el HTML pasa a
     * tener el documento entero en la mano, a un `${}` de la página indexada.
     *
     * Es un chequeo de forma sobre el fuente porque el comportamiento no lo
     * distingue: sin el `.select()` la función devuelve exactamente lo mismo.
     *
     * MUTACIÓN PROBADA: borrar el `.select()` deja verde la suite entera —
     * incluidos los nueve `it` de `sitio-publico.integracion.test.ts`— y solo
     * este se pone rojo.
     */
    const src = sinComentarios(fuente(LECTOR));
    expect(src, 'el lector consulta el historial').toContain("collection('versiones')");
    expect(src, 'y lo hace sin pedir ningún campo').toContain('.select()');
    expect(src, 'y de a un documento').toContain('.limit(1)');
  });
});
