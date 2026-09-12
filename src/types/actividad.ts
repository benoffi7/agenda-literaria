/**
 * Modelo de datos — §3 de CLAUDE.md.
 * Los nombres de campo van en español, coherente con el dominio (§14).
 */

/** `Timestamp` de Firestore. Se tipa laxo para no acoplar cliente y Admin SDK. */
export interface TimestampLike {
  toDate(): Date;
  toMillis(): number;
  seconds: number;
  nanoseconds: number;
}

export const TIPOS_ACTIVIDAD = [
  'taller',
  'club-lectura',
  'encuentro',
  'presentacion',
  'charla',
] as const;
export type TipoActividad = (typeof TIPOS_ACTIVIDAD)[number];

export const MODALIDADES = ['presencial', 'virtual', 'hibrido'] as const;
export type Modalidad = (typeof MODALIDADES)[number];

export const ESTADOS = ['borrador', 'pendiente', 'publicado', 'cancelado'] as const;
export type Estado = (typeof ESTADOS)[number];

export const VIAS_INSCRIPCION = ['mail', 'whatsapp', 'dm', 'formulario'] as const;
export type ViaInscripcion = (typeof VIAS_INSCRIPCION)[number];

/**
 * Los formatos de material de un club de lectura (B-134).
 *
 * **No se agregó `libro`, y no es un olvido.** El reporte que abrió esto lo
 * nombra —"son varias cosas: libro, newsletters, guía, playlist"— pero `lectura`
 * ya es eso: el texto asignado. Tener las dos partiría los datos existentes en
 * dos valores que después no se pueden volver a juntar, porque nadie va a saber
 * cuál eligió cada uno. Se cambió la **etiqueta** a "Libro o lectura", que es
 * reversible; agregar el valor no lo es.
 *
 * `newsletter` y `playlist` sí son formatos nuevos: no entraban en ninguno.
 */
export const TIPOS_MATERIAL = [
  'lectura',
  'guia',
  'contexto',
  'autor',
  'newsletter',
  'playlist',
  'otro',
] as const;
export type TipoMaterial = (typeof TIPOS_MATERIAL)[number];

/**
 * Cuándo llega el material. Sigue **cerrado** a propósito, a diferencia de las
 * taxonomías del §4: son momentos del ciclo de vida de la inscripción, no
 * vocabulario libre, y el §5.1 los usa para decidir qué se publica.
 *
 * `durante-el-mes` es el pedido concreto del dueño (B-134), y dice algo del
 * dominio: la entrega no siempre es un instante, puede ser progresiva a lo largo
 * del ciclo. Encaja con el §2.2 —ocho encuentros con su lectura cada uno.
 */
export const ENTREGAS_MATERIAL = [
  'previo',
  'al-inscribirse',
  'durante-el-mes',
  'en-el-encuentro',
] as const;
export type EntregaMaterial = (typeof ENTREGAS_MATERIAL)[number];

export interface Organizador {
  nombre: string;
  instagram: string;
  web: string;
}

/** Tallerista, o autor invitado en presentaciones y charlas (§11). */
export interface Persona {
  nombre: string;
  bio: string;
  instagram: string;
}

/**
 * La obra que se presenta (DEC-1). Aparece en `presentacion` y `charla`, los
 * mismos dos tipos que abren el bloque de autor invitado (§11).
 *
 * **Es un campo propio y no un párrafo de la descripción**: así se puede mostrar
 * aparte, buscar por él (entra al `searchText` del §6) y filtrar más adelante.
 * Hasta acá una presentación cargaba el autor en `tallerista` y el título del
 * libro quedaba enterrado en la descripción, donde nada lo puede leer.
 */
export interface Libro {
  /** Título de la obra. Es lo que identifica al libro; sin esto no hay libro. */
  titulo: string;
  /**
   * Autor de la obra, **solo si difiere del invitado** que ya está en
   * `tallerista`. En una presentación normal el autor es el invitado y este
   * campo queda vacío; se llena cuando se presenta a un tercero (una traducción,
   * una antología, un autor que no viene o que ya murió).
   */
  autor: string;
}

export interface Sesion {
  /** `ses_<uuid>` — generado en cliente, NUNCA por índice (§3.1, trampa 2). */
  id: string;
  inicio: TimestampLike;
  /** La duración del encuentro sale de acá. */
  fin: TimestampLike;
  tema: string | null;
  lectura: string | null;
  cancelada: boolean;
  calendarEventId: string | null;
  /**
   * **De qué comisión es este encuentro** — B-181. `null` o ausente es «el ciclo
   * no tiene comisiones», que es el caso de todas las actividades de hoy.
   *
   * Apunta a `Actividad.comisiones[].id`, y el schema exige que exista: un
   * `comisionId` colgado deja un encuentro que el panel no sabe dónde poner y que
   * el evento numeraría contra un conjunto que no es el suyo.
   */
  comisionId?: string | null;
}

/**
 * **Una comisión del ciclo** — B-181, el eje que el modelo no podía expresar.
 *
 * Reporte del dueño usando el panel (2026-08-25): «un club de lectura puede
 * darte 4 opciones para sumarte. Pero no son 4 encuentros, sino opciones».
 *
 * `sesiones` es una **secuencia** (§2.2): N filas son N encuentros que pasan
 * todos y quien se anota va a todos. Un club que abre cuatro horarios del mismo
 * ciclo —martes 19, jueves 19, sábado 11, y uno virtual— tiene cuatro grupos de
 * filas que son **alternativas excluyentes**: cada persona va a una sola.
 *
 * ── La forma: cada encuentro dice de qué comisión es ──────────────────────
 * El ítem proponía `[{ id, etiqueta, sesiones }]` —los encuentros adentro— y el
 * dueño eligió lo otro: **la lista de encuentros sigue siendo plana** y cada fila
 * lleva su `comisionId`.
 *
 * El motivo es dónde queda el riesgo. El diff contra Calendar (§7.2) es hoy un
 * `Map` por id de sesión sobre una lista plana, y es el código más delicado del
 * repo: con los encuentros anidados hay que rehacerlo, y con el `comisionId` **no
 * se toca**. Lo mismo vale para todo lo que hoy recorre `sesiones` de corrido —
 * los filtros, la tarjeta, el JSON-LD, el sitemap—. Y una actividad sin comisiones
 * queda **exactamente** como hoy, byte por byte, así que ningún evento publicado
 * se reescribe por este cambio (el argumento de D-95).
 *
 * La etiqueta es libre y no una taxonomía: «Martes 19 h», «Sábados 11 h», «Turno
 * virtual». No es un valor que se reuse entre actividades —cada club arma sus
 * horarios— así que no hay nada que curar (§4).
 *
 * ── Por qué `comisiones` y no `opciones` ──────────────────────────────────
 * El reporte del dueño dice «opciones» y las pantallas también van a decirlo
 * («Opciones para sumarse»): es la palabra del dominio para quien lee. Pero
 * **`opciones` ya está tomada en el código y significa otra cosa**: la taxonomía
 * autogestionada del §4 —la colección `/opciones/{campo}`, la clave `opciones`
 * del `events.json` (§4.4), `lib/opciones.ts`, `opciones-base.json`, el panel de
 * taxonomías—. Dos `opciones` distintas en el mismo repo, y una adentro de cada
 * actividad del mismo JSON que ya tiene la otra en la raíz, es una trampa
 * permanente para cualquier grep.
 *
 * `comisiones` es la palabra que el circuito usa para los grupos paralelos de un
 * mismo curso —«la comisión de los martes»— y es la que usó la propia decisión
 * del dueño al elegir el título del evento. El código dice `comisiones`, la
 * pantalla dice «opciones para sumarse», y las dos son correctas.
 */
export interface Comision {
  /** `com_<uuid>` — generado en cliente, NUNCA por índice (trampa 2). */
  id: string;
  /** Lo que se lee: «Martes 19 h». Libre, no es taxonomía. */
  etiqueta: string;
}

/**
 * Una forma de cursar la actividad (B-224).
 *
 * Reemplaza al `modalidad` único **y se lleva `sede` y `online` adentro**, que es
 * lo que el dueño pidió: «el formulario de modalidad se mantiene tal cual + doble
 * fecha, y sobre eso es tener N modalidades así como N encuentros». O sea: el
 * bloque entero de «Dónde» —el selector, y con él la sede o la plataforma que
 * corresponda— se repite por fila.
 *
 * El modelo es una **lista** por el mismo motivo que `sesiones` es una lista
 * (§2.2): un club puede darse presencial en una librería y virtual por Meet, y con
 * un escalar y una sola sede eso no se puede decir.
 *
 * **La fila no es un encuentro.** No genera evento de Calendar —el §2.2 es
 * taxativo: un evento por sesión— ni entra al «próximo encuentro» del listado.
 */
export interface ModalidadFila {
  /** `mod_<uuid>` — generado en cliente, NUNCA por índice (§3.1, trampa 2). */
  id: string;
  modalidad: Modalidad;
  /**
   * Desde y hasta cuándo rige esta forma de cursar. Las dos **opcionales**: es lo
   * que pidió el dueño, y `null` es «sin fecha», no «hoy».
   *
   * **Hoy no salen a ninguna salida pública, y es a propósito.** Qué significan
   * frente a `sesiones[].inicio/fin` sigue sin decidir (B-224, decisión pendiente
   * del dueño): un campo que no sale no puede filtrar nada por error, y agregarlo
   * después es barato — sacarlo de algo ya publicado no.
   */
  inicio: TimestampLike | null;
  /** Ver `inicio`. */
  fin: TimestampLike | null;
  /** La sede de esta forma de cursar. `null` en una fila virtual (§11). */
  sede: Sede | null;
  /** Los datos de la reunión de esta forma de cursar. `null` en presencial (§11). */
  online: Online | null;
}

/**
 * Una imagen de la galería (B-167, DEC-7).
 *
 * Reemplaza al `imagenUrl` único. El modelo es una **lista** porque una actividad
 * tiene el flyer, fotos del espacio y de ediciones anteriores, y B-107 necesita
 * exactamente una para Open Graph — de ahí `portada`.
 */
export interface Imagen {
  /** `img_<uuid>` — generado en cliente, NUNCA por índice (§3.1, trampa 2). */
  id: string;
  url: string;
  /**
   * Pie de foto, **opcional** (DEC-7a). No es el texto alternativo: ese es
   * `textoAlternativo`, y se pide **solo en la portada** (B-301, D-440). El
   * epígrafe se muestra debajo de la foto; el alternativo lo leen un lector de
   * pantalla y Google, y no se muestra nunca.
   */
  epigrafe: string;
  /**
   * El texto alternativo de esta imagen — B-301, **D-440**, que reabre DEC-7a.
   *
   * ── Qué cambió respecto de D-125 ──────────────────────────────────────
   * DEC-7a decidió, a propósito, que este campo **no** existiera: el alternativo
   * se derivaba del título de la actividad, con el argumento de que un campo
   * obligatorio por imagen en un panel de una persona produce «foto», que es
   * peor que un título descriptivo. El desvío del dueño (2026-09-03) acepta ese
   * argumento y le cambia el alcance: el campo existe, pero **se pide solo en la
   * portada** — la que va a Open Graph y a la tarjeta, o sea la única que se
   * comparte. Ni un campo por imagen (nadie lo llenaría en las cuatro) ni seguir
   * derivando todo del título.
   *
   * Vive en `Imagen` y no en `Actividad` porque describe **esta** imagen: si
   * mañana la portada pasa a ser otra fila, el alternativo de la anterior sigue
   * siendo cierto para ella y vuelve solo al recuperar la portada. Lo que cumple
   * «un campo solo» es el **formulario**, que lo muestra únicamente en la fila
   * que hoy es portada (§11).
   *
   * **Opcional a propósito:** los documentos que ya están en producción no lo
   * tienen, y el default de lectura de las salidas públicas es el de siempre
   * —«Imagen de {título}»—, que es exactamente el comportamiento anterior a este
   * campo (D-26). Que el tipo lo declare opcional es lo que obliga al compilador
   * a decidirlo en cada lectura.
   *
   * **Es público a propósito, y es el punto del campo** — con una salvedad que
   * el `auditor-privacidad` pidió dejar escrita: viaja en `toPublic` pero **hoy
   * no llega a ninguna salida**. El `alt` de la página lo sigue armando la
   * plantilla con el título, y el archivo que se sirve como `events.json` es el
   * índice. La celda está permitida por adelantado para el consumidor que falta;
   * ver el docblock de `ImagenPublica.textoAlternativo` en `src/lib/toPublic.ts`.
   * No dice nada de nadie: es la descripción de una imagen que ya se publica.
   */
  textoAlternativo?: string;
  /**
   * `externa` es una URL de otro lado, que se sirve tal cual desde su origen;
   * `propia` está en nuestro Storage (DEC-7c).
   *
   * **Hoy el EXIF se lo saca el panel antes de subirla**, no la Function: la
   * recompresión y la miniatura de DEC-7d son B-220 y todavía no existen. La
   * distinción importa porque el panel se puede saltear y la Function no, así que
   * quien lea esto no debe suponer una garantía de servidor que aún no hay. Ver
   * D-131 §3.
   */
  origen: 'externa' | 'propia';
  /**
   * Ruta del objeto en Storage. Solo las propias. **No sale al `events.json`**,
   * pero **no es un secreto**: la URL de descarga lo lleva URL-encodeado adentro
   * y esa URL sí se publica. Queda afuera por lo que sí es —el handle
   * autoritativo con el que el panel direcciona el objeto—, y lo que lo vuelve
   * inofensivo es que sea opaco. El razonamiento completo, que es el autoritativo,
   * está en el docblock de `imagenPublica` en `src/lib/toPublic.ts` (B-206 #1,
   * D-131).
   */
  storagePath?: string;
  ancho?: number;
  alto?: number;
  /** Exactamente una por actividad: es la que va a Open Graph y a la tarjeta. */
  portada: boolean;
}

export interface Sede {
  nombre: string;
  direccion: string;
  barrio: string;
  ciudad: string;
  indicaciones: string;
  geo: { lat: number; lng: number } | null;
}

export interface Online {
  plataforma: string;
  url: string;
  /** ¿El link se puede publicar? Por defecto false (§5.1, trampa 5). */
  urlPublica: boolean;
}

export interface Inscripcion {
  requiere: boolean;
  via: ViaInscripcion | null;
  /** Mail, teléfono, @handle o URL. */
  destino: string;
  cupo: number | null;
  cierra: TimestampLike | null;
  /**
   * B-97 — «se llenó». Se prende desde el menú «⋯» del listado, no desde el
   * formulario: es el dato que cambia **después** de publicar, y abrir 30+
   * campos desde el teléfono para tocar una casilla no se hace.
   *
   * **Un booleano y no un contador de lugares.** Un número queda viejo con cada
   * inscripción y no solo con la última, y un número viejo es peor que ninguno
   * porque parece información fresca. Esto se prende cuando no entra nadie más y
   * se apaga si se libera un lugar.
   *
   * **No esconde el canal de inscripción** (§5.2, `toPublic`): queda, con el
   * cartel al lado. Siempre hay lista de espera y las bajas existen — esconder el
   * canal convierte una baja en un lugar que se pierde.
   *
   * **Opcional a propósito:** los documentos que ya están en producción no lo
   * tienen, y el default de lectura los devuelve en `false`, que es exactamente
   * el comportamiento anterior. Que el tipo lo declare opcional es lo que obliga
   * al compilador a decidirlo en cada lectura (D-26).
   */
  completo?: boolean;
}

export interface Arancel {
  /** Slug de taxonomía (§4). */
  tipo: string;
  /** Libre: "2 cuotas", "incluye material". */
  notas: string;
  /**
   * **El monto en pesos, entero y sin centavos** — B-114. `null` es «no hay
   * monto cargado», que es lo normal: `arancel.tipo` sigue siendo lo esencial y
   * en la mitad de los casos del circuito es «a la gorra», que no tiene precio
   * que publicar.
   *
   * **Opcional en el tipo porque los documentos anteriores a B-114 no lo
   * tienen** (D-26): el compilador obliga a decidir el default en cada lectura,
   * y el default es `null`. Nada lo escribe solo.
   *
   * La moneda no es un campo: es **`ARS` siempre** (§14 del CLAUDE.md, «Moneda:
   * ARS»). Un campo de moneda con un solo valor posible es una decisión que
   * nadie tomó, y el día que haya que cobrar en otra hay que revisar bastante
   * más que este número.
   *
   * **Un arancel que no se paga no puede llevar monto**, y eso lo hace cumplir
   * el schema y no solo el formulario: `esSinCosto` (`lib/arancel.ts`) decide.
   * Es lo que evita publicar «Gratis · $8.000» en un formato que las máquinas
   * creen.
   */
  monto?: number | null;
}

export interface ItemMaterial {
  /**
   * `mat_<uuid>` — generado en cliente, NUNCA por índice (B-342, trampa 2).
   * Un documento anterior a B-342 puede no traerlo: se completa al leer con
   * `idItemMaterialMigrado()` (`lib/material.ts`).
   */
  id: string;
  tipo: TipoMaterial;
  titulo: string;
  url: string;
  entrega: EntregaMaterial;
  /** ¿Se muestra el link sin inscribirse? (§5.1) */
  publico: boolean;
}

export interface Material {
  tiene: boolean;
  items: ItemMaterial[];
}

/** Interno, nunca público (§3.2, §5.1). */
export interface Difusion {
  /** Handles a etiquetar al publicar en redes. */
  arrobar: string[];
  notas: string;
}

export interface Actividad {
  tipo: TipoActividad;
  titulo: string;
  /** Único, inmutable después de publicar (§7, trampa 10). */
  slug: string;
  descripcion: string;
  /**
   * B-167 — la galería. **Opcional a propósito:** los documentos que ya están en
   * producción tienen `imagenUrl` y no tienen esto, y el default de lectura los
   * convierte en una lista de un elemento (D-125). Que el tipo lo declare
   * opcional es lo que obliga al compilador a decidirlo en cada lectura (D-26).
   */
  imagenes?: Imagen[];
  /**
   * @deprecated Lo reemplazó `imagenes` (B-167). Sigue en el tipo porque los
   * documentos viejos lo tienen y el default de lectura lo lee; las escrituras
   * nuevas **no** lo escriben.
   */
  imagenUrl?: string | null;
  organizador: Organizador;
  tallerista: Persona | null;
  /**
   * DEC-1 — el libro presentado. **Opcional a propósito:** los documentos que ya
   * están en producción no lo tienen, y el default de lectura los devuelve con
   * el bloque vacío (`libroVacio()` en `formulario/estadoInicial.ts`), que es
   * exactamente el comportamiento anterior. Que el tipo lo declare opcional es
   * lo que obliga al compilador a decidirlo en cada lectura (D-26).
   *
   * `null` es el valor que escribe el panel cuando no hay título: un libro sin
   * título no es un libro, igual que un `tallerista` sin nombre.
   */
  libro?: Libro | null;

  esCiclo: boolean;
  sesiones: Sesion[];

  /** B-224 — las formas de cursar, cada una con su lugar y su ventana. */
  modalidades: ModalidadFila[];
  /**
   * La modalidad de la actividad entera, **derivada** de `modalidades` como su
   * unión: dos filas que difieren dan `hibrido` (B-224, decisión 3).
   *
   * Es un campo derivado y no una segunda fuente de verdad: lo escribe
   * `formADocumento` en cada guardado, igual que `searchText`. Existe porque las
   * salidas que solo pueden decir **una** modalidad lo necesitan — el filtro del
   * panel, la analítica y el `events.json`, que además lleva la lista entera al
   * lado.
   */
  modalidad: Modalidad;
  /**
   * La sede **principal**: la de la primera fila que tenga una, o `null`.
   * Derivada, como `modalidad`.
   *
   * Existe porque hay salidas que solo admiten **una** dirección: el campo
   * `location` del evento de Calendar —que es el que dibuja el mapa—, el
   * `searchText` del §6 y el filtro por barrio del panel. «La primera que tenga
   * sede» y no un flag explícito estilo `portada` (D-125) porque el orden de las
   * filas lo elige quien carga y se ve en pantalla; si alguna vez importa
   * distinguirlo, la respuesta es el flag.
   */
  sede: Sede | null;
  /** El bloque online **principal**, con el mismo criterio que `sede`. */
  online: Online | null;

  inscripcion: Inscripcion;
  /**
   * **Las comisiones del ciclo** — B-181, las «opciones para sumarse» de la
   * pantalla. Vacío o ausente es «no hay comisiones», el caso de todas las
   * actividades anteriores a este campo (D-26).
   *
   * Si hay comisiones, **todo encuentro pertenece a una** (lo exige el schema):
   * un ciclo mitad con comisiones y mitad sin ellas multiplica dos dimensiones y
   * la lista deja de ser legible, que es justamente lo que el ítem señalaba.
   * Encuentros comunes a todas las comisiones serían una decisión nueva.
   */
  comisiones?: Comision[];
  arancel: Arancel;
  material: Material;
  difusion: Difusion;

  estado: Estado;
  /**
   * B-285 — ¿estuvo publicada **alguna vez**? Un booleano pegajoso: se prende y
   * no vuelve a apagarse.
   *
   * ── Qué reemplaza ─────────────────────────────────────────────────────
   * La pregunta la necesita B-110: una actividad `cancelado` conserva su página
   * pública **solo si estuvo publicada**, porque publicar la de un borrador que
   * nació y murió sin ver la luz sería filtrar un borrador (§7.3 del diseño). Sin
   * este campo la respuesta se **infería**: primero por si alguna sesión conserva
   * `calendarEventId` —heurística que el propio sync borra al cancelar— y si no,
   * consultando `/actividades/{id}/versiones` (D-159). Funciona, y cuesta una
   * query por cancelada más la retención de D-42: veinte ediciones empujan la
   * versión publicada afuera del historial y la página vuelve a dar 404.
   *
   * ── Quién lo escribe: **el trigger, nunca el panel** ──────────────────
   * Decisión del dueño (2026-09-03). Lo prende `syncCalendar` —el único
   * `onDocumentWritten` sobre `actividades/{id}`, así que cubre también la
   * actividad que nace publicada— y la regla vive en una sola función,
   * `faltaMarcarPublicada` de `functions/historial.js`, importable por el panel
   * con `@historial`. Está además en `CAMPOS_DE_MAQUINA`: sin eso, ese write-back
   * costaría una versión de historial y un rebuild por cada publicación
   * (trampa 3), y el panel ofrecería «restaurar» un campo de máquina.
   *
   * `formADocumento` **no lo emite** y no está en `ActividadForm`: así el
   * formulario no puede apagarlo por omisión —`actualizarActividad` usa
   * `updateDoc`, que solo pisa las claves que recibe— y un cliente no puede
   * afirmarlo (las reglas de `/actividades` validan quién escribe, no la forma).
   * Un duplicado nace sin la clave y en `borrador`, o sea «no estuvo publicado»,
   * que es lo correcto sin necesidad de una rama en `duplicar.ts`.
   *
   * **Opcional a propósito, y ausente NO significa `false`:** significa «no lo
   * sabemos». Los documentos que ya están en producción no lo tienen, y quien
   * pregunta tiene dos defaults según lo que pueda leer — el build cae en la
   * inferencia de D-159, el panel en `estado === 'publicado'`. Los dos preservan
   * el comportamiento anterior (D-26); un `?? false` haría que una cancelada de
   * hace un mes pierda su página, que es la regresión de B-110.
   *
   * **No sale a ninguna salida pública.** Es un **predicado**: decide si se
   * genera la página, igual que `updatedAt` decide la ventana de 30 días del
   * sitemap (B-109). Publicarlo diría además, de una actividad en borrador, que
   * alguna vez estuvo publicada — un dato de gestión que nadie afuera necesita.
   */
  publicadaAlgunaVez?: boolean;
  tags: string[];
  /**
   * **Qué se llevan** — material de lectura, libro, merienda, café, certificado.
   * Taxonomía autogestionada `/opciones/incluye-actividad` (§4), pedido del
   * dueño: «¿qué incluye el evento? (Material de lectura, libro, merienda, etc)»
   * (`docs/prd/01-propuestas-de-organizadores.md` § 5).
   *
   * **No es `material`.** Ese es otra cosa: links de lectura con `entrega` y
   * `publico`, pensados para el club de lectura. «Merienda» no entra ahí.
   *
   * **Opcional a propósito** (D-26): los documentos que ya están en producción
   * no lo tienen, y el default de lectura es `[]` — «no se declaró nada», que es
   * el comportamiento anterior. Nada nuevo lo escribe ausente.
   *
   * **Sale a la página de detalle y no al índice del listado**, así que no es eje
   * de filtro ni frase de la tarjeta. Es una decisión de producto y no un olvido:
   * un chip de filtro es una URL indexable (`?incluye=`) y no se mueve una vez
   * indexada (trampa 10), y con cero actividades cargadas no hay con qué decidir
   * si ese filtro sirve. De detalle a filtro el camino es aditivo; al revés rompe
   * URLs. **Tampoco va al evento de Calendar** ni al texto para redes.
   */
  incluye?: string[];
  destacado: boolean;
  /** Normalizado — §6. Lo calcula el cliente al guardar. */
  searchText: string;

  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  createdBy: string;
  updatedBy: string;
}

/** Documento con id, tal como lo consume el panel. */
export type ActividadConId = Actividad & { id: string };

/**
 * Forma del formulario: fechas como strings `datetime-local` y sin campos
 * de auditoría. Se convierte a `Actividad` al guardar.
 */
export interface SesionForm {
  id: string;
  inicio: string;
  fin: string;
  tema: string;
  lectura: string;
  cancelada: boolean;
  calendarEventId: string | null;
  /** B-181 — de qué comisión es. `null` es «este ciclo no tiene comisiones». */
  comisionId: string | null;
}

/**
 * Una fila de modalidad en el formulario (B-224): las fechas como strings de
 * `datetime-local`, igual que `SesionForm`.
 *
 * `''` es «sin fecha» —el `null` del documento—, que es lo que reporta un
 * `<input type="datetime-local">` vacío. La conversión en los dos sentidos es la
 * de `lib/sesiones.ts` (`aDatetimeLocal` / `deDatetimeLocal`), reusada y no
 * reescrita: es la que evita la trampa 1.
 */
export interface ModalidadFilaForm {
  id: string;
  modalidad: Modalidad;
  inicio: string;
  fin: string;
  sede: Sede | null;
  online: Online | null;
}

export interface ActividadForm
  extends Omit<
    Actividad,
    | 'sesiones'
    | 'comisiones'
    | 'searchText'
    | 'createdAt'
    | 'updatedAt'
    | 'createdBy'
    | 'updatedBy'
    | 'inscripcion'
    | 'imagenes'
    | 'imagenUrl'
    | 'libro'
    | 'modalidades'
    | 'modalidad'
    | 'sede'
    | 'online'
    | 'incluye'
  > {
  sesiones: SesionForm[];
  /**
   * **Obligatorio acá y opcional en el documento**, el mismo reparto que
   * `comisiones` y `modalidades`: el estado del formulario siempre tiene la lista
   * (vacía si no se declaró nada), y el `?` del documento existe solo para los
   * que se escribieron antes del campo. Así ninguna pantalla tiene que
   * preguntarse si el array está.
   */
  incluye: string[];
  /**
   * B-181 — las comisiones. **Obligatorio acá y opcional en el documento**, que
   * es el mismo reparto que `modalidades`: el estado del formulario siempre tiene
   * la lista (vacía si no hay), y el `?` del documento existe solo para los que
   * se escribieron antes del campo. Así ningún componente tiene que preguntarse
   * si el array está.
   */
  comisiones: Comision[];
  /**
   * B-224 — las formas de cursar, con su lugar y su ventana.
   *
   * **`modalidad`, `sede` y `online` no están en el formulario**, y no es un
   * olvido: los tres son campos **derivados** de esta lista y tenerlos también en
   * el estado del formulario serían dos fuentes para el mismo dato, que es cómo se
   * desincronizan. Los calcula `formADocumento` al guardar, igual que
   * `searchText`.
   */
  modalidades: ModalidadFilaForm[];
  /**
   * `completo` es **siempre un booleano en el formulario**, nunca `undefined`:
   * el default de lectura ya resolvió los documentos anteriores a B-97 antes de
   * llegar acá, así que la pantalla no tiene que preguntárselo. Es la misma
   * asimetría que `libro` y por el mismo motivo.
   *
   * Está en el formulario **aunque no se prenda desde el formulario**: sin esto,
   * `formADocumento` reescribe `inscripcion` completo en cada guardado y una
   * edición de la descripción apagaría el cartel de «Cupo completo» sin que
   * nadie lo pida — y con él la línea de los N eventos del calendario.
   */
  inscripcion: Omit<Inscripcion, 'cierra' | 'completo'> & {
    cierra: string;
    completo: boolean;
  };
  /**
   * DEC-1 — **siempre un objeto en el formulario, nunca `null`**, aunque en el
   * documento sea `Libro | null`.
   *
   * Es la asimetría de `imagenes` por el mismo motivo: el default de lectura ya
   * resolvió el caso de los documentos viejos antes de llegar acá, así que la
   * pantalla no tiene que preguntarse si el bloque existe. Y a diferencia de
   * `tallerista`, que lo crea la cascada de tipo, este nace con el formulario:
   * dos campos de texto vacíos no fabrican datos que nadie cargó, porque
   * `formADocumento` los convierte en `null` si no tienen título.
   */
  libro: Libro;
  /**
   * Siempre un array, nunca `undefined`: el formulario no tiene el problema de
   * los documentos viejos, porque el default de lectura ya resolvió eso antes de
   * llegar acá. Y `imagenUrl` no está: el formulario no escribe el campo viejo.
   */
  imagenes: Imagen[];
}

/** §4.1 — `/opciones/{campo}` */
export interface ValorOpcion {
  slug: string;
  label: string;
  orden: number;
  /** Protege las opciones base: no se borran ni renombran desde la UI (§4.3). */
  fijo: boolean;
  usos: number;
  /**
   * §4.3 — una opción creada con "Otro" no entra al desplegable de los demás
   * hasta que alguien la valida.
   *
   * **Opcional a propósito:** los documentos de `/opciones/*` que ya están en
   * producción se escribieron antes de que existiera el campo. Ausente cuenta
   * como aprobada — ver `estaAprobada` en `lib/taxonomia.ts` (se re-exporta desde
   * `lib/opciones.ts`, que es la puerta a `/opciones/*`).
   */
  aprobada?: boolean;
  /**
   * §4.3 · B-29 — esta opción quedó aprobada **porque la reusó otra cuenta**, no
   * porque alguien la mirara.
   *
   * Es la mitad de la decisión del dueño que hace que auto-aprobar sea seguro: el
   * contra de aprobar sin revisión es que dos personas repitan el mismo typo, y
   * sin la marca esa aprobación sería indistinguible de una humana. Con ella, la
   * pantalla de taxonomías puede señalar cuáles conviene mirar.
   *
   * **No es identidad de nadie**: es un booleano sobre la etiqueta, así que a
   * diferencia de `huellaCreador` no hay nada que razonar sobre su publicación.
   * Igual no sale, por construcción: la proyección del §4.4 (`opcionPublica`) es
   * una whitelist que emite `slug`, `label` y el `tono`.
   *
   * Opcional como los otros dos: ausente significa «no pasó», que es el estado de
   * todo lo que ya está cargado.
   */
  aprobadaPorReuso?: boolean;
  /**
   * Huella del uid de quien la creó, para que la siga viendo mientras espera
   * aprobación. **Es una huella, no un uid:** este documento es de lectura
   * pública (§5.3) y los uids no salen al público (§5.1). Ver `lib/huella.ts`.
   */
  huellaCreador?: string;
  /**
   * §4.1 · D-150 — el **matiz** elegido para esta opción, en grados de OKLCH
   * (entero de 0 a 359). Hoy solo lo pinta `tipo`, en la cajita de la categoría
   * del listado público.
   *
   * **Opcional, y ausente es el caso normal.** Sin valor el color se **deriva del
   * slug** (`tonoDeTipo` en `lib/identidad.ts`), que es lo que hace que un tipo
   * creado desde «Otro» nazca con color en vez de nacer sin color y sin que nadie
   * se entere. Esto es la excepción: lo que alguien eligió a mano desde Opciones.
   *
   * **Es un matiz, no un color.** La luminosidad y el croma son fijos para todos
   * los tipos, y eso es lo que permite garantizar el contraste sobre los 360
   * valores posibles en vez de sobre los que alguien ya miró. Un valor fuera de
   * rango, con decimales o de otro tipo se ignora al leer.
   */
  tono?: number;
}

export interface DocOpciones {
  valores: ValorOpcion[];
}

/**
 * Campos que usan el patrón de taxonomía autogestionada (§4).
 *
 * **El nombre del campo de taxonomía no es el del campo del documento**, y ya
 * era así antes de `incluye`: `barrio` vive en `sede.barrio` y `plataforma` en
 * `online.plataforma`. `incluye-actividad` agrega el caso inverso —el documento
 * dice `incluye` y la taxonomía se llama distinto— y es a propósito: los PRDs
 * traen `incluye-suscripcion` e `incluye-lugar`, y «merienda» y «proyector» no
 * pertenecen a la misma lista (`docs/prd/README.md` § 3). Un vocabulario
 * compartido rompería el orden por `usos`, que es lo que hace útil al
 * desplegable.
 */
export const CAMPOS_TAXONOMIA = [
  'arancel',
  'tipo',
  'barrio',
  'plataforma',
  'tags',
  'incluye-actividad',
  /*
   * ── Los seis de las suscripciones literarias — B-832, § 8 del PRD 3 ──────
   *
   * **Son de otra colección, y viven acá igual.** `/opciones/{campo}` es el
   * mecanismo del §4 y es uno solo: el desplegable con «Otro», la transacción de
   * deduplicación, el orden por `usos`, la pantalla que las administra y el
   * contador de pendientes salen todos de esta lista. Una taxonomía que no esté
   * acá no tiene nada de eso — tendría que reimplementarlo, que es la clase de
   * B-72. El precedente es `barrio`, que desde B-901 lo comparten las actividades
   * y las librerías.
   *
   * Lo que **no** ganan por estar acá, y está atado en los dos lugares:
   *
   * - **no viajan en el `events.json`** (`TAXONOMIAS_FUERA_DEL_INDICE`,
   *   `lib/eventsJson.ts`): sus chips los arma `/suscripciones.json`, y publicar
   *   un vocabulario sin consumidor en el archivo que baja toda persona que abre
   *   la agenda es lo que D-580 cerró para `incluye-actividad`;
   * - **no van al evento de Calendar** (`TAXONOMIAS_FUERA_DEL_EVENTO`,
   *   `functions/etiquetas.js`): una suscripción no tiene encuentros, así que
   *   pedir sus etiquetas sería una lectura más de Firestore por invocación para
   *   un dato que `construirDescripcion` nunca mira.
   *
   * **`compromisoMinimo` no está**, y es el desvío chico del § 3 del PRD que
   * `types/suscripcion-literaria.ts` deja escrito: lo que necesita slug es un eje
   * de filtro, y ése no lo es.
   */
  'periodicidad',
  'tipo-oferente',
  'perfil-editorial',
  'incluye-suscripcion',
  'extras-suscripcion',
  'alcance-envio',
] as const;
export type CampoTaxonomia = (typeof CAMPOS_TAXONOMIA)[number];

/**
 * Las taxonomías **multivalor**: la actividad guarda un array de slugs, no uno.
 *
 * Se declara como lista y no se deduce, porque de esto dependen tres mecanismos
 * que estaban escritos para `tags` y solo para `tags`: el buffer de etiquetas
 * nuevas del formulario (D-02 — se persisten en el submit), el alta en lote
 * (`upsertOpciones`) y el conteo de `usos` (§4.3). Con `incluye-actividad` son
 * **dos**, así que el mecanismo se generalizó en vez de copiarse — que es la
 * clase de B-72.
 *
 * El complemento son las de valor único (`CampoLabelUnico`, en
 * `lib/formulario/etiquetas.ts`), y las dos listas juntas tienen que dar
 * `CAMPOS_TAXONOMIA`: lo fija `tests/taxonomia.test.ts`.
 */
export const CAMPOS_MULTIVALOR = [
  'tags',
  'incluye-actividad',
  // B-832 — las tres listas de una suscripción (§ 3 del PRD 3). `periodicidad`,
  // `tipo-oferente` y `perfil-editorial` no están: guardan **un** slug, así que
  // su buffer es el de valor único (`CampoLabelUnico`).
  'incluye-suscripcion',
  'extras-suscripcion',
  'alcance-envio',
] as const;
export type CampoMultivalor = (typeof CAMPOS_MULTIVALOR)[number];
