import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import {
  CAMPOS_DE_MAQUINA_FICHA,
  DIRECTORIOS,
  ESTADOS_DIRECTORIO,
  ESTADO_INICIAL,
  ESTADO_PUBLICO,
  TRANSICIONES,
  contenidoEditable,
  directorioPorId,
  esPendienteDeRevision,
  esVisibleEnElSitio,
  puedeMover,
  slugBloqueado,
  slugDeFicha,
  textoDelMovimiento,
  type Directorio,
  type EstadoDirectorio,
} from '@/lib/directorios';
import { RUTAS_FIJAS } from '@/lib/sitemap';
import { RUTA_GUIA, esSlugDeFicha, rutaCanonica } from '@/lib/rutasPublicas';
import { PREGUNTAS_DE_AYUDA } from '@/lib/ayudaDelSitio';

/**
 * **El motor de los tres directorios y la página que los recibe** — B-834 y
 * B-835, tajada 2 pasos 12 y 13.
 *
 * Lo que este archivo cuida son dos cosas distintas, y la segunda es la que
 * cuesta más cara:
 *
 * 1. **El ciclo de vida de una ficha.** Es lógica pura y barata de testear: los
 *    estados, qué movimientos existen, cuál hace visible una ficha, qué campos
 *    escribe la máquina y cuándo se congela la dirección web (trampa 10).
 * 2. **Que `/guia` y sus tres filas no se separen del árbol.** `disponible` es
 *    un booleano escrito a mano, o sea la clase de dato que se queda viejo sin
 *    que nada falle: marcarlo sin que exista la página le ofrece un 404 a quien
 *    entre, y escribir la página sin marcarlo deja la sección publicada e
 *    **invisible desde su propio índice**. Se cruza contra el disco y contra
 *    `RUTAS_FIJAS`, en las dos direcciones.
 *
 * Todas las mutaciones que cada caso promete están escritas al lado, y se
 * probaron: un aserto que no se vio rojo es peor que ninguno.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const fichaEn = (estado: EstadoDirectorio) => ({ estado });

describe('los estados de una ficha de directorio', () => {
  it('son tres, y el inicial y el público están entre ellos', () => {
    // Control positivo: sin esto, un arreglo vacío haría pasar los casos de
    // abajo sin haber mirado un solo estado.
    expect(ESTADOS_DIRECTORIO).toHaveLength(3);
    expect(ESTADOS_DIRECTORIO).toContain(ESTADO_INICIAL);
    expect(ESTADOS_DIRECTORIO).toContain(ESTADO_PUBLICO);
  });

  it('solo `publicado` sale al sitio', () => {
    /*
     * **La primera de las nueve cosas que se rompen en silencio** (§6 del
     * inventario): una ficha pendiente publicada se lleva puesto el contacto
     * interno de quien la cargó. Acá se fija el predicado; el `where` de la
     * query de cada entidad es la otra mitad y vive en su propio archivo.
     *
     * MUTACIÓN PROBADA: `esVisibleEnElSitio = () => true` —o cambiar
     * `ESTADO_PUBLICO` a `'pendiente'`— pone en rojo este caso y el de
     * `ESTADO_INICIAL`, que son las dos puntas de la misma decisión.
     */
    expect(esVisibleEnElSitio(fichaEn('publicado'))).toBe(true);
    expect(esVisibleEnElSitio(fichaEn('pendiente'))).toBe(false);
    expect(esVisibleEnElSitio(fichaEn('rechazado'))).toBe(false);
  });

  it('lo que nace de un formulario público arranca esperando decisión', () => {
    // «Nada que entre por un formulario público aparece en el sitio sin que un
    // admin lo publique» (`prd/README.md` § 1). Que el estado inicial no sea
    // visible es esa frase escrita como propiedad.
    expect(esVisibleEnElSitio(fichaEn(ESTADO_INICIAL))).toBe(false);
    expect(esPendienteDeRevision(fichaEn(ESTADO_INICIAL))).toBe(true);
  });
});

describe('el grafo de transiciones', () => {
  it('no deja publicar lo que ya se descartó sin volver a mirarlo', () => {
    /*
     * **La arista que falta es toda la razón por la que el grafo existe.**
     * Publicar de un saque algo que alguien descartó es meter al sitio una ficha
     * que nadie volvió a leer, que es lo que la bandeja existe para impedir.
     *
     * MUTACIÓN PROBADA: agregar `'publicado'` a `TRANSICIONES.rechazado` deja la
     * pantalla funcionando —aparece un botón más, y anda— y pone este caso en
     * rojo. Es la mutación que un `if` suelto en el JSX no podría atrapar.
     */
    expect(puedeMover('rechazado', 'publicado')).toBe(false);
    expect(puedeMover('rechazado', 'pendiente')).toBe(true);
    expect(puedeMover('pendiente', 'publicado')).toBe(true);
  });

  it('bajar del sitio se hace en un paso, en las dos formas', () => {
    // Una librería que cerró se baja ya; obligarla a pasar por «pendiente»
    // dejaría una ficha muerta esperando decisión en la bandeja.
    expect(puedeMover('publicado', 'rechazado')).toBe(true);
    expect(puedeMover('publicado', 'pendiente')).toBe(true);
  });

  it('ningún estado se mueve hacia sí mismo, ni hacia uno que no existe', () => {
    /*
     * «Publicar lo publicado» no es una acción y la pantalla no la puede
     * ofrecer: los botones se dibujan recorriendo este grafo, así que un destino
     * de más es un botón de más que no hace nada.
     *
     * MUTACIÓN PROBADA: agregar `'publicado'` a `TRANSICIONES.publicado` pone
     * este caso en rojo (y dibuja el botón inútil en la bandeja).
     */
    for (const estado of ESTADOS_DIRECTORIO) {
      const destinos = TRANSICIONES[estado];
      expect(destinos, `${estado} no tiene destinos declarados`).toBeDefined();
      expect(destinos, `${estado} se mueve hacia sí mismo`).not.toContain(estado);
      for (const destino of destinos) {
        expect(ESTADOS_DIRECTORIO, `${estado} → ${destino} no es un estado`).toContain(destino);
      }
    }
  });

  it('cada movimiento tiene un nombre distinto del de su opuesto', () => {
    /*
     * `pendiente` es destino de dos aristas y se llama distinto según de dónde
     * venga: «Reabrir» lo que se descartó y «Despublicar» lo que está en el
     * sitio. Que sean el mismo texto es un botón que miente sobre lo que hace.
     *
     * MUTACIÓN PROBADA: devolver `'Reabrir'` sin mirar `desde` pone esto en rojo.
     */
    expect(textoDelMovimiento('publicado', 'pendiente')).not.toBe(
      textoDelMovimiento('rechazado', 'pendiente'),
    );
    expect(textoDelMovimiento('pendiente', 'publicado')).toBe('Publicar');
  });
});

describe('qué escribe una persona y qué escribe la máquina', () => {
  it('el contenido editable se deriva, así que un campo nuevo entra solo', () => {
    /*
     * La dirección de la lista importa (§«Filtrar lo elegible no es filtrar lo
     * mostrable», D-41): olvidarse de sumar un campo de máquina ofrece editar
     * algo que la regla va a rechazar —visible, barato— y olvidarse de sumar un
     * campo editable a una lista blanca lo dejaría inaccesible para siempre.
     *
     * MUTACIÓN PROBADA: convertir `contenidoEditable` en un `pick` de una lista
     * blanca (`['nombre', 'slug']`) deja pasar los dos primeros asertos y pone en
     * rojo el del campo nuevo, que es el que describe la propiedad.
     */
    const ficha = {
      nombre: 'Del Otro Lado',
      slug: 'del-otro-lado',
      estado: 'pendiente',
      origen: 'formulario-publico',
      revision: { porUid: null, en: null, motivo: null },
      creadoEn: null,
      searchText: 'del otro lado',
      // El campo que todavía no existe: el de la tajada 3 o la 4.
      loQueVengaDespues: 'un valor cualquiera',
    };

    const editable = contenidoEditable(ficha);
    for (const campo of CAMPOS_DE_MAQUINA_FICHA) {
      expect(editable, `${campo} lo escribe la máquina y no tendría que ser editable`).not.toHaveProperty(
        campo,
      );
    }
    expect(editable).toHaveProperty('nombre');
    expect(editable, 'un campo nuevo tiene que entrar sin tocar la lista').toHaveProperty(
      'loQueVengaDespues',
    );
  });

  it('el slug no es un campo de máquina: el admin lo corrige antes de publicar', () => {
    // Lo deriva el admin del nombre (§5 del PRD 2) y se congela al publicar. Que
    // se congele no lo convierte en algo que escribe la máquina.
    expect(CAMPOS_DE_MAQUINA_FICHA).not.toContain('slug');
  });

  it('`contenidoEditable` no lo usa ningún productor de salida pública — §5.2, trampa 5', () => {
    /*
     * **Editable y público no son lo mismo**, y este es el chequeo que lo
     * sostiene. Lo pidió el `auditor-privacidad`: es la única función genérica de
     * filtrado de campos del módulo compartido, así que es la que va a agarrar la
     * tajada 3 cuando necesite «proyectar la ficha» — que es literalmente lo que
     * el § 1.2 del inventario prohíbe («un `toPublic` genérico invierte el default
     * y el primer campo nuevo sale solo»). Devuelve todo menos cinco campos, o
     * sea que devuelve `contactoDeQuienCargo`, y tiene que devolverlo: el
     * formulario de admin lo edita.
     *
     * **El control positivo es sobre el detector**, no sobre la lista: el barrido
     * tiene que encontrar el archivo que sí la menciona. Sin eso, un `grep` que no
     * matchea nada dejaría este caso en verde para siempre.
     */
    const fuentes = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    const mencionan = fuentes.filter((f) => readFileSync(raiz(f), 'utf8').includes('contenidoEditable'));

    expect(mencionan, 'el barrido no encontró ni el archivo que la define').toContain(
      'src/lib/directorios.ts',
    );

    const productoresPublicos = mencionan.filter(
      (f) => f.startsWith('src/pages/') || /toPublic|Publico|Publicas/.test(f),
    );
    expect(
      productoresPublicos,
      'estos archivos producen salida pública y usan `contenidoEditable`, que es una lista ' +
        'negra: un campo nuevo saldría solo. La proyección va por entidad y por whitelist.',
    ).toEqual([]);
  });
});

describe('la dirección web se congela al publicar — trampa 10', () => {
  it('se puede corregir mientras espera decisión, y no después', () => {
    /*
     * Una URL publicada está en Instagram, en un mail y en el índice de Google;
     * cambiarla es un 404 sin aviso. Pero mientras la ficha está en la bandeja,
     * corregirle el slug al nombre que llegó mal escrito **es** el trabajo.
     *
     * MUTACIÓN PROBADA: `slugBloqueado = () => true` pone en rojo el primer
     * aserto (y deja el panel sin poder corregir nada); `() => false` pone en
     * rojo el segundo (y es la trampa 10 en vivo).
     */
    expect(slugBloqueado({ estado: 'pendiente' })).toBe(false);
    expect(slugBloqueado({ estado: 'publicado' })).toBe(true);
  });

  it('y no tiene puerta de atrás: despublicar no lo devuelve editable — B-285', () => {
    /*
     * La pregunta de verdad es «¿estuvo publicada **alguna vez**?». Con solo el
     * estado actual, publicar y despublicar devolvería el slug editable, que es
     * la puerta de atrás del mismo candado.
     *
     * Y el default de lectura es el que preserva lo anterior (§«Un campo nuevo se
     * lee con el default que preserva lo anterior»): ausente ⇒ se contesta con el
     * estado. Hoy ningún documento de directorio trae la marca.
     *
     * MUTACIÓN PROBADA: cambiar el `??` por `||` en `slugBloqueado` pone en rojo
     * el segundo aserto —una ficha publicada con la marca en `false` volvería a
     * quedar bloqueada por el estado, tapando lo que la marca afirma— y cambiar
     * `publicadaAlgunaVez ?? …` por `publicadaAlgunaVez === true` pone en rojo el
     * tercero, que es el caso de todos los documentos que existen hoy.
     */
    expect(slugBloqueado({ estado: 'pendiente', publicadaAlgunaVez: true })).toBe(true);
    expect(slugBloqueado({ estado: 'publicado', publicadaAlgunaVez: false })).toBe(false);
    expect(slugBloqueado({ estado: 'publicado' })).toBe(true);
  });

  it('el slug sale de `slugify` y no de un normalizador propio', () => {
    // Dos versiones de «cómo se hace un slug» se separan sin que nada falle (la
    // clase de B-88), y la que queda vieja publica una URL distinta de la que el
    // resto del sitio deriva.
    expect(slugDeFicha('  Librería Del Otro Lado ')).toBe('libreria-del-otro-lado');
    expect(slugDeFicha('¡¿?!')).toBe('');
  });

  it('y lo que no salió de ahí no puede ser el segmento de una URL', () => {
    /*
     * La ficha de un directorio vive en una colección **cuya alta la pide
     * cualquiera desde un formulario público**, y el slug es un campo de persona
     * y no de máquina. Lo señaló el `auditor-privacidad`: el único productor
     * correcto es `slugDeFicha`, y nada obliga a que el valor guardado haya
     * pasado por ahí. `esSlugDeFicha` es lo que le deja a `getStaticPaths`
     * descartar la ficha rara en vez de emitir una URL rota (o de tirar el build
     * entero por un documento).
     *
     * MUTACIÓN PROBADA: sacarle los anclajes al regex (`/[a-z0-9-]+/`) deja pasar
     * los tres primeros casos y pone en rojo los de la ruta relativa y el
     * espacio, que son los que importan.
     */
    expect(esSlugDeFicha('del-otro-lado')).toBe(true);
    expect(esSlugDeFicha(slugDeFicha('Librería Del Otro Lado'))).toBe(true);

    expect(esSlugDeFicha('')).toBe(false);
    expect(esSlugDeFicha('Del Otro Lado')).toBe(false);
    expect(esSlugDeFicha('../../admin')).toBe(false);
    expect(esSlugDeFicha('del/otro/lado')).toBe(false);
    expect(esSlugDeFicha('-borde')).toBe(false);
    expect(esSlugDeFicha(undefined)).toBe(false);
  });
});

describe('la Guía y sus tres filas — B-835', () => {
  /** Dónde estaría la página de un directorio, según su ruta. */
  const archivosPosibles = (ruta: string): string[] => {
    const sinBarra = ruta.replace(/\/+$/, '');
    return [`src/pages${sinBarra}.astro`, `src/pages${sinBarra}/index.astro`];
  };

  const tienePagina = (d: Directorio): boolean =>
    archivosPosibles(d.ruta).some((f) => existsSync(raiz(f)));

  /*
   * ── Los dos chequeos, extraídos, y por qué ──────────────────────────────
   *
   * **Hoy las tres filas están en camino, o sea que `directoriosDisponibles()`
   * devuelve una lista vacía.** Un `for` sobre una lista vacía no ejecuta ni una
   * aserción y el caso pasa en verde sin haber mirado nada: es exactamente «un
   * control positivo que no puede fallar», que es peor que no tener el chequeo,
   * porque da cobertura falsa justo en el período en que la tabla se va a tocar.
   *
   * La salida es la de B-212: **el control negativo codificado**. Los dos
   * chequeos son funciones que devuelven los hallazgos, y cada caso las corre dos
   * veces — contra el árbol real, esperando cero, y contra una fila de mentira
   * armada para incumplirlo, exigiendo que la nombre. Así el caso sigue
   * afirmando algo el día que la lista real esté vacía, y **el día que no lo
   * esté** afirma las dos cosas.
   */
  const disponiblesSinPagina = (ds: readonly Directorio[]): string[] =>
    ds.filter((d) => d.disponible && !tienePagina(d)).map((d) => d.id);

  const disponiblesFueraDelSitemap = (ds: readonly Directorio[]): string[] =>
    ds.filter((d) => d.disponible && !RUTAS_FIJAS.includes(d.ruta)).map((d) => d.id);

  const conPaginaSinMarcar = (ds: readonly Directorio[]): string[] =>
    ds.filter((d) => !d.disponible && tienePagina(d)).map((d) => d.id);

  /** Una fila de mentira, para que los chequeos de arriba se puedan ver fallar. */
  const inventada = (over: Partial<Directorio>): Directorio => ({
    id: 'librerias',
    titulo: 'Inventada',
    singular: 'ficha',
    que: 'No existe: está acá para que el chequeo se pueda ver fallar.',
    ruta: rutaCanonica('/guia/inventada'),
    disponible: true,
    ...over,
  });

  it('son los tres del PRD, en el orden en que se construyen', () => {
    // Control positivo: con un arreglo vacío, los cruces de abajo pasarían sin
    // haber mirado una sola fila.
    expect(DIRECTORIOS.map((d) => d.id)).toEqual(['librerias', 'suscripciones', 'lugares']);
    expect(directorioPorId('librerias')?.titulo).toBe('Librerías');
    expect(directorioPorId('no-existe')).toBeUndefined();
  });

  it('cada fila tiene destino canónico, título y una línea de qué hay', () => {
    /*
     * La ruta sale de `rutasPublicas.ts` y ya viene con la barra final (B-330):
     * un destino escrito a mano se come un 301 por click. Y una fila sin `que` es
     * una fila que no dice nada, que en un índice es la única cosa que hace.
     *
     * MUTACIÓN PROBADA: poner `ruta: '/guia/librerias'` (sin la barra) en la fila
     * de librerías pone este caso en rojo.
     */
    for (const d of DIRECTORIOS) {
      expect(d.ruta, `${d.id} no está en la forma canónica`).toBe(rutaCanonica(d.ruta));
      expect(d.ruta.startsWith(RUTA_GUIA), `${d.id} no cuelga de /guia/`).toBe(true);
      expect(d.titulo.length, `${d.id} sin título`).toBeGreaterThan(3);
      expect(d.que.length, `${d.id} no explica qué hay`).toBeGreaterThan(20);
      expect(d.singular.length, `${d.id} sin nombre en singular`).toBeGreaterThan(3);
    }
  });

  it('una fila marcada disponible tiene su página en disco y su entrada en el sitemap', () => {
    /*
     * **La primera de las dos direcciones.** Marcar `disponible: true` sin la
     * página convierte la fila de `/guia` en un enlace a un 404 —y la entrada del
     * sitemap, en una URL que se le ofrece al buscador y le contesta que no
     * existe—. No falla nada: la página se ve bien y el enlace se ve bien.
     *
     * MUTACIÓN PROBADA: poner `disponible: true` en la fila de librerías (que hoy
     * no tiene página) pone este caso en rojo nombrando la sección.
     */
    expect(
      disponiblesSinPagina(DIRECTORIOS),
      'estas filas dicen estar disponibles y no tienen página: la Guía linkea a un 404',
    ).toEqual([]);
    expect(
      disponiblesFueraDelSitemap(DIRECTORIOS),
      'estas filas están disponibles y no entran al sitemap: existen y Google no las ve',
    ).toEqual([]);

    // Control negativo codificado: los dos chequeos tienen que poder fallar,
    // también —y sobre todo— mientras la lista real esté vacía.
    expect(disponiblesSinPagina([inventada({})])).toEqual(['librerias']);
    expect(disponiblesFueraDelSitemap([inventada({})])).toEqual(['librerias']);
  });

  it('y una sección que ya existe está marcada disponible', () => {
    /*
     * **La segunda dirección, que es la que se olvida.** La tajada que escriba
     * `/guia/librerias` va a probar la página, verla andar y pasar a otra cosa; el
     * booleano de esta tabla no lo mira nadie. Si queda en `false`, la sección
     * queda publicada e **invisible desde su propio índice**: existe, responde,
     * está en el sitemap, y la única página que la nombraría dice «en camino».
     *
     * MUTACIÓN PROBADA: crear `src/pages/guia/librerias/index.astro` y dejar
     * `disponible: false` pone este caso en rojo nombrando la sección. (Se probó
     * creando y borrando el archivo.)
     */
    expect(
      conPaginaSinMarcar(DIRECTORIOS),
      'estas secciones ya tienen página y la Guía sigue diciendo que están en camino',
    ).toEqual([]);

    // Control negativo: `/guia` sí existe, así que una fila apuntada ahí y sin
    // marcar es un caso que el chequeo tiene que encontrar.
    expect(conPaginaSinMarcar([inventada({ ruta: RUTA_GUIA, disponible: false })])).toEqual([
      'librerias',
    ]);
  });

  it('`/guia` está en la barra, en el sitemap y explicada en la ayuda', () => {
    /*
     * El circuito del §2.1 del inventario, verificado de punta a punta. Cada una
     * de las tres se olvida sola y ninguna rompe nada:
     *
     * - sin la pestaña, la página existe y no se llega;
     * - sin el sitemap, existe y Google no la ve (§6 #7, y `/guia` es
     *   justamente la que ese ítem señala como fácil de saltear);
     * - sin la ayuda, pasa lo de B-785 con `/apoyar`: una sección que nadie
     *   encuentra porque el único lugar donde se busca no la nombra.
     *
     * MUTACIONES PROBADAS: sacar la entrada de `ENLACES` en `Encabezado.astro`,
     * sacar `RUTA_GUIA` de `RUTAS_FIJAS`, y sacar el enlace de la respuesta
     * «¿Qué es esto?» ponen en rojo un aserto cada una.
     */
    const encabezado = readFileSync(raiz('src/components/sitio/Encabezado.astro'), 'utf8');
    expect(encabezado, 'la pestaña «Guía» no está en el encabezado').toMatch(
      /seccion: 'guia', href: RUTA_GUIA/,
    );
    expect(RUTAS_FIJAS).toContain(RUTA_GUIA);
    expect(
      PREGUNTAS_DE_AYUDA.flatMap((p) => p.enlaces ?? []).map((e) => e.href),
      'la ayuda dejó de nombrar la Guía',
    ).toContain(RUTA_GUIA);
  });
});
