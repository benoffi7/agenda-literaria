/**
 * **El motor de los tres directorios** — B-834, tajada 2 paso 12.
 *
 * Librerías (B-831), suscripciones literarias (B-832) y lugares para eventos
 * (B-833) tienen campos distintos y **el mismo ciclo de vida**: alguien de
 * afuera —o un admin— carga una ficha, la ficha espera en la bandeja, un admin
 * la publica o la descarta, y recién publicada existe para el sitio
 * (`prd/README.md` § 1). Lo que no depende de los campos vive acá y se escribe
 * una vez; lo que sí —el tipo, el schema de zod, la proyección pública— vive por
 * entidad y **no se generaliza**:
 *
 * > «`toPublic` por entidad, no genérico. La proyección es una whitelist y ahí
 * > está toda la seguridad de esto (…). Un `toPublic` genérico que proyecte
 * > "todo menos lo prohibido" invierte el default y el primer campo nuevo sale
 * > solo. **No hacerlo.**» — `prd/05-inventario-de-archivos.md` § 1.2
 *
 * Así que este módulo tiene un límite escrito: **no proyecta, no lee Firestore y
 * no sabe qué campos tiene una librería.** Sabe en qué estados puede estar una
 * ficha, cómo se mueve entre ellos, cuál de esos estados la hace visible, qué
 * campos escribe la máquina y cuáles son los tres directorios que existen.
 *
 * ── Es puro, y no por prolijidad ──────────────────────────────────────────
 * Lo importan **las dos aplicaciones**: el panel (`DirectorioPanel.tsx`) y el
 * sitio público (`/guia`). Vale entonces la regla del § «Un control compartido
 * recibe, no importa» de `05-patrones.md`: lo que este archivo importe **viaja a
 * una página pública**, con su cadena entera detrás. Por eso sus únicos imports
 * son `slugify` y `rutasPublicas`, los dos puros; la lectura en vivo, el
 * `onSnapshot` y las escrituras son de `useDirectorio.ts` y de la capa por
 * entidad, que solo existen del lado del panel.
 */
import { slugify } from '@/lib/slugify';
import {
  RUTA_LIBRERIAS,
  RUTA_LUGARES,
  RUTA_SUSCRIPCIONES,
} from '@/lib/rutasPublicas';

// ─────────────────────────────────────────────────────────────────
// Los estados y cómo se mueven
// ─────────────────────────────────────────────────────────────────

/**
 * Los tres estados de una ficha de directorio.
 *
 * **Son tres y no los cuatro de una actividad** (`borrador`, `pendiente`,
 * `publicado`, `cancelado`): una ficha no se cancela —una librería no deja de
 * haber existido, cierra— y no tiene borrador, porque quien la carga desde el
 * formulario público no vuelve a entrar (`prd/README.md` § 7: «quien propone no
 * vuelve a entrar, manda y listo»). Lo que sí hace falta es `rechazado`, que una
 * actividad no tiene: acá el alta la puede pedir cualquiera.
 */
export const ESTADOS_DIRECTORIO = ['pendiente', 'publicado', 'rechazado'] as const;
export type EstadoDirectorio = (typeof ESTADOS_DIRECTORIO)[number];

/**
 * **El estado inicial, y lo fuerza la regla de Firestore, no esto.**
 *
 * Está acá para que el panel y los tests no lo escriban como literal, pero la
 * propiedad que importa la sostiene `firestore.rules`: «el `estado` inicial **lo
 * fuerza la regla**, no el cliente — si lo decide el cliente, un `curl`
 * publica» (`prd/README.md` § 1). Un valor en un módulo de TypeScript no le
 * impide nada a nadie.
 */
export const ESTADO_INICIAL: EstadoDirectorio = 'pendiente';

/**
 * El único estado que sale al sitio.
 *
 * Existe como constante por **la primera de las nueve cosas que se rompen en
 * silencio** (`prd/05-inventario-de-archivos.md` § 6): si a la lectura del build
 * le falta el `where('estado','==','publicado')`, se publica lo pendiente —con
 * el contacto interno de quien cargó adentro— y no falla nada.
 *
 * ✅ **Y desde B-903 la query también sale de acá.** Hasta la tajada anterior lo
 * único fijado era el predicado en memoria, que **no es lo mismo**: filtrar
 * después de leer significa que el documento entero —el contacto interno
 * incluido— ya pasó por el proceso de build, quedó en memoria del runner de CI y
 * pudo caer en cualquier log del camino. Era deuda declarada porque todavía no
 * existía ninguna lectura de directorio que atar.
 *
 * La primera existe: `libreriasPublicadas` (`lib/contenidoDelSitio.ts`) escribe
 * `.where('estado', '==', ESTADO_PUBLICO)` con **esta** constante, y
 * `tests/librerias.test.ts` lo afirma leyendo ese archivo —con la mutación
 * probada: cambiar el `where` por un `.filter` en memoria pone el caso en rojo—.
 * La tajada 3 y la 4 heredan la constante, no la deuda.
 */
export const ESTADO_PUBLICO: EstadoDirectorio = 'publicado';

/**
 * ¿Esta ficha existe para el sitio?
 *
 * **No reemplaza al `where` de la query**, y la diferencia es la trampa 7 del
 * §13 dada vuelta: filtrar en memoria lo que se leyó de más significa que el
 * documento entero —el contacto de quien la cargó incluido— pasó por el proceso
 * de build. El `where` es lo que hace que no se lea; esto es lo que contesta la
 * pregunta en el único idioma en que se puede volver a preguntar (una ficha
 * suelta, un test, la ficha abierta en el panel).
 */
export const esVisibleEnElSitio = (ficha: { estado: EstadoDirectorio }): boolean =>
  ficha.estado === ESTADO_PUBLICO;

/** Lo que espera una decisión: es lo que cuenta el badge y lo que la bandeja muestra por defecto. */
export const esPendienteDeRevision = (ficha: { estado: EstadoDirectorio }): boolean =>
  ficha.estado === 'pendiente';

/**
 * A dónde puede ir cada estado.
 *
 * **La única arista que falta es `rechazado → publicado`**, y es toda la razón
 * por la que este grafo existe en vez de un `estado = x` suelto en el
 * componente: publicar de un saque lo que alguien ya descartó es la forma de que
 * una ficha entre al sitio **sin que nadie la haya vuelto a leer**, que es
 * exactamente lo que la bandeja existe para impedir. Reabrir (`→ pendiente`) y
 * publicar desde ahí son dos clicks y un estado en el medio donde la ficha se
 * mira de nuevo.
 *
 * Las otras cinco están todas, incluida `publicado → rechazado`: una librería
 * que cerró se baja del sitio en un paso, y obligar a pasar por `pendiente`
 * dejaría un rato una ficha muerta esperando decisión en la bandeja.
 *
 * Un estado **hacia sí mismo no es un movimiento** y por eso no está: «publicar
 * lo publicado» no es una acción que la pantalla tenga que ofrecer.
 */
export const TRANSICIONES: Record<EstadoDirectorio, readonly EstadoDirectorio[]> = {
  pendiente: ['publicado', 'rechazado'],
  publicado: ['pendiente', 'rechazado'],
  rechazado: ['pendiente'],
};

/** ¿Este movimiento está permitido? Es lo que decide qué botones se dibujan. */
export const puedeMover = (desde: EstadoDirectorio, hasta: EstadoDirectorio): boolean =>
  TRANSICIONES[desde]?.includes(hasta) ?? false;

/**
 * El nombre del botón de cada movimiento, **en el idioma de quien mira la
 * bandeja**: qué le pasa a la ficha, no a qué estado va.
 *
 * La clave es el estado **de destino** y no el par, y eso es una decisión: con
 * el par habría cinco textos para tres acciones y «Publicar» tendría dos
 * redacciones según de dónde viniera. El precio es que «Despublicar» y
 * «Reabrir» son el mismo destino (`pendiente`) con dos nombres; lo resuelve
 * `textoDelMovimiento`, que sí mira de dónde sale.
 */
export const textoDelMovimiento = (
  desde: EstadoDirectorio,
  hasta: EstadoDirectorio,
): string => {
  if (hasta === 'publicado') return 'Publicar';
  if (hasta === 'rechazado') return desde === 'publicado' ? 'Bajar del sitio' : 'Descartar';
  return desde === 'publicado' ? 'Despublicar' : 'Reabrir';
};

/** Cómo se lee el estado en la ficha del panel. Sin jerga y sin nombrar el campo. */
export const TEXTO_ESTADO: Record<EstadoDirectorio, string> = {
  pendiente: 'espera decisión',
  publicado: 'en el sitio',
  rechazado: 'descartada',
};

// ─────────────────────────────────────────────────────────────────
// Qué escribe una persona y qué escribe la máquina
// ─────────────────────────────────────────────────────────────────

/**
 * Los campos que **no** tipea nadie.
 *
 * Es la misma lista negra —y la misma dirección— que `CAMPOS_DE_MAQUINA` de
 * `functions/historial.js`, y el motivo está escrito ahí y en el §«Filtrar lo
 * elegible no es filtrar lo mostrable» de `05-patrones.md`: cuando el costo de
 * los dos errores no es simétrico, la lista va del lado en que olvidarse sale
 * barato.
 *
 * | Si te olvidás de un campo nuevo | |
 * |---|---|
 * | con una lista de campos **editables** | el campo no se puede editar nunca, y nada falla |
 * | con esta lista de campos **de máquina** | se ofrece editar algo que la regla va a rechazar: visible, y se arregla en una línea |
 *
 * `slug` **no está**: lo deriva el admin del nombre y lo puede corregir mientras
 * la ficha no se haya publicado (ver `slugBloqueado`). Que después se congele no
 * lo convierte en un campo de máquina.
 */
export const CAMPOS_DE_MAQUINA_FICHA = [
  'estado',
  'origen',
  'revision',
  'creadoEn',
  'searchText',
] as const;

/**
 * El contenido de una ficha: todo lo que una persona pudo haber tipeado.
 *
 * Se **deriva** en vez de enumerarse, así que el campo que agregue la tajada 3 o
 * la 4 entra solo. Su uso es uno solo: **qué campos le ofrece el formulario de
 * admin**.
 *
 * ⚠️ **Esto NO es una proyección pública, y no se puede usar como tal.** Lo
 * señaló el `auditor-privacidad` sobre la primera redacción de este docblock, que
 * decía que también servía para saber «si una edición cambió algo que se ve en el
 * sitio». No sirve, y la confusión es exactamente la que el § 1.2 del inventario
 * prohíbe:
 *
 * > «`toPublic` por entidad, no genérico. (…) Un `toPublic` genérico que proyecte
 * > "todo menos lo prohibido" invierte el default y el primer campo nuevo sale
 * > solo. **No hacerlo.**»
 *
 * **Editable y público no son lo mismo.** `contactoDeQuienCargo` —el mail o el
 * WhatsApp de quien pidió el alta— es contenido editable y es lo más interno que
 * tiene el documento. Esta función lo devuelve, y tiene que devolverlo.
 *
 * Y la pregunta del rebuild («¿cambió algo publicado?», § 6 #6 del inventario) se
 * contesta contra el `toPublic` de la entidad —comparando el payload que sale,
 * que es el patrón de la guarda anti-loop del §7.1—, nunca contra esto.
 */
export const contenidoEditable = <T extends Record<string, unknown>>(
  ficha: T,
): Record<string, unknown> => {
  const maquina = new Set<string>(CAMPOS_DE_MAQUINA_FICHA);
  return Object.fromEntries(Object.entries(ficha).filter(([campo]) => !maquina.has(campo)));
};

// ─────────────────────────────────────────────────────────────────
// El slug
// ─────────────────────────────────────────────────────────────────

/**
 * El slug que le corresponde a un nombre.
 *
 * `slugify` y no un regex propio: es el mismo normalizador de las taxonomías
 * (§4.2) y de las actividades, y dos versiones de «cómo se hace un slug» se
 * separan sin que nada falle — la clase de B-88. De «Librería Del Otro Lado » sale
 * `libreria-del-otro-lado`, que es lo que va a estar en la URL para siempre.
 *
 * **Cadena vacía si no queda nada**, y a propósito: un nombre de puros signos no
 * tiene slug, y devolver algo inventado publicaría una URL que nadie escribió.
 * Quien llame decide qué hacer con el vacío (el formulario lo muestra como campo
 * requerido).
 */
export const slugDeFicha = (nombre: string): string => slugify(nombre);

/**
 * ¿El slug ya no se puede tocar? **Trampa 10 del §13.**
 *
 * Una dirección publicada está en Instagram, en un mail y en el índice de
 * Google; cambiarla es un 404 sin aviso y el SEO perdido. Por eso se congela
 * **al publicar** y no al crear: mientras la ficha espera decisión, corregirle el
 * slug al nombre que llegó mal escrito es justo el trabajo de la bandeja.
 *
 * ── El default de lectura, que es lo que hace que no tenga puerta de atrás ──
 * La pregunta de verdad es «¿estuvo publicada **alguna vez**?» (B-285): una
 * ficha que se publicó y se despublicó volvió a `pendiente`, y mirar solo el
 * estado actual le devolvería el slug editable — o sea la puerta de atrás del
 * mismo candado. Por eso se acepta la marca `publicadaAlgunaVez`, con el default
 * que preserva lo anterior (§«Un campo nuevo se lee con el default que preserva
 * lo anterior»): ausente ⇒ se contesta con el estado, que es exactamente el
 * comportamiento de siempre.
 *
 * **Hoy nadie escribe esa marca en un directorio** —la escribe un trigger, y el
 * de estas colecciones no existe todavía—, así que el parámetro está para que el
 * día que exista no haya que tocar ni un llamador. Es el mismo trato que la
 * marca tiene en las actividades, donde la escribe la Function y no el panel.
 */
export const slugBloqueado = (ficha: {
  estado: EstadoDirectorio;
  publicadaAlgunaVez?: boolean;
}): boolean => ficha.publicadaAlgunaVez ?? ficha.estado === ESTADO_PUBLICO;

// ─────────────────────────────────────────────────────────────────
// Cuáles son los tres directorios — el registro de `/guia`
// ─────────────────────────────────────────────────────────────────

/** El identificador de un directorio. Es también el segmento de su URL bajo `/guia/`. */
export type IdDirectorio = 'librerias' | 'suscripciones' | 'lugares';

export interface Directorio {
  id: IdDirectorio;
  /** Cómo se llama la sección. Es el texto de la fila de `/guia` y el título de su listado. */
  titulo: string;
  /** Una ficha, en singular. Lo usa el panel: «Publicar esta librería». */
  singular: string;
  /** Qué vas a encontrar ahí, en una línea. Es lo único que la fila de `/guia` explica. */
  que: string;
  /** El destino, siempre desde `rutasPublicas.ts` (B-330: nunca un `href` a mano). */
  ruta: string;
  /**
   * ¿La sección ya existe?
   *
   * **Mientras sea `false` la fila no linkea**, dice «en camino» y `/guia` no
   * miente: una pestaña que lleva a una lista de enlaces rotos es peor que una
   * pestaña que dice qué falta. Lo que hace que este flag no se quede viejo —el
   * modo de falla obvio— es `tests/directorios.test.ts`, que lo cruza contra las
   * páginas que hay en disco **en las dos direcciones**: marcarlo sin la página
   * ofrece un 404, y escribir la página sin marcarlo la deja invisible.
   */
  disponible: boolean;
}

/**
 * **Los tres directorios de la Guía, en el orden en que se construyen.**
 *
 * El orden es el de `prd/README.md` § 6 y no es alfabético ni caprichoso:
 * librerías es el más chico y el que valida el motor, suscripciones el del
 * modelo más raro, lugares el que más taxonomía nueva pide. Es también el orden
 * en que las filas van a ir dejando de decir «en camino», así que la página se
 * lee de arriba hacia abajo como la construcción va avanzando.
 *
 * **Sumar el cuarto directorio es una entrada acá y nada más**: la fila de
 * `/guia`, el título del panel y el destino salen de esto. Eso es lo que pide el
 * paso 12 —«lo que metas acá no se reescribe después»— y lo que hace que las
 * tajadas 3 y 4 no vuelvan a escribir la página.
 */
export const DIRECTORIOS: readonly Directorio[] = [
  {
    id: 'librerias',
    titulo: 'Librerías',
    singular: 'librería',
    que: 'Dónde comprar libros: la dirección, el barrio y cómo seguirlas.',
    ruta: RUTA_LIBRERIAS,
    /*
     * **La primera que deja de decir «en camino»** — B-901, tajada 2 paso 14.
     *
     * Este `true` hace dos cosas de golpe, y por eso es **una** línea y no dos
     * escritas en dos archivos: la fila de `/guia` se convierte en enlace, y la
     * URL entra sola al sitemap (`RUTAS_FIJAS` la deriva de
     * `directoriosDisponibles()`). La séptima de las nueve cosas que se rompen en
     * silencio —«las páginas nuevas no entran al sitemap»— acá no se vigila: no
     * se puede cometer.
     *
     * Las dos direcciones las cruza `tests/directorios.test.ts` contra el disco:
     * marcarlo sin la página ofrece un 404, y escribir la página sin marcarlo deja
     * la sección publicada e invisible desde su propio índice.
     */
    disponible: true,
  },
  {
    id: 'suscripciones',
    titulo: 'Suscripciones literarias',
    singular: 'suscripción',
    que: 'Cajas y envíos de libros por mes, con qué incluye cada uno.',
    ruta: RUTA_SUSCRIPCIONES,
    /*
     * **La segunda que deja de decir «en camino»** — B-832, tajada 3.
     *
     * El mismo `true` de una línea que estrenó librerías, y la misma promesa
     * cumplida: la fila de `/guia` se convierte en enlace y la URL entra sola al
     * sitemap (`RUTAS_FIJAS` la deriva de `directoriosDisponibles()`), así que la
     * séptima de las nueve cosas que se rompen en silencio acá tampoco se puede
     * cometer. Que la tajada 3 no haya tenido que volver a escribir `/guia` es lo
     * que el paso 12 quería probar.
     */
    disponible: true,
  },
  {
    id: 'lugares',
    titulo: 'Lugares para hacer eventos',
    singular: 'lugar',
    que: 'Salones, cafés y espacios que prestan o alquilan para una actividad.',
    ruta: RUTA_LUGARES,
    disponible: false,
  },
];

/** El directorio con ese id, o `undefined`. Lo usan el panel y los tests. */
export const directorioPorId = (id: string): Directorio | undefined =>
  DIRECTORIOS.find((d) => d.id === id);

/** Los que ya existen, que son los que `/guia` linkea y el sitemap ofrece. */
export const directoriosDisponibles = (): Directorio[] =>
  DIRECTORIOS.filter((d) => d.disponible);
