import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import {
  BAJADA_DE_PASADAS,
  BUSCAR_EN_PASADAS,
  CARGANDO_PASADAS,
  ERROR_DE_PASADAS,
  PISTA_DE_PASADAS,
  SIN_RESULTADOS_EN_PASADAS,
  TITULO_DE_PASADAS,
  VACIO_DE_PASADAS,
  buscarEnPasadas,
  cuentaDePasadas,
  descripcionDePasadas,
  frasesDePasadas,
  pasadasDelSitio,
} from '@/lib/pasadasPublicas';
import {
  agruparPorMes,
  coincideBusqueda,
  estadoDe,
  filtrarPublico,
  filtrosVacios,
  vigentesDelIndice,
} from '@/lib/listadoPublico';
import { RUTA_PASADAS } from '@/lib/rutasPublicas';
import { RUTAS_FIJAS } from '@/lib/sitemap';
import { construirIndice } from '@/lib/eventsJson';
import { entradaDePrueba } from './fixtures/indice';

/**
 * `/pasadas` — el archivo. B-109, §4.5 del diseño.
 *
 * ── Qué se puede romper acá, que no es que se rompa ───────────────────────
 * Esta página existe **para que ninguna página de detalle quede huérfana**
 * (§2.1), y la forma de romperla es dejar afuera actividades sin que nada lo
 * diga. Tres modos de falla, los tres invisibles:
 *
 * 1. **Una publicada que no está ni en la home ni acá.** Su única entrada
 *    interna era el sitemap, y la entrada del sitemap se acaba a los 90 días
 *    (`lib/sitemap.ts`): a partir de ahí no la enlaza nada. El invariante de la
 *    partición es el aserto principal de este archivo.
 * 2. **El orden al revés.** Un archivo que abre con el taller de hace dos años
 *    se ve igual de bien y no sirve para lo que la cabecera promete («muchas se
 *    repiten: seguí a quien la organiza»).
 * 3. **Una cancelada colándose.** El §7.3 es explícito: no entra a ninguna
 *    lista, `/pasadas` incluida.
 *
 * ── El reloj entra como parámetro ─────────────────────────────────────────
 * Todo contra `AHORA`, así que ningún caso depende de qué día es hoy.
 */
const AHORA = new Date('2026-09-10T15:00:00Z');

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const fuente = (rel: string): string => readFileSync(raiz(rel), 'utf8');

const sinComentarios = (src: string): string =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

const suelta = (slug: string, iso: string) =>
  entradaDePrueba({ id: slug, slug, titulo: slug, fechas: [iso] });

/** Tres pasadas de tres meses distintos y una que todavía no pasó. */
const MAYO = suelta('de-mayo', '2026-05-20T22:00:00Z');
const JULIO = suelta('de-julio', '2026-07-15T22:00:00Z');
const AGOSTO = suelta('de-agosto', '2026-08-28T22:00:00Z');
const FUTURA = suelta('por-venir', '2026-09-24T22:00:00Z');
const TODAS = [JULIO, FUTURA, MAYO, AGOSTO];

describe('qué entra', () => {
  it('lo que pasó entra, lo que viene no', () => {
    const slugs = pasadasDelSitio(TODAS, AHORA).map((e) => e.slug);
    expect(slugs).toContain('de-mayo');
    expect(slugs).not.toContain('por-venir');
  });

  it('«pasó» es la misma definición que usa el resto del sitio', () => {
    /*
     * No se reescribe acá: sale de `estadoDe`, que es lo que decide el filtro
     * «Cuándo» de la home. Con dos definiciones, la home y `/pasadas` podrían
     * mostrar la misma actividad las dos —o ninguna— y las dos páginas se seguirían
     * viendo bien (la clase de B-88).
     */
    for (const e of pasadasDelSitio(TODAS, AHORA)) {
      expect(estadoDe(e, AHORA).paso).toBe(true);
    }
  });

  it('un ciclo con un encuentro por venir NO es una pasada', () => {
    // §7.2 — un ciclo empezado es **vigente**: tiene sesiones futuras. Si cayera
    // acá, el archivo mostraría como terminado algo a lo que todavía se puede ir.
    const enCurso = entradaDePrueba({
      id: 'ciclo',
      slug: 'ciclo',
      esCiclo: true,
      fechas: ['2026-09-03T22:00:00Z', '2026-09-24T22:00:00Z'],
    });
    expect(pasadasDelSitio([enCurso], AHORA)).toEqual([]);
  });

  it('la home y `/pasadas` parten en dos las publicadas, sin huérfanas', () => {
    /*
     * **El aserto principal de este archivo.** Toda actividad publicada tiene que
     * estar en exactamente una de las dos páginas: en las dos sería contradictorio,
     * y en ninguna es una **página huérfana** — sin un solo link interno una vez
     * que su entrada del sitemap venció a los 90 días.
     *
     * MUTACIÓN PROBADA: filtrar por `estado.hasta` en vez de por `estado.paso`
     * —o excluir las de todos los encuentros cancelados «porque no pasaron»— deja
     * actividades en ninguna de las dos y pone este caso en rojo nombrándolas.
     */
    const indice = construirIndice({
      actividades: [],
      opciones: {},
      version: 'test',
      generadoEn: AHORA.toISOString(),
    });
    const conActividades = { ...indice, actividades: TODAS };

    const enLaHome = vigentesDelIndice(conActividades, AHORA).map((e) => e.slug);
    const enPasadas = pasadasDelSitio(TODAS, AHORA).map((e) => e.slug);

    expect([...enLaHome].sort()).not.toEqual([]);
    expect(enLaHome.filter((s) => enPasadas.includes(s))).toEqual([]);
    expect([...enLaHome, ...enPasadas].sort()).toEqual(TODAS.map((e) => e.slug).sort());
  });

  it('una actividad con todos sus encuentros cancelados entra igual — B-254', () => {
    /*
     * No «pasó» en el sentido de que se hizo, pero **no tiene ninguna fecha por
     * venir**, así que la home no la muestra (`cuando=proximas` la excluye). Si
     * tampoco entrara acá, su página no la enlazaría nada — que es la huérfana
     * del caso de arriba. Va al fondo del orden porque no tiene `hasta` con el
     * que ubicarla en un mes.
     */
    const anulada = entradaDePrueba({
      id: 'anulada',
      slug: 'anulada',
      fechas: ['2026-09-24T22:00:00Z'],
      canceladas: [0],
    });
    const salida = pasadasDelSitio([anulada, AGOSTO], AHORA);
    expect(salida.map((e) => e.slug)).toEqual(['de-agosto', 'anulada']);
  });

  it('las canceladas no pueden entrar ni queriendo (§7.3)', () => {
    /*
     * No hay filtro que verificar y eso es la afirmación: este módulo recibe
     * `EntradaDeIndice[]`, o sea el índice, y una cancelada **nunca entra al
     * índice** (B-110, dos queries y dos campos distintos de `ContenidoDelSitio`).
     * La garantía la da el tipo, no una condición que alguien pueda borrar.
     */
    // Sobre el código y no sobre el archivo crudo: los dos docblocks nombran las
    // canceladas justamente para explicar por qué no entran.
    const modulo = sinComentarios(fuente('src/lib/pasadasPublicas.ts'));
    expect(modulo).toContain('EntradaDeIndice');
    expect(modulo).not.toContain('cancelada');
    expect(sinComentarios(fuente('src/pages/pasadas.astro'))).not.toContain('cancelada');
  });
});

describe('el orden: de lo más reciente a lo más antiguo', () => {
  it('abre con lo último que pasó', () => {
    /*
     * MUTACIÓN PROBADA: invertir el `sort` —o dejarlas en el orden del índice—
     * deja la página perfectamente funcional y pone este caso en rojo. Un archivo
     * que abre con el taller de hace dos años no sirve para lo que la cabecera
     * promete: enterarse de lo que hubo hace poco para seguir a quien lo organiza.
     */
    expect(pasadasDelSitio(TODAS, AHORA).map((e) => e.slug)).toEqual([
      'de-agosto',
      'de-julio',
      'de-mayo',
    ]);
  });

  it('los marcadores de mes salen en ese mismo orden', () => {
    /*
     * `agruparPorMes` agrupa **consecutivos** por el mes de `proxima ?? hasta`, y
     * en una pasada `proxima` es siempre `null`. O sea que el orden de arriba es
     * lo único que decide los marcadores: sin él, la página mostraría «AGOSTO»,
     * «MAYO», «JULIO» y hasta un mes repetido dos veces.
     */
    const grupos = agruparPorMes(pasadasDelSitio(TODAS, AHORA), AHORA);
    expect(grupos.map((g) => g.clave)).toEqual(['2026-08', '2026-07', '2026-05']);
    // Y ninguno repetido: dos marcadores del mismo mes son la firma de una lista
    // mal ordenada.
    expect(new Set(grupos.map((g) => g.clave)).size).toBe(grupos.length);
  });
});

describe('lo que la página dice', () => {
  it('el título y la bajada son los del §4.5, y no interpolan datos', () => {
    /*
     * La cabecera del diseño, palabra por palabra: «Lo que ya pasó. Muchas de
     * estas actividades se repiten: si te interesa una, seguí a quien la
     * organiza.» Es lo que convierte «llegué tarde» en algo que se puede hacer.
     */
    expect(TITULO_DE_PASADAS).toBe('Lo que ya pasó');
    expect(BAJADA_DE_PASADAS).toContain('se repiten');
    expect(BAJADA_DE_PASADAS).toContain('seguí a quien la organiza');
    expect(VACIO_DE_PASADAS.trim()).not.toBe('');
  });

  it('las frases salen de una función que recibe las entradas', () => {
    /*
     * Que `frasesDePasadas` **tenga los datos a mano y no los use** es lo que hace
     * verificable el «acá no se interpola nada»: el barrido de centinelas de esta
     * salida corre sobre su salida con la lista de permitidos **vacía**, así que el
     * día que una frase meta un título el barrido lo dice sin tocar ningún test.
     *
     * Con las frases sueltas, esa interpolación se agregaría por un parámetro
     * nuevo y el barrido seguiría llamándolas sin datos: verde y publicando.
     */
    const frases = frasesDePasadas(pasadasDelSitio(TODAS, AHORA));
    expect(frases).toEqual({
      titulo: TITULO_DE_PASADAS,
      bajada: BAJADA_DE_PASADAS,
      descripcion: descripcionDePasadas(3),
      vacio: VACIO_DE_PASADAS,
      // Las cinco del buscador — B-292. Entran acá y no al markup de la island
      // por lo mismo que las otras cuatro: es lo que las mete en el barrido.
      buscar: BUSCAR_EN_PASADAS,
      pista: PISTA_DE_PASADAS,
      sinResultados: SIN_RESULTADOS_EN_PASADAS,
      cargando: CARGANDO_PASADAS,
      error: ERROR_DE_PASADAS,
    });
    // Y la página las pide, no las arma.
    expect(sinComentarios(fuente('src/pages/pasadas.astro'))).toContain(
      'frasesDePasadas(entradas)',
    );
  });

  it('la descripción lleva la cuenta y ningún título de actividad', () => {
    /*
     * A diferencia de `descripcionDelMes`, que mete tres títulos en la
     * `meta description` (y por eso tiene barrido de centinelas), esta frase no
     * interpola **nada** de una actividad: solo cuántas. Es una salida pública
     * menos por donde se puede escapar algo, y está afirmado para que agregar una
     * interpolación sea una decisión.
     */
    expect(descripcionDePasadas(3)).toContain('3 actividades');
    expect(descripcionDePasadas(1)).toContain('1 actividad');
    expect(descripcionDePasadas(0)).not.toContain('0');
    for (const n of [0, 1, 3]) {
      const texto = descripcionDePasadas(n);
      expect(texto).not.toContain('de-mayo');
      expect(texto.length).toBeLessThan(180);
    }
  });
});

describe('el buscador del archivo — B-292', () => {
  /*
   * §4.5: «sin filtros salvo la búsqueda». Lo que este `describe` fija no es que
   * la búsqueda funcione —eso lo prueba `coincideBusqueda` en su propio archivo—
   * sino que sea **la misma** que la del resto del sitio. Dos definiciones de
   * «coincide» es la home y el archivo contestando distinto a la misma consulta,
   * en lo único que la gente usa tipeando: la clase de B-88.
   */
  /*
   * Dos pasadas **sin una palabra en común** salvo las que se buscan a propósito:
   * la descripción del fixture por defecto habla de crónica, así que las dos
   * matchearían «cronica» y el caso no probaría nada.
   */
  const CRONICA = entradaDePrueba({
    id: 'cronica',
    slug: 'cronica',
    titulo: 'Taller de crónica',
    descripcion: 'Ocho encuentros para escribir sobre la ciudad.',
    barrio: 'boedo',
    fechas: ['2026-05-20T22:00:00Z'],
  });
  const POESIA = entradaDePrueba({
    id: 'poesia',
    slug: 'poesia',
    titulo: 'Club de poesía',
    descripcion: 'Leemos un libro por mes y lo charlamos.',
    barrio: 'villa-crespo',
    fechas: ['2026-07-15T22:00:00Z'],
  });
  const PASADAS = pasadasDelSitio([CRONICA, POESIA, FUTURA], AHORA);

  it('control positivo: las dos pasadas están y la futura no', () => {
    // Sin esto, un fixture que dejara de producir pasadas haría pasar todo lo de
    // abajo con la lista vacía.
    expect(PASADAS.map((e) => e.slug)).toEqual(['poesia', 'cronica']);
  });

  it('busca por título y por barrio, sin acentos y exigiendo todas las palabras', () => {
    // Las tres propiedades del §6, verificadas sobre el archivo: son las mismas
    // que la home porque la función que compara es la misma.
    expect(buscarEnPasadas(PASADAS, 'cronica').map((e) => e.slug)).toEqual(['cronica']);
    expect(buscarEnPasadas(PASADAS, 'crónica').map((e) => e.slug)).toEqual(['cronica']);
    expect(buscarEnPasadas(PASADAS, 'boedo').map((e) => e.slug)).toEqual(['cronica']);
    // AND, no OR: la segunda palabra acota.
    expect(buscarEnPasadas(PASADAS, 'cronica boedo').map((e) => e.slug)).toEqual(['cronica']);
    expect(buscarEnPasadas(PASADAS, 'cronica villa')).toEqual([]);
  });

  it('sin texto devuelve todo, y buscar no reordena', () => {
    /*
     * Las dos mitades de «buscar acota, no reordena»: el orden del archivo —de lo
     * más reciente a lo más viejo— lo decide `pasadasDelSitio`, y un resultado
     * ordenado por «relevancia» sería un criterio que nada respalda.
     */
    expect(buscarEnPasadas(PASADAS, '')).toEqual(PASADAS);
    expect(buscarEnPasadas(PASADAS, '   ')).toEqual(PASADAS);
    const dos = buscarEnPasadas(PASADAS, 'de');
    expect(dos.map((e) => e.slug)).toEqual(['poesia', 'cronica']);
  });

  it('es la misma comparación que usa la home — el lazo, no el parecido', () => {
    /*
     * La afirmación que importa: para la **misma** consulta, la home y el archivo
     * dejan pasar exactamente las mismas entradas. Se corre `filtrarPublico` sobre
     * las dos actividades tratadas como vigentes (`cuando` = el mes de cada una,
     * que es lo que la home ofrece para mirar hacia atrás) y se compara contra
     * `buscarEnPasadas`.
     *
     * **Qué mata y qué no**, que es lo que hay que saber de un lazo: cambiar el
     * AND por un OR dentro de `coincideBusqueda` **no** rompe este caso —los dos
     * lados cambian juntos, y eso es exactamente lo que un lazo promete—, rompe
     * el caso de arriba, que sí mira el comportamiento. Lo que este caso mata es
     * la **divergencia**: darle a `buscarEnPasadas` su propio match.
     *
     * MUTACIÓN PROBADA: reemplazar `coincideBusqueda` por un
     * `e.titulo.toLowerCase().includes(q)` en `buscarEnPasadas` —que es
     * exactamente cómo se escribiría el match «obvio» si no existiera el módulo
     * puro— pone en rojo este caso y tres más de este `describe`.
     */
    for (const q of ['cronica', 'crónica', 'boedo', 'cronica boedo', 'club poesia']) {
      const porLaHome = filtrarPublico([CRONICA, POESIA], { ...filtrosVacios(), q, cuando: '2026-05' }, AHORA)
        .concat(
          filtrarPublico([CRONICA, POESIA], { ...filtrosVacios(), q, cuando: '2026-07' }, AHORA),
        )
        .map((e) => e.slug)
        .sort();
      const porElArchivo = buscarEnPasadas(PASADAS, q)
        .map((e) => e.slug)
        .sort();
      expect(porElArchivo, `«${q}» no da lo mismo en la home y en el archivo`).toEqual(porLaHome);
    }
  });

  it('`pasadasPublicas` no tiene su propia normalización', () => {
    /*
     * La guarda de la clase, no del caso: el día que alguien «arregle» la búsqueda
     * del archivo escribiendo el match acá, este caso lo dice. `coincideBusqueda`
     * tiene que venir importado, y `normalize` no puede aparecer en este módulo.
     *
     * Es la misma forma que la guarda de `FORMATO_VERSION` (B-165): se pregunta
     * por la **llamada**, no por el nombre, para que un import no la satisfaga.
     */
    const modulo = sinComentarios(fuente('src/lib/pasadasPublicas.ts'));
    expect(modulo).toContain('coincideBusqueda');
    expect(modulo).toMatch(/filter\(coincideBusqueda\(/);
    expect(modulo, 'el archivo no puede normalizar por su cuenta').not.toContain('normalize');
  });

  it('el contador dice la unidad, y sale del módulo y no del componente', () => {
    /*
     * Va en un `aria-live`, así que es lo que **escucha** quien no ve la lista
     * cambiar: un número pelado no dice de qué. Y vive en `pasadasPublicas.ts` y
     * no armado con un template en la island, que es lo que lo deja adentro del
     * barrido de centinelas de esta salida.
     *
     * MUTACIÓN PROBADA: volver a `${visibles.length} de ${pasadas.length}` en el
     * componente deja este caso en rojo por el segundo aserto.
     */
    expect(cuentaDePasadas(3, 3)).toBe('3 actividades');
    expect(cuentaDePasadas(1, 1)).toBe('1 actividad');
    expect(cuentaDePasadas(1, 3)).toBe('1 de 3 actividades');
    expect(cuentaDePasadas(0, 0)).toBe('0 actividades');

    const island = sinComentarios(fuente('src/components/publico/BuscadorDePasadas.tsx'));
    expect(island).toContain('cuentaDePasadas(visibles.length, pasadas.length)');
    // Y **no** la `meta description` como rótulo: son dos textos con dos trabajos.
    expect(island).not.toContain('frases.descripcion');
  });

  it('la island reusa el componente de la lista y no escribe texto', () => {
    /*
     * Las dos mitades de «no hay una segunda implementación»: el markup de la fila
     * es el mismo `ListaDeActividades` que imprime el build (§6.3), y las frases
     * salen de `frasesDePasadas`, que es lo que las mete en el barrido de
     * centinelas de esta salida.
     */
    const island = sinComentarios(fuente('src/components/publico/BuscadorDePasadas.tsx'));
    expect(island).toContain('ListaDeActividades');
    expect(island).toContain('buscarEnPasadas');
    expect(island).toContain('frasesDePasadas');
    for (const clave of ['buscar', 'pista', 'sinResultados', 'cargando', 'error']) {
      expect(island, `la island no usa frases.${clave}`).toContain(`frases.${clave}`);
    }
  });

  it('y no escribe texto: ningún literal suelto en su markup', () => {
    /*
     * **La otra mitad, y la que atrapa lo que pasó.** El caso de arriba afirma que
     * las cinco frases se **usan**, y eso no impide que se agregue una sexta
     * escrita en el componente — que es exactamente lo que estaba: el contador
     * salía de un template (`${visibles.length} de ${pasadas.length}`) y de la
     * `meta description` usada como rótulo. Lo encontró el `auditor-privacidad`.
     *
     * Un texto escrito acá queda **fuera del barrido de centinelas de la salida
     * 10**, que corre sobre lo que devuelve `pasadasPublicas.ts` con la lista de
     * permitidos vacía. La mutación que hoy pasaría en verde es de un carácter:
     * agregarle `— ${visibles[0]?.titulo}` al contador.
     *
     * Es el mismo caso que `tests/no-encontrado.test.ts` tiene para la salida 13,
     * con la misma forma: nada entre etiquetas que no sea una interpolación. La
     * puntuación suelta sí puede quedar.
     */
    const markup = fuente('src/components/publico/BuscadorDePasadas.tsx')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    /*
     * A diferencia del `.astro`, acá **todo el archivo es código**: no hay
     * frontmatter que sacar, así que un `=>` de una arrow y un `length > 0 ? (`
     * caen en el mismo patrón que un texto entre etiquetas. Se descartan por lo
     * que un texto de UI no tiene: `;`, paréntesis, llaves o un `=`. Es una
     * heurística y se paga con un falso negativo posible —un literal con un
     * paréntesis adentro no se vería—, que es el lado barato del error: lo que
     * este caso tiene que atrapar es la frase que alguien escribe de apuro.
     */
    const esTextoDeUi = (t: string): boolean =>
      /[\p{L}\p{N}]/u.test(t) && !/[;(){}=]/.test(t);

    /*
     * Los espacios se colapsan **antes** de decidir, y no se descarta lo que
     * tenga un salto de línea: una frase larga la parte prettier en dos, y
     * descartarla por eso dejaría pasar justo la que más se nota.
     */
    const sueltos = [...markup.matchAll(/>([^<>{}]+)</g)]
      .map((m) => m[1]!.replace(/\s+/g, ' ').trim())
      .filter(esTextoDeUi);

    expect(
      sueltos,
      'estos textos están escritos en la island y no en `pasadasPublicas.ts`, así ' +
        'que el barrido de centinelas de la salida 10 no los mira.',
    ).toEqual([]);

    /*
     * Y la otra forma de escribir una frase acá: un template con los datos
     * adentro, que es literalmente lo que había. Se prohíben los que interpolan
     * **los datos** (`visibles`, `pasadas`, `q`) y no todos los templates: los
     * que quedan arman un `id` y una lista de clases, que no son texto.
     */
    expect(
      markup.match(/`[^`]*\$\{\s*(?:visibles|pasadas|q)\b/g) ?? [],
      'la island arma texto con los datos adentro: eso va a `pasadasPublicas.ts`, ' +
        'como `cuentaDePasadas`, que es lo que lo mete en el barrido.',
    ).toEqual([]);

    /*
     * **Y el texto que no va entre etiquetas**: el de un atributo. `placeholder`,
     * `aria-label`, `title` y `alt` son texto que la persona lee o escucha, y un
     * literal ahí queda igual de afuera del barrido que uno entre etiquetas —
     * con el agravante de que el barrido de arriba, que mira `>…<`, no lo ve.
     * Tienen que salir de una expresión.
     */
    const ATRIBUTOS_DE_TEXTO = ['placeholder', 'aria-label', 'title', 'alt'];
    for (const attr of ATRIBUTOS_DE_TEXTO) {
      const literales = markup.match(new RegExp(`${attr}="[^"]*[\\p{L}][^"]*"`, 'gu')) ?? [];
      expect(
        literales,
        `\`${attr}\` con un literal: ese texto tampoco lo mira el barrido de la salida 10.`,
      ).toEqual([]);
    }
  });

  it('el fetch falla y la lista del build se queda: nunca una pantalla vacía', () => {
    /*
     * La propiedad que esta página no puede perder (§2.1): su razón de ser es que
     * cada actividad que pasó conserve un link interno. La island **solo** saca la
     * lista del build adentro del `then` del fetch, así que un fetch que falla la
     * deja intacta — se pierde el buscador, no el archivo.
     *
     * MUTACIÓN PROBADA: mover el `.remove()` afuera del `then` (por ejemplo a un
     * efecto de montaje) deja este caso en rojo.
     */
    const island = fuente('src/components/publico/BuscadorDePasadas.tsx');
    const desdeElThen = island.slice(island.indexOf('.then((indice)'));
    const hastaElCatch = desdeElThen.slice(0, desdeElThen.indexOf('.catch('));
    expect(hastaElCatch).toContain('.remove()');
    // Y en ningún otro lado.
    expect(island.match(/\.remove\(\)/g)).toHaveLength(1);
  });
});

describe('la página', () => {
  const PAGINA = 'src/pages/pasadas.astro';
  const src = () => sinComentarios(fuente(PAGINA));

  it('control positivo: la página existe y está versionada', () => {
    expect(
      execFileSync('git', ['ls-files', 'src/pages'], { encoding: 'utf8' }),
    ).toContain(PAGINA);
    expect(src().length).toBeGreaterThan(200);
  });

  it('declara la sección «agenda»: es el archivo de la agenda, no una sección nueva', () => {
    // `chrome-del-sitio.test.ts` exige que **haya** sección; cuál es lo sabe esta
    // página. Es la misma decisión que la página de mes y la de detalle.
    expect(src()).toMatch(/<Base[^>]*\bseccion="agenda"/s);
  });

  it('es estática, y su única island es el buscador del archivo — B-292', () => {
    /*
     * ~~Cero JavaScript~~: hasta B-292 la página no montaba nada, porque la única
     * búsqueda del sitio era la de la home y filtra lo **vigente**. Hoy monta
     * `BuscadorDePasadas`, que es una island propia y chica — no la de la home
     * (ver el `describe` de arriba y D-381).
     *
     * Lo que **no** cambió, y es lo que este caso protege: la página sigue siendo
     * `prerender`, o sea que el archivo completo sale del build en HTML. Es la
     * mitad que le da sentido (§2.1): las páginas de detalle que ya pasaron
     * necesitan un link interno que un buscador exista o no.
     */
    expect(src()).toContain('export const prerender = true;');
    const islands = [...src().matchAll(/<(\w+)[^>]*client:(\w+)/g)].map((m) => [m[1], m[2]]);
    expect(islands).toEqual([['BuscadorDePasadas', 'load']]);
  });

  it('la lista del build tiene id y la island lo recibe — si no, las filas van dos veces', () => {
    /*
     * El cableado del patrón de la home: la island saca del DOM la lista del build
     * por su `id`. Escrito en dos lados como literal, un renombre de un solo lado
     * deja **las filas duplicadas** en la página — se ve, pero recién con el
     * JavaScript cargado, que es lo que nadie mira en el HTML del build.
     */
    const codigo = src();
    expect(codigo).toMatch(/const ID_LISTADO = '[^']+'/);
    expect(codigo).toMatch(/<div id=\{ID_LISTADO\}/);
    expect(codigo).toMatch(/idListadoEstatico=\{ID_LISTADO\}/);
  });

  it('la versión del `?v=` es la misma que estampa el `events.json`', () => {
    /*
     * La página no puede leer el índice (D-140, ver el caso de abajo), así que la
     * versión sale de `INFO_VERSION`. Es el **mismo** valor que el lector le pone
     * al archivo —`indiceDelSitio` construye el índice con `INFO_VERSION.version`—
     * y esto lo ata: si el lector pasara a estampar otra cosa, el `?v=` de esta
     * página pediría una versión que no existe y el aserto lo dice.
     */
    expect(src()).toContain('INFO_VERSION.version');
    const lector = sinComentarios(fuente('src/lib/contenidoDelSitio.ts'));
    expect(lector).toContain('INFO_VERSION.version');
  });

  it('no ve el índice: recibe su view-model (D-140)', () => {
    /*
     * La tentación es `indiceDelSitio()` acá para sacar las etiquetas: no filtra
     * nada y deja el índice entero —con `searchText` y `creadoEn`— al alcance de
     * un `{}`. Es la puerta que el `auditor-privacidad` encontró abierta en la
     * primera versión de la página de mes.
     */
    expect(src()).toContain('vistaDePasadas');
    expect(src()).not.toContain('indiceDelSitio');
    expect(src()).not.toContain('firebase-admin');
    expect(src()).not.toContain('searchText');
  });

  it('usa el reloj del índice y no `new Date()`', () => {
    // Con dos relojes, una actividad que termina mientras corre el build puede
    // quedar afuera de la home y de acá: la huérfana que esta página evita.
    expect(src()).toContain('new Date(generadoEn)');
    expect(src()).not.toContain('new Date()');
  });

  it('está en el sitemap y se llega desde el pie de todas las páginas', () => {
    /*
     * Las dos mitades de para qué existe (§2.1): la entrada del sitemap y **un
     * link interno permanente**. Sin el segundo, una página en el sitemap y sin
     * links vale casi nada para un buscador — que es justamente el problema de
     * las pasadas que esta página vino a resolver.
     */
    expect(RUTAS_FIJAS).toContain(RUTA_PASADAS);
    const pie = sinComentarios(fuente('src/components/sitio/PieDePagina.astro'));
    expect(pie).toContain('RUTA_PASADAS');
    expect(pie).toContain('Lo que ya pasó');
  });

  it('el sistema visual: sin radio, sin sombras y sin opacidades', () => {
    /*
     * D-146: radio 0, estrictamente plano, tintas con nombre y no opacidades. El
     * §4.5 pedía las tarjetas «atenuadas» y eso se escribió antes del rediseño —
     * una opacidad es por donde se cae el contraste (B-235). Lo que distingue una
     * pasada es la **tinta** del bloque de fecha (`super` y no terracota), que la
     * fila ya aplica sola. El desvío está en D-167.
     */
    const codigo = src();
    expect(codigo).not.toMatch(/\brounded/);
    expect(codigo).not.toMatch(/\bshadow-/);
    expect(codigo).not.toMatch(/\bopacity-/);
    expect(codigo).not.toMatch(/text-tinta\/\d/);
  });
});
