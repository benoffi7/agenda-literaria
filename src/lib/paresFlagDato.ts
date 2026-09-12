/**
 * **El par flag + dato, como clase y no como cuatro instancias sueltas** —
 * B-911, abierto por B-832 y cerrado por B-833 (tajada 4).
 *
 * ── Qué es la clase ───────────────────────────────────────────────────────
 * Un **booleano que decide si otro campo del mismo documento se publica**. Hay
 * cuatro en el proyecto y las cuatro tienen el mismo modo de falla: la
 * proyección lee el dato sin mirar el flag, y entonces el sitio publica algo que
 * el documento dice que no se publica. No falla nada, no hay error, y lo que
 * sale es exactamente el dato que alguien pidió no publicar.
 *
 * | # | Flag | Qué esconde | Dónde nació |
 * |---|---|---|---|
 * | 1 | `online.urlPublica` | el link de la reunión | D-15, trampa 5 |
 * | 2 | `material.items[].publico` (+ `material.tiene`) | la URL del material | §5.1 |
 * | 3 | `envio.manda` | los cuatro datos del envío de una suscripción | B-832 |
 * | 4 | `direccionPublica` | la dirección y la `geo` de un lugar | B-833, § 6 del PRD 4 |
 *
 * **El cuarto es el único donde el flag vive en un campo de primer nivel aparte**
 * del dato: en los otros tres el par entero cabe adentro de `modalidades`,
 * `material` o `envio`. Eso es lo que obligó a **derivar** los campos que el par
 * toca (`camposDelPar`) en vez de escribirlos al lado del registro.
 *
 * ── Por qué existe este archivo, y no es prolijidad ───────────────────────
 * Hasta B-832 las tres primeras tenían cobertura **por instancia** y la clase no
 * existía en `tests/clases-de-bug.test.ts`. Peor: dos docblocks llegaron a
 * afirmar que sí, y eso es exactamente el daño que B-911 describe — «el cuarto
 * par se va a escribir confiando en una red que no está puesta». El cuarto par
 * es `direccionPublica`, y el dato que esconde es **la dirección de la casa de
 * una persona** (§ 6 del PRD 4), así que la red se pone ahora.
 *
 * Es el patrón de `EFECTOS_INCONDICIONALES` (B-83) y el de `CAMPOS_DE_MAQUINA`:
 * un registro chico, con **una mitad derivada del fuente y una mitad escrita a
 * mano**, y el chequeo en `tests/clases-de-bug.test.ts`.
 *
 * ── Qué se puede derivar y qué no, dicho y no supuesto ────────────────────
 * - **Se deriva:** todo booleano de un tipo del modelo cuyo nombre diga
 *   «público» (`urlPublica`, `publico`, `direccionPublica`). El chequeo lo busca
 *   en los tipos y exige que esté acá o en `NO_SON_PARES` con su motivo. Un
 *   `xxxPublica: boolean` nuevo **no puede entrar en silencio**.
 * - **No se deriva:** un flag que no se llame así. `envio.manda` es el caso, y
 *   por eso está escrito a mano. Extender el registro cuando aparezca otro es
 *   trabajo de los auditores, igual que con `EFECTOS_INCONDICIONALES` — está
 *   dicho en `docs/13-agentes.md` para que no se lea como una garantía que no es.
 *
 * ── Y el uso que no es un test: el historial ──────────────────────────────
 * `flagsDePublicacionRestaurables` (`lib/historial.ts`, B-819) saca de acá **qué
 * campos vigila**, en vez de tener su propia lista de dos nombres. Restaurar una
 * versión vieja puede volver a prender un flag que hoy está apagado, y esa es la
 * segunda mitad de cada par. Ver `CAMPOS_CON_PAR_DE` más abajo.
 *
 * Puro y **sin un solo import**: lo leen el panel, un test y —el día que exista—
 * la guarda del historial de un directorio. Lo que este archivo importe viaja
 * con él (§ «Un control compartido recibe, no importa» de `05-patrones.md`).
 */

/** De qué entidad es un par. Es también el nombre de su colección, menos `actividad`. */
export type EntidadConPar = 'actividad' | 'suscripcion' | 'lugar';

export interface ParFlagDato {
  /** Un id legible, para que el mensaje de un test diga cuál se rompió. */
  id: string;
  entidad: EntidadConPar;
  /**
   * La ruta del flag, **desde la raíz del documento**.
   *
   * ⚠️ **Desde la raíz y no relativa**, y eso lo corrigió el
   * `auditor-privacidad`. De acá y de `datos` se **derivan** los campos de primer
   * nivel que el par toca (`camposDelPar`), que es lo que el historial restaura;
   * con una ruta relativa el primer segmento sería otra cosa y la derivación
   * mentiría. Por eso el primer par dice `modalidades[].online.urlPublica` y no
   * `online.urlPublica`.
   */
  flag: string;
  /** Las rutas de los datos que el flag esconde, también desde la raíz. */
  datos: readonly string[];
  /**
   * **El único lugar que decide si el dato sale**, y el archivo donde vive.
   *
   * Una función y no «la proyección»: lo que hace que el par se cumpla es que la
   * decisión esté en **un** lugar con nombre propio, no repartida en el
   * llamador. Cuando hay un segundo lector —el historial— ese lector importa
   * esta misma función y no escribe una parecida (la lección de B-819: «el par
   * guarda ⇄ productor»).
   */
  productor: { archivo: string; funcion: string };
  /**
   * ¿La entidad tiene subcolección `/versiones`?
   *
   * **Decide si la segunda mitad de B-819 aplica.** Restaurar una versión vieja
   * es la otra puerta por la que un flag apagado se vuelve a prender, y
   * `flagsDePublicacionRestaurables` la cierra… para las entidades que tienen
   * historial. `/librerias`, `/suscripciones` y `/lugares` **no lo tienen**
   * —`firestore.rules` lo dice en cada bloque: «no hay subcolección `/versiones`
   * acá»—, así que hoy no hay nada que restaurar y por lo tanto nada que
   * bloquear. No es que la guarda esté floja: es que la puerta no existe.
   *
   * Está declarado y no supuesto para que el día que un directorio gane
   * historial, el chequeo de la clase pida la guarda en el mismo cambio.
   */
  conHistorial: boolean;
}

/**
 * **Los cuatro pares del proyecto.**
 *
 * El orden es cronológico, que es también el orden en que se fue entendiendo la
 * clase: primero un caso, después dos con una función compartida (D-124), después
 * el tercero sin red, y el cuarto con ella.
 */
export const PARES_FLAG_DATO: readonly ParFlagDato[] = [
  {
    id: 'actividad/online.urlPublica',
    entidad: 'actividad',
    flag: 'modalidades[].online.urlPublica',
    datos: ['modalidades[].online.url'],
    productor: { archivo: 'src/lib/toPublic.ts', funcion: 'linkDeReunionQueSale' },
    conHistorial: true,
  },
  {
    id: 'actividad/material.items[].publico',
    entidad: 'actividad',
    flag: 'material.items[].publico',
    datos: ['material.items[].url'],
    productor: { archivo: 'src/lib/toPublic.ts', funcion: 'urlDeMaterialQueSale' },
    conHistorial: true,
  },
  {
    /*
     * **El que no se puede derivar del nombre**, y por eso está acá a mano. Un
     * flag llamado `manda` no dice «publico» en ninguna parte: lo que lo vuelve
     * un par es lo que pasa cuando está apagado —los cuatro datos del envío
     * dejan de ser ciertos— y eso no se lee de un tipo.
     */
    id: 'suscripcion/envio.manda',
    entidad: 'suscripcion',
    flag: 'envio.manda',
    datos: ['envio.cuantos', 'envio.tematica', 'envio.editoriales', 'envio.sorpresa'],
    productor: { archivo: 'src/lib/suscripcionPublica.ts', funcion: 'envioPublico' },
    conHistorial: false,
  },
  {
    /*
     * **El cuarto, y el que más caro sale** — § 6 del PRD 4. Lo que esconde no
     * es un link de Zoom ni una temática: es la dirección de la casa de una
     * persona, cargada por alguien que puede no vivir ahí.
     *
     * Los dos datos van **en un solo par y con un solo productor**: `geo` sin
     * `direccion` sigue poniendo la casa en un mapa, así que separarlos sería
     * dejar la mitad cara de la decisión colgando de que el segundo llamador se
     * acuerde.
     */
    id: 'lugar/direccionPublica',
    entidad: 'lugar',
    // ⚠️ El flag vive en un campo de primer nivel **aparte** de los dos datos:
    // es el único par del proyecto donde pasa, y es lo que obligó a derivar
    // `camposDelPar` en vez de escribirlo a mano.
    flag: 'direccionPublica',
    datos: ['direccion', 'geo'],
    productor: { archivo: 'src/lib/lugarPublico.ts', funcion: 'dondeQueSale' },
    conHistorial: false,
  },
];

/**
 * Los booleanos del modelo que **se llaman como un flag de publicación y no lo
 * son**, cada uno con por qué.
 *
 * Es la mitad que hace que el chequeo derivado no se pueda satisfacer callando:
 * un `xxxPublica: boolean` nuevo entra acá con su motivo o entra al registro de
 * arriba. Un `describe` con una lista de excepciones que crece sin motivo da
 * falsa cobertura, así que la única entrada de hoy lleva su párrafo.
 */
export const NO_SON_PARES: Record<string, string> = {
  publicadaAlgunaVez:
    'es el candado del slug (trampa 10, B-285): dice si la ficha estuvo publicada alguna vez, ' +
    'para que despublicar no devuelva la dirección web editable. No esconde ningún campo — no ' +
    'sale a ninguna salida y no gatea a nadie.',
};

/**
 * Los campos de primer nivel de una entidad que llevan un par — **el del flag y
 * el de cada dato**.
 *
 * Lo usa `flagsDePublicacionRestaurables` (`lib/historial.ts`) para saber qué
 * restauración tiene que mirar, en vez de llevar su propia lista de dos nombres
 * escritos a mano: dos listas de «cuáles son los pares» se separan sin que nada
 * falle, que es la clase de B-88 y la que este archivo existe para cerrar.
 *
 * Que incluya **el campo del flag** y no solo el del dato es lo que hace que el
 * cuarto par se pueda expresar: ahí el flag vive en un campo de primer nivel
 * aparte, y restaurarlo solo volvería a prenderlo sobre la dirección de hoy.
 */
export const CAMPOS_CON_PAR_DE = (entidad: EntidadConPar): string[] => [
  ...new Set(PARES_FLAG_DATO.filter((p) => p.entidad === entidad).flatMap(camposDelPar)),
];

/**
 * Los campos **de primer nivel** del documento que toca un par: el del flag y el
 * de cada dato.
 *
 * Es la unidad que el historial restaura —`restaurarCampo` escribe campos de
 * primer nivel— y **se deriva de las rutas** en vez de escribirse al lado: una
 * lista a mano es una segunda escritura de lo mismo, y la que se quede vieja deja
 * un campo fuera de la guarda sin que nada falle (la clase de B-88, que es la que
 * este archivo existe para cerrar).
 *
 * **Incluye el campo del flag**, y eso importa por el cuarto par: ahí
 * `direccionPublica` es un campo de primer nivel **aparte** de `direccion` y de
 * `geo`, así que restaurarlo solo volvería a prenderlo sobre la dirección de hoy.
 * En los tres primeros el flag vive adentro del mismo campo que el dato y la
 * unión no agrega nada — que es exactamente la señal de que la derivación es la
 * correcta y el nombre a mano era una casualidad.
 */
export const camposDelPar = (par: ParFlagDato): string[] => [
  ...new Set([par.flag, ...par.datos].map((ruta) => ruta.split('.')[0]!.replace('[]', ''))),
];
