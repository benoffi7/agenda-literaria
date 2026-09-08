/**
 * Un documento de actividad donde **cada string es un centinela** (B-196).
 *
 * ── Por qué existe este archivo ────────────────────────────────────────────
 * Los tests de privacidad del `events.json` y del evento de Calendar eran una
 * **lista de campos conocidos**: `zoom.us/j/secreto`, `coordinar con prensa`,
 * `drive/privado`, `evt_secreto`, `uid_abc`. Eso cubre lo que se conocía el día
 * que se escribieron, no la propiedad — **el campo nuevo que nadie agregue a la
 * lista se publica sin que nada se ponga rojo**. Y `construirDescripcion` arma
 * la descripción con ~15 interpolaciones a mano, que es justo donde un campo se
 * cuela por descuido.
 *
 * Acá el documento entero es centinelas, y la afirmación se hace sobre la
 * salida: sobreviven **exactamente** los centinelas que el §5.2 permite
 * (`tests/barrido-de-salidas-publicas.test.ts`). Un campo nuevo nace en este
 * fixture —lo obliga el chequeo de cobertura contra `src/types/actividad.ts`— y
 * si se publica sin estar permitido, falla nombrándolo.
 *
 * Es el mismo truco que ya usan las otras dos salidas públicas: el barrido de
 * la analítica (`tests/analytics-privacidad.test.ts`, con
 * `tests/fixtures/formulario.ts`) y el del issue de GitHub
 * (`tests/clases-de-bug.test.ts`).
 *
 * ── Dos reglas de forma, y las dos son load-bearing ────────────────────────
 * 1. **El valor dice la ruta.** El centinela de `difusion.notas` es
 *    `CENTINELA.difusion.notas`, así que el mensaje de falla nombra el campo
 *    que se escapó sin que haya que traducir nada.
 * 2. **Todos son URL-safe** (letras, dígitos, `.`, `_`, `-`): `encodeURIComponent`
 *    los deja igual. El evento arma el link del mapa con
 *    `encodeURIComponent(ubicación)`, y si un centinela llevara espacios su
 *    forma escapada no coincidiría con la que se busca — una fuga por ese
 *    camino quedaría invisible.
 *
 * ── Este fixture no es `formulario.ts` ─────────────────────────────────────
 * Aquél es un `ActividadForm` (fechas como string, sin campos de auditoría) y
 * mide la analítica del panel. Éste es el **documento de Firestore** tal como
 * lo leen el build y la Function: con `Timestamp`, con `createdBy`/`updatedBy`,
 * y con las dos claves que ninguna pantalla escribe (`calendarEventId`,
 * `storagePath`).
 */
import type {
  Actividad,
  Comision,
  Imagen,
  ModalidadFila,
  Online,
  Sede,
  ValorOpcion,
} from '@/types/actividad';

// B-211 — el doble de `Timestamp` sale de `./tiempo`, no de una copia por
// fixture. Esta era la más completa de las cuatro formas que convivían, y es la
// que quedó como base.
import { ts } from './tiempo';

/**
 * Cada ruta de contenido del documento, más las etiquetas de `/opciones/*` que
 * la Function recibe aparte (`labels`).
 *
 * **Es la lista que hay que tocar al agregar un campo**, y no hace falta
 * acordarse: el chequeo de cobertura del barrido compara este fixture contra
 * las interfaces de `src/types/actividad.ts` y falla si falta una clave.
 */
const RUTAS = [
  // Identidad y texto de la actividad.
  'titulo',
  'slug',
  'descripcion',
  'searchText',

  // Galería (B-167, D-125) y el campo viejo que reemplazó.
  'imagenUrl',
  'imagenes.id',
  'imagenes.url',
  'imagenes.epigrafe',
  // B-301 / D-440 — el texto alternativo de la portada. Es público a propósito
  // (es el `alt` que la página pinta), así que su celda va en la lista de
  // permitidos del `events.json` y no en la de ausentes.
  'imagenes.textoAlternativo',
  'imagenes.storagePath',

  // Quién.
  'organizador.nombre',
  'organizador.instagram',
  'organizador.web',
  'tallerista.nombre',
  'tallerista.bio',
  'tallerista.instagram',

  // La obra que se presenta (DEC-1, D-126).
  'libro.titulo',
  'libro.autor',

  // Encuentros.
  'sesiones.id',
  'sesiones.tema',
  'sesiones.lectura',
  'sesiones.calendarEventId',
  /*
   * Las opciones para sumarse (B-181). Las dos rutas son públicas a propósito y
   * cada una por su motivo, así que van con centinelas separados:
   *
   * - `comisiones.etiqueta` es el texto que se muestra («Martes 19 h»): sale al
   *   título del evento, a la página y al `subEvent` del JSON-LD.
   * - `comisiones.id` es el uuid que ata cada encuentro a su grupo. Es un id
   *   interno —la clase de dato que el §5.1 mira con lupa— y sale porque sin él
   *   la página tiene las etiquetas y no sabe qué encuentro va con cuál. Mismo
   *   argumento que `sesiones.id` en el `url` de cada `subEvent` (B-733).
   *
   * `sesiones.comisionId` **no tiene ruta propia**: su valor *es* `comisiones.id`
   * —es una referencia, no un dato— y darle un centinela distinto haría que el
   * fixture describa un documento imposible (un encuentro apuntando a una
   * comisión que no existe), que es justo lo que el schema rechaza.
   */
  'comisiones.id',
  'comisiones.etiqueta',

  // Dónde: la forma de cursar (B-224). `sede` y `online` viven adentro de la
  // fila, y los de primer nivel son los **derivados** que escribe
  // `formADocumento` — los mismos objetos, así que comparten centinela.
  'modalidades.id',
  // La **segunda** forma de cursar (B-224). Tiene centinelas propios porque el
  // caso que el cambio hace posible —dos filas, con el flag del link distinto en
  // cada una— no se puede ver con una sola: `onlinePrincipal` deriva del primero,
  // así que un cambio que tratara distinto a la fila 2 no daría rojo.
  'modalidades.2.id',
  'modalidades.2.sede.nombre',
  'modalidades.2.sede.direccion',
  'modalidades.2.online.plataforma',
  'modalidades.2.online.url',
  'sede.nombre',
  'sede.direccion',
  'sede.barrio',
  'sede.ciudad',
  'sede.indicaciones',
  'online.plataforma',
  'online.url',

  // Inscripción y arancel.
  'inscripcion.destino',
  'arancel.tipo',
  'arancel.notas',
  /*
   * **`arancel.monto` NO está en esta lista, y es una decisión** — B-114. Los
   * centinelas de acá son strings (`CENTINELA.<ruta>`) y el monto es un **entero**:
   * meterlo en `RUTAS` hacía que el barrido buscara el texto
   * `'CENTINELA.arancel.monto'`, que ninguna salida puede contener nunca — o sea
   * un chequeo que pasa **siempre**, esté la fuga o no.
   *
   * El campo entra al fixture igual (`monto: MONTO_CENTINELA`, que es lo que el
   * chequeo de cobertura de interfaces exige) y lo que lo mira es un `describe`
   * propio en el barrido, que afirma las dos formas en que puede salir: el número
   * crudo en las salidas JSON y `$987.654` en las de texto.
   */

  // Material: un item público y uno privado, con centinelas separados, porque
  // de uno sobrevive la URL y del otro no (§5.2).
  'material.titulo.publico',
  'material.url.publico',
  'material.titulo.privado',
  'material.url.privado',
  // B-342 — el id de cliente. Uno solo y sufijado con el índice (como
  // `sesiones.id`): son dos items y el barrido busca por substring.
  'material.id',

  // Difusión: interno, nunca público (§3.2, §5.1).
  'difusion.arrobar',
  'difusion.notas',

  'tags',

  // Auditoría: uids (§5.1).
  'createdBy',
  'updatedBy',

  // Etiquetas de `/opciones/*`. No son del documento: la Function las recibe
  // como segundo argumento y el evento muestra la etiqueta, no el slug crudo.
  'labels.tipo',
  'labels.barrio',
  'labels.plataforma',
  'labels.arancel',
  'labels.tags',

  // B-212 — el documento de `/opciones/{campo}` es una salida pública propia
  // desde que existe `opcionesPublicas`, y hasta ahora `ValorOpcion` estaba en
  // la lista de interfaces AJENAS del barrido. Con estas rutas, un campo nuevo
  // en la taxonomía tiene que decidir si sale.
  'opcion.slug',
  'opcion.label',
  'opcion.huellaCreador',
] as const;

export type RutaCentinela = (typeof RUTAS)[number];

/** `titulo` → `CENTINELA.titulo`. El valor dice de qué campo salió. */
/**
 * El monto del arancel, que es el único campo **numérico** con centinela — B-114.
 *
 * Un centinela de texto no sirve: el schema declara `arancel.monto` como entero
 * positivo, así que un string haría fallar la validación en vez de medir a dónde
 * llega el dato. `987654` no aparece en ningún otro lugar del fixture ni del
 * repo, y eso es lo que lo hace un centinela: si el barrido lo encuentra en una
 * salida, salió de acá.
 */
export const MONTO_CENTINELA = 987654;

export const CENTINELA = Object.fromEntries(
  RUTAS.map((r) => [r, `CENTINELA.${r}`]),
) as Record<RutaCentinela, string>;

/** Todas las rutas, para recorrerlas en el barrido. */
export const RUTAS_CENTINELA: readonly RutaCentinela[] = RUTAS;

/**
 * Vocabulario cerrado: los strings del fixture que **no** son centinelas.
 *
 * Son enums del modelo (`src/types/actividad.ts`) y no contenido cargado por
 * nadie: publicarlos no filtra nada, y hacerlos centinelas obligaría a castear
 * el fixture y perdería la verificación de tipos. El barrido exige que todo
 * string del fixture esté acá o lleve un centinela: así un campo nuevo de texto
 * libre no puede entrar al fixture con un valor inocente.
 */
export const VOCABULARIO_CERRADO: readonly string[] = [
  // tipo
  'presentacion',
  // modalidad — `hibrido` a propósito: es el único valor con el que la
  // descripción del evento arma **los dos** bloques, sede y online.
  'hibrido',
  // estado — publicado, si no el evento no existe (§7.3) y no habría qué barrer.
  'publicado',
  // inscripcion.via
  'mail',
  // material.items[].tipo
  'lectura',
  'guia',
  // material.items[].entrega
  'previo',
  'al-inscribirse',
  // imagenes[].origen
  'propia',
];

/** Cuántos encuentros trae el ciclo del fixture (§2.2). */
export const ENCUENTROS = 8;

const SEMANA_MS = 7 * 86_400_000;
const PRIMER_INICIO_UTC = Date.UTC(2026, 8, 3, 22);

/**
 * Los encuentros. Todos con tema y lectura cargados: el barrido afirma que esos
 * dos centinelas **sí** salen, y una sesión con `null` haría pasar esa mitad de
 * la aserción por casualidad.
 *
 * Los ids llevan el centinela adentro (`ses_CENTINELA.sesiones.id.3`), así se
 * conserva la forma del §3.1 y el barrido igual los encuentra por substring.
 */
const sesionesCentinela = (): Actividad['sesiones'] =>
  Array.from({ length: ENCUENTROS }, (_, i) => {
    const inicio = PRIMER_INICIO_UTC + i * SEMANA_MS;
    return {
      id: `ses_${CENTINELA['sesiones.id']}.${i + 1}`,
      inicio: ts(new Date(inicio).toISOString()),
      fin: ts(new Date(inicio + 120 * 60_000).toISOString()),
      tema: CENTINELA['sesiones.tema'],
      lectura: CENTINELA['sesiones.lectura'],
      cancelada: false,
      calendarEventId: `${CENTINELA['sesiones.calendarEventId']}.${i + 1}`,
      /*
       * B-181 — **todos** los encuentros del fixture van en la misma comisión, y
       * eso es lo que el schema exige cuando hay comisiones (si hay, cada
       * encuentro pertenece a una). Repartirlos entre dos habría dado un fixture
       * más rico, y también uno donde el grupo de cada comisión tiene la mitad de
       * las fechas: el barrido afirma sobre las salidas de **todos** los
       * encuentros, y perder la mitad en cada grupo debilita esas aserciones.
       */
      comisionId: `com_${CENTINELA['comisiones.id']}`,
    };
  });

/**
 * La comisión del fixture (B-181). Una sola: con dos, el barrido tendría que
 * decidir cuál mirar en cada salida, y lo que se está verificando —que la
 * etiqueta y el id salgan solo donde se decidió— no necesita la segunda.
 */
const comisionCentinela = (): Comision => ({
  id: `com_${CENTINELA['comisiones.id']}`,
  etiqueta: CENTINELA['comisiones.etiqueta'],
});

const imagenCentinela = (): Imagen => ({
  id: `img_${CENTINELA['imagenes.id']}`,
  url: CENTINELA['imagenes.url'],
  epigrafe: CENTINELA['imagenes.epigrafe'],
  // B-301 — cargado, no vacío: el barrido afirma que este centinela **sí** sale
  // al `events.json`, y una cadena vacía haría pasar esa mitad por casualidad
  // (mismo cuidado que `tema`/`lectura` de las sesiones).
  textoAlternativo: CENTINELA['imagenes.textoAlternativo'],
  origen: 'propia',
  // §5.1 — la ruta del bucket no sale. Es la única clave de `Imagen` que el
  // fixture pone para que **no** aparezca.
  storagePath: CENTINELA['imagenes.storagePath'],
  ancho: 1200,
  alto: 800,
  portada: true,
});

/**
 * La sede **sin coordenadas**, a propósito: sin `geo`, el link del mapa se arma
 * con la dirección pasada por `encodeURIComponent`. Es el único lugar donde un
 * centinela sale escapado, y es lo que hace que la regla "todos URL-safe" sea
 * verificable en vez de decorativa.
 */
const onlineCentinela = (): Online => ({
  plataforma: CENTINELA['online.plataforma'],
  url: CENTINELA['online.url'],
  // El default del §5.1: el link de la reunión no se publica (trampa 5). El
  // caso `urlPublica: true` es su propio caso del barrido.
  urlPublica: false,
});

/**
 * La forma de cursar (B-224). **Una sola fila, y `hibrido`**: con una sola, todo
 * lo que sale es exactamente lo que salía antes de que las modalidades fueran una
 * lista, así que el barrido sigue midiendo la misma superficie; y con `hibrido`
 * la fila arma **los dos** bloques, sede y online.
 *
 * Lleva las dos fechas cargadas a propósito, aunque no tengan centinela —un
 * `Timestamp` no puede llevarlo—: son las que **no** tienen que salir a ninguna
 * salida pública, y `tests/modalidades.test.ts` lo afirma buscándolas por su
 * valor.
 */
const modalidadCentinela = (): ModalidadFila => ({
  id: `mod_${CENTINELA['modalidades.id']}`,
  modalidad: 'hibrido',
  inicio: ts('2026-03-03T22:00:00Z'),
  fin: ts('2026-06-30T22:00:00Z'),
  sede: sedeCentinela(),
  online: onlineCentinela(),
});

const sedeCentinela = (): Sede => ({
  nombre: CENTINELA['sede.nombre'],
  direccion: CENTINELA['sede.direccion'],
  barrio: CENTINELA['sede.barrio'],
  ciudad: CENTINELA['sede.ciudad'],
  indicaciones: CENTINELA['sede.indicaciones'],
  geo: null,
});

/**
 * El documento completo, con centinelas en todo string.
 *
 * `tipo: 'presentacion'` para que corran las dos ramas que solo existen ahí: el
 * bloque del libro (DEC-1) y el rótulo «Invitado» del §11.
 */
export const actividadCentinela = (over: Partial<Actividad> = {}): Actividad => ({
  tipo: 'presentacion',
  titulo: CENTINELA.titulo,
  slug: CENTINELA.slug,
  descripcion: CENTINELA.descripcion,
  imagenes: [imagenCentinela()],
  // El campo viejo (B-167): con `imagenes` cargado no se mira, así que en el
  // caso base su centinela **no** puede aparecer. El caso legacy lo invierte.
  imagenUrl: null,
  organizador: {
    nombre: CENTINELA['organizador.nombre'],
    instagram: CENTINELA['organizador.instagram'],
    web: CENTINELA['organizador.web'],
  },
  tallerista: {
    nombre: CENTINELA['tallerista.nombre'],
    bio: CENTINELA['tallerista.bio'],
    instagram: CENTINELA['tallerista.instagram'],
  },
  libro: { titulo: CENTINELA['libro.titulo'], autor: CENTINELA['libro.autor'] },
  esCiclo: true,
  sesiones: sesionesCentinela(),
  comisiones: [comisionCentinela()],
  modalidades: [modalidadCentinela()],
  // Los tres derivados que escribe `formADocumento` (B-224): con una sola fila
  // son exactamente lo que la fila dice. Se arman con las mismas fábricas para
  // que el fixture no pueda mentir sobre la derivación.
  modalidad: 'hibrido',
  sede: sedeCentinela(),
  online: onlineCentinela(),
  inscripcion: {
    requiere: true,
    via: 'mail',
    destino: CENTINELA['inscripcion.destino'],
    cupo: 12,
    cierra: ts('2026-09-01T12:00:00Z'),
    // B-97 / D-127 — prendido: así la línea «Cupo completo» existe en el evento
    // y `completo: true` viaja al JSON. Un booleano no admite centinela.
    completo: true,
  },
  arancel: {
    tipo: CENTINELA['arancel.tipo'],
    notas: CENTINELA['arancel.notas'],
    /*
     * B-114 — un monto que no se confunde con nada: `987654` no aparece en ningún
     * otro lado del fixture, así que si el barrido lo encuentra en una salida es
     * porque **este** campo salió por ahí. Y no puede ser un string: el schema lo
     * declara entero, y un `'centinela'` en un campo numérico haría fallar la
     * validación en vez de medir la salida.
     *
     * El tipo de arancel del fixture es un centinela y por lo tanto **no** está en
     * `SIN_COSTO`, así que `admiteMonto` lo deja pasar: el monto sale a las
     * salidas que lo publican, que es lo que hay que poder medir.
     */
    monto: MONTO_CENTINELA,
  },
  material: {
    tiene: true,
    items: [
      {
        // B-342 — id de cliente, nunca por índice (trampa 2).
        id: `mat_${CENTINELA['material.id']}.1`,
        tipo: 'lectura',
        titulo: CENTINELA['material.titulo.publico'],
        url: CENTINELA['material.url.publico'],
        entrega: 'previo',
        publico: true,
      },
      {
        id: `mat_${CENTINELA['material.id']}.2`,
        tipo: 'guia',
        titulo: CENTINELA['material.titulo.privado'],
        url: CENTINELA['material.url.privado'],
        entrega: 'al-inscribirse',
        publico: false,
      },
    ],
  },
  difusion: {
    arrobar: [CENTINELA['difusion.arrobar']],
    notas: CENTINELA['difusion.notas'],
  },
  estado: 'publicado',
  /*
   * B-285 — la marca de «estuvo publicada alguna vez». **No lleva centinela
   * porque es un booleano** —no hay string donde esconder contenido— y que no
   * salga se afirma comparando el JSON con el resto del barrido, no buscando un
   * valor. Está en el fixture igual, y por la razón de siempre: un campo que el
   * fixture no tiene no lo mira ningún barrido.
   *
   * En `true` a propósito: el caso interesante es una actividad **marcada** que
   * igual no publica el campo. Con `false` o ausente, «no aparece en el JSON»
   * pasaría por casualidad.
   */
  publicadaAlgunaVez: true,
  tags: [CENTINELA.tags],
  destacado: true,
  searchText: CENTINELA.searchText,
  createdAt: ts('2026-08-01T00:00:00Z'),
  updatedAt: ts('2026-08-02T00:00:00Z'),
  createdBy: CENTINELA.createdBy,
  updatedBy: CENTINELA.updatedBy,
  ...over,
});

/**
 * **Dos formas de cursar**, con el link de la segunda publicado a mano y el de la
 * primera no (B-224).
 *
 * Es el caso que la lista hace posible y que una sola fila no puede ver: los
 * derivados salen de la **primera** fila, así que un cambio que leyera el flag del
 * derivado —o que copiara la fila con un spread— publicaría el link de la segunda
 * sin que nada se ponga rojo. Acá el barrido lo exige: sale el link de la segunda
 * y **no** el de la primera.
 *
 * La segunda fila es `virtual` a propósito: así los derivados siguen siendo los de
 * la primera (`sedePrincipal` la encuentra ahí) y el contraste queda limpio.
 */
export const conDosFormasDeCursar = (): Partial<Actividad> => {
  const segunda: ModalidadFila = {
    id: `mod_${CENTINELA['modalidades.2.id']}`,
    modalidad: 'virtual',
    inicio: null,
    fin: null,
    sede: null,
    online: {
      plataforma: CENTINELA['modalidades.2.online.plataforma'],
      url: CENTINELA['modalidades.2.online.url'],
      // El que SÍ se publica. El de la primera fila queda en `false`.
      urlPublica: true,
    },
  };
  return { modalidades: [modalidadCentinela(), segunda] };
};

/**
 * Una segunda fila **presencial**, con su propia sede. Sirve para el caso en que
 * las dos filas tienen lugar y hay que ver que salen las dos direcciones.
 */
export const conDosSedes = (): Partial<Actividad> => {
  const segunda: ModalidadFila = {
    id: `mod_${CENTINELA['modalidades.2.id']}`,
    modalidad: 'presencial',
    inicio: null,
    fin: null,
    sede: {
      nombre: CENTINELA['modalidades.2.sede.nombre'],
      direccion: CENTINELA['modalidades.2.sede.direccion'],
      barrio: CENTINELA['sede.barrio'],
      ciudad: CENTINELA['sede.ciudad'],
      indicaciones: CENTINELA['sede.indicaciones'],
      geo: null,
    },
    online: null,
  };
  return { modalidades: [modalidadCentinela(), segunda] };
};

/**
 * El caso «el dueño tildó publicar el link» (D-15), con la fila **y** el derivado
 * a la vez.
 *
 * Existe como fábrica y no como dos overrides sueltos porque desde B-224 el flag
 * vive adentro de la fila y `online` de primer nivel es su derivado: tocar uno
 * solo arma un documento que `formADocumento` nunca produciría, y el barrido
 * mediría una salida que no existe.
 */
export const conLinkPublico = (): Partial<Actividad> => {
  const online: Online = { ...onlineCentinela(), urlPublica: true };
  const fila = { ...modalidadCentinela(), online };
  return { modalidades: [fila], online };
};

/**
 * Las etiquetas de `/opciones/*` que la Function recibe aparte (§4.1): la
 * actividad guarda el slug y el evento tiene que mostrar la etiqueta, porque
 * "a-la-gorra" crudo en un calendario público se ve roto.
 *
 * Las claves son los centinelas de los slugs, así que el barrido puede afirmar
 * las dos mitades: la etiqueta sale y el slug **no**.
 */
export const LABELS_CENTINELA: Record<string, Record<string, string>> = {
  tipo: { presentacion: CENTINELA['labels.tipo'] },
  barrio: { [CENTINELA['sede.barrio']]: CENTINELA['labels.barrio'] },
  plataforma: { [CENTINELA['online.plataforma']]: CENTINELA['labels.plataforma'] },
  arancel: { [CENTINELA['arancel.tipo']]: CENTINELA['labels.arancel'] },
  tags: { [CENTINELA.tags]: CENTINELA['labels.tags'] },
};

/**
 * Una opción de taxonomía con centinela en cada campo que puede llevar
 * contenido — B-212.
 *
 * `/opciones/{campo}` es de **lectura pública** (§5.3) y sus valores viajan al
 * `events.json` (§4.4), así que es una salida con sus propias celdas que decidir.
 * `ValorOpcion` estuvo en la lista de interfaces AJENAS del barrido hasta que
 * existió `opcionesPublicas`, y eso significaba que el único consumidor nuevo ya
 * planificado nacía fuera de la red.
 *
 * Los tres campos con centinela son los que pueden llevar algo identificable:
 * `slug` y `label` (que **sí** salen, §4.4) y `huellaCreador` (que **no**: es un
 * identificador estable de una persona, aunque sea una huella y no un uid, D-27).
 * `orden`, `fijo`, `usos`, `aprobada` y `aprobadaPorReuso` no llevan centinela
 * porque son números y booleanos — no hay string donde esconder contenido; que no
 * salgan se afirma comparando las claves de la salida, no buscando un valor.
 */
export const opcionCentinela = (over: Partial<ValorOpcion> = {}): ValorOpcion => ({
  slug: CENTINELA['opcion.slug'],
  label: CENTINELA['opcion.label'],
  orden: 7,
  fijo: false,
  usos: 3,
  aprobada: true,
  /*
   * B-29 — «la aprobó el reuso de la otra cuenta». Está en el fixture por la
   * razón de siempre: un campo que el fixture no tiene no lo mira ningún barrido.
   * Sin centinela porque es un booleano, como `aprobada`: que no salga lo fija el
   * chequeo de claves de la proyección, no la búsqueda de un valor.
   *
   * Y no identifica a nadie —a diferencia de `huellaCreador`, que es la razón por
   * la que esta interfaz entró al barrido—: dice algo de la **etiqueta**, no de
   * quién la escribió. Que igual no salga es la regla de la whitelist: sale lo
   * que el sitio necesita, no lo que el documento tiene.
   */
  aprobadaPorReuso: false,
  huellaCreador: CENTINELA['opcion.huellaCreador'],
  /*
   * D-150 — el matiz elegido. No lleva centinela porque es un número: el barrido
   * de cadenas no lo puede ver, así que lo fija el chequeo de claves del
   * `barrido-de-salidas-publicas` (`['label', 'slug', 'tono']`). Está en el
   * fixture igual, y por la razón de siempre: un campo que el fixture no tiene no
   * lo mira ningún barrido.
   */
  tono: 195,
  ...over,
});
