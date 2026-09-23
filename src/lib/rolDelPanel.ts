/**
 * Los dos roles del panel, en el idioma del panel — B-888, tajada 2 (D-650).
 *
 * ⚠️ **Nada de acá autoriza nada.** La autorización son `firestore.rules` y
 * `storage.rules`, y están desde la tajada 1: que este módulo esconda una
 * pantalla no le impide nada a quien abra la consola de Firebase con su propia
 * sesión — es el modo de falla que D-128 cerró y que el §7 de `07-seguridad.md`
 * repite. Lo que este módulo decide es otra cosa, y es la que la tajada 2 tiene
 * que resolver: **que la pantalla no se rompa y que no ofrezca lo que las reglas
 * van a rechazar.** Ofrecer un botón que siempre falla es peor que no tenerlo.
 *
 * Va en un módulo puro con sus tests por el mismo motivo que `anchoDelPanel.ts`
 * y `salida-del-panel.ts`: la pantalla que se agregue mañana **arranca cerrada**
 * y quien la escriba la habilita en una línea acá, en vez de heredar un
 * `rol === 'admin' &&` suelto en el JSX que nadie sabe si está puesto en las diez
 * puertas o en nueve.
 */

export const ROLES_DEL_PANEL = ['admin', 'publicador'] as const;
export type RolDelPanel = (typeof ROLES_DEL_PANEL)[number];

/**
 * Las pantallas del panel, con el mismo nombre que el `tipo` de la `Vista` de
 * `AdminApp.tsx`.
 *
 * **La lista se afirma contra el fuente** (`tests/rol-del-panel.test.ts`): una
 * vista nueva en `AdminApp` que no esté acá pone el chequeo en rojo, así que no
 * puede nacer sin que alguien decida quién la ve. Es el patrón de los chequeos
 * de clase del §"Verificar la clase, no la instancia".
 */
export const PANTALLAS_DEL_PANEL = [
  'lista',
  'nueva',
  'editar',
  'duplicar',
  'calendario',
  'historial',
  'taxonomias',
  'estadisticas',
  'reportes',
  'propuestas',
  'convertir',
  /*
   * B-901 — la Guía, primera entidad: `librerias` es la bandeja del directorio y
   * `libreria` su formulario. Son **dos** y no una porque el aviso de salida con
   * cambios sin guardar (`salida-del-panel.ts`) se decide por la vista del
   * router: con el formulario adentro de la bandeja, abandonarlo no preguntaría
   * nada, que es lo que B-35 cerró.
   */
  'librerias',
  'libreria',
  /*
   * B-832 — la Guía, segunda entidad. Son **dos** por el mismo motivo que las de
   * librerías: el aviso de salida con cambios sin guardar se decide por la vista
   * del router, y con el formulario adentro de la bandeja abandonarlo no
   * preguntaría nada (B-35).
   */
  'suscripciones',
  'suscripcion',
  /*
   * B-833 — la Guía, tercera entidad. Son **dos** por el mismo motivo que las
   * otras: el aviso de salida con cambios sin guardar se decide por la vista del
   * router, y con el formulario adentro de la bandeja abandonarlo no preguntaría
   * nada (B-35).
   */
  'lugares',
  'lugar',
  /*
   * B-960 — la Guía, cuarta entidad. Son **dos** por el mismo motivo que las
   * otras tres: el aviso de salida con cambios sin guardar se decide por la
   * vista del router, y con el formulario adentro de la bandeja abandonarlo no
   * preguntaría nada (B-35).
   */
  'bibliotecas',
  'biblioteca',
  /*
   * B-1230 — el borrador del correo semanal. Es la única pantalla del panel que
   * **no lee Firestore** (se arma con el `/events.json` publicado, D-801), así
   * que no hay regla que le haga de espejo: acá se decide sola. Y se decide como
   * `estadisticas` —solo el admin—, por la misma clase de motivo que aquélla: el
   * correo es la voz del proyecto, mandarlo es decidir qué se le anuncia a la
   * lista entera, y esa autoridad es justamente la que el publicador no tiene.
   */
  'boletin',
] as const;
export type PantallaDelPanel = (typeof PANTALLAS_DEL_PANEL)[number];

export interface PermisosDelPanel {
  /** Qué pantallas se le ofrecen. Lo demás ni se dibuja ni se puede alcanzar. */
  pantallas: readonly PantallaDelPanel[];
  /**
   * ¿Puede pedirle a Firestore la colección **entera** de actividades?
   *
   * Es la pregunta de la trampa 7 y no una preferencia de UI: con la regla de
   * B-888, una query sin `where('createdBy','==',uid)` **se rechaza entera** para
   * un publicador — no devuelve un subconjunto. Así que esto decide la forma de
   * la query del listado y del calendario, no qué se muestra después.
   */
  veTodoElCatalogo: boolean;
  /**
   * ¿Puede escribir en `/opciones/*` (crear una etiqueta con "Otro", contar
   * `usos`)?
   *
   * `false` para el publicador porque `/opciones/{campo}` es un documento
   * **compartido por todo el sitio** y las reglas no pueden inspeccionar qué
   * elemento del array `valores` cambió: darle `write` no sería «puede agregar
   * una opción», sería «puede reescribir la taxonomía entera». Está argumentado
   * en `firestore.rules`.
   *
   * B-893 — que sea `false` **ya no quiere decir que no crea etiquetas**: quiere
   * decir que no las crea **escribiendo el documento**. Eso lo dice
   * `creaEtiquetas`.
   */
  escribeTaxonomias: boolean;
  /**
   * ¿Se le ofrece «Otro…» para crear una etiqueta? — B-893, D-810.
   *
   * Es una pregunta distinta de `escribeTaxonomias`, y por eso es otro campo: el
   * publicador **crea** etiquetas pero **no escribe** `/opciones/*`; las crea por
   * la callable `crearOpcionDelPanel`, que verifica del lado del servidor que lo
   * único que agrega es un elemento sin aprobar. Con los dos datos en uno, el día
   * que entre un rol que no deba crear nada habría que elegir entre romperle el
   * panel al publicador o abrirle la puerta al nuevo.
   */
  creaEtiquetas: boolean;
  /**
   * ¿Puede leer el directorio `/usuarios` completo?
   *
   * Es lo que pinta el filtro «quién la cargó» y el mail en la marca de autoría.
   * Un publicador lee **el suyo** por id, y una condición por ruta no es
   * satisfacible en un `list`, así que pedir el directorio le devuelve un
   * `permission-denied` limpio (ver `src/lib/usuarios.ts`).
   */
  leeElDirectorio: boolean;
}

/**
 * **El publicador solo ve su listado y el calendario** —pedido del dueño— y las
 * tres pantallas de trabajo sobre una actividad (cargar, editar, duplicar).
 *
 * Lo que queda afuera no es simetría: cada una está cerrada en las reglas por un
 * motivo propio, y acá la UI dice lo mismo en vez de contradecirla.
 *
 *  - `reportes` y `propuestas` llevan el mail de otra cuenta y el contacto de un
 *    tercero, y revisar propuestas es decidir qué entra al catálogo — la única
 *    autoridad que este rol no tiene, porque lo suyo sale sin revisión.
 *  - `taxonomias` es la taxonomía compartida del sitio.
 *  - `estadisticas` lee `/sistema/analitica-sitio`, que trae las consultas con
 *    las que Google nos muestra (texto que tipearon visitantes).
 *  - `historial` es la subcolección `versiones`, que la regla del padre **no**
 *    cascadea y que se quedó en `esAdmin()`.
 *  - `convertir` es la segunda mitad de la bandeja de propuestas: sin bandeja no
 *    hay a dónde llegar, y dejarlo abierto sería una puerta sin puerta de calle.
 */
export const PERMISOS: Record<RolDelPanel, PermisosDelPanel> = {
  admin: {
    pantallas: PANTALLAS_DEL_PANEL,
    veTodoElCatalogo: true,
    escribeTaxonomias: true,
    creaEtiquetas: true,
    leeElDirectorio: true,
  },
  publicador: {
    /*
     * B-901 / B-832 / B-833 / B-960 — las ocho pantallas de la Guía
     * (`librerias`, `libreria`, `suscripciones`, `suscripcion`, `lugares`,
     * `lugar`, `bibliotecas`, `biblioteca`)
     * **no** entran, y es la misma decisión que las reglas ya tomaron: las cinco cláusulas de `/librerias` se quedan en
     * `esAdmin()` porque una ficha de directorio no tiene «dueño» que recortar,
     * decidir qué entra al catálogo es la autoridad que este rol no tiene, y el
     * documento lleva el contacto de un tercero. Acá la UI dice lo mismo en vez
     * de ofrecer un botón que la regla va a rechazar.
     */
    pantallas: ['lista', 'nueva', 'editar', 'duplicar', 'calendario'],
    veTodoElCatalogo: false,
    escribeTaxonomias: false,
    // B-893 — por la callable: nacen sin aprobar y no le aparecen a nadie más
    // hasta que el admin las apruebe (D-810).
    creaEtiquetas: true,
    leeElDirectorio: false,
  },
};

export const puedeVer = (rol: RolDelPanel, pantalla: PantallaDelPanel): boolean =>
  PERMISOS[rol].pantallas.includes(pantalla);

/**
 * El rol que le corresponde a un token, o `null` si no tiene ninguno de los dos
 * claims.
 *
 * **El publicador gana cuando están los dos claims**, y esto no es una
 * preferencia: es la paridad con `esAdmin()` de `firestore.rules`, que exige
 * además **no** ser publicador. Si acá el admin ganara, el panel le dibujaría
 * todas las pantallas a una cuenta que las reglas van a tratar como acotada, y
 * cada botón sería un `permission-denied` — o sea exactamente el «botón que
 * siempre falla» que este módulo existe para que no haya.
 *
 * Ese estado solo sale de un error del operador (`setCustomUserClaims` reemplaza
 * el objeto entero, así que `scripts/set-admin-claim.mjs` no puede crearlo),
 * pero sí se puede tocar a mano en la consola, y las dos mitades hacen falta.
 * `tests/rol-del-panel.test.ts` lo fija leyendo la regla, para que las dos no se
 * puedan separar en silencio.
 */
export const rolDeClaims = (claims: Record<string, unknown> | null | undefined): RolDelPanel | null => {
  if (claims?.publicador === true) return 'publicador';
  if (claims?.admin === true) return 'admin';
  return null;
};

/**
 * **La ciudad del claim** — B-919, D-690. `''` cuando no hay ninguna.
 *
 * Es el alcance de lectura del publicador: además de lo suyo, ve las actividades
 * cuya `ciudades` contiene este slug (`firestore.rules`, `/actividades`).
 *
 * ── Tres decisiones, y las tres importan ──────────────────────────────────
 *  - **Verbatim, sin volver a slugificar.** El slug lo produce
 *    `scripts/set-admin-claim.mjs` con el `slugify` del proyecto, y la regla
 *    compara el claim **tal cual**. Normalizarlo acá otra vez haría que el panel
 *    consulte por un valor y la regla evalúe otro: la query de la ciudad pasaría
 *    a pedir algo que el disyunto no autoriza y **se rechazaría entera**
 *    (trampa 7). Lo que el panel pregunta tiene que ser, byte por byte, lo que la
 *    regla va a mirar.
 *  - **Solo para el publicador.** Un admin ve todo el catálogo, así que su ciudad
 *    —si alguien se la puso— no significa nada y devolverla sería ofrecerle a
 *    `listarActividades` un filtro que no corresponde.
 *  - **`''` y no `null`**, para que quien la reciba no tenga que decidir un
 *    default: `''` es «sin alcance por ciudad», y `listarActividades` no arma la
 *    segunda consulta.
 */
/**
 * Lo que una sesión del panel sabe de sí misma — B-919. `rol: null` es «no tiene
 * ninguno de los dos claims» (la pantalla «Sin permisos»).
 */
export interface SesionDelPanel {
  rol: RolDelPanel | null;
  /** El slug del claim `ciudad`, o `''`. Solo significa algo para un publicador. */
  ciudad: string;
}

export const ciudadDeClaims = (claims: Record<string, unknown> | null | undefined): string => {
  if (rolDeClaims(claims) !== 'publicador') return '';
  const ciudad = claims?.ciudad;
  return typeof ciudad === 'string' ? ciudad : '';
};
