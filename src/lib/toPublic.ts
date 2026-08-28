import { imagenesDe } from '@/lib/imagenes';
/*
 * De `taxonomia` y no de `opciones`: las dos exportan `opcionesVisibles` —la
 * segunda la re-exporta— pero `opciones.ts` importa `firestore-client`, y esto
 * corre en el build de Astro. Traer Firebase acá sería arrastrarlo a la
 * proyección pública por un import de conveniencia.
 */
import { opcionesVisibles } from '@/lib/taxonomia';
import type {
  Actividad,
  Imagen,
  ItemMaterial,
  Libro,
  ModalidadFila,
  Online,
  Sede,
  Sesion,
  ValorOpcion,
} from '@/types/actividad';

/**
 * §5 — Todo lo que entra al `events.json` es público y scrapeable.
 * El build NO vuelca el documento entero: lo proyecta.
 *
 * Nunca al JSON (§5.1):
 *  - `online.url` con `urlPublica: false` → el link de la reunión se manda
 *                        al inscribirse (trampa 5). Con `urlPublica: true`
 *                        el dueño decidió publicarlo — ver abajo.
 *  - `difusion`        → trabajo interno
 *  - `material.items[].url` con `publico: false`
 *  - `createdBy` / `updatedBy` → uids
 */

export interface SesionPublica {
  id: string;
  inicio: string;
  fin: string;
  tema: string | null;
  lectura: string | null;
  cancelada: boolean;
}

export interface ItemMaterialPublico {
  tipo: ItemMaterial['tipo'];
  titulo: string;
  entrega: ItemMaterial['entrega'];
  url?: string;
}

/** §5.1 — lo mismo que `Imagen` **menos `storagePath`**, que es el handle interno. */
export interface ImagenPublica {
  id: string;
  url: string;
  epigrafe: string;
  origen: 'externa' | 'propia';
  portada: boolean;
  ancho?: number;
  alto?: number;
}

/**
 * §5.1 + DEC-1 — el libro presentado **sí es público**.
 *
 * Es información de la actividad, del mismo orden que el título y el tallerista:
 * quien busca «se presenta tal libro» tiene que encontrarla. Se enumeran los dos
 * campos igual que el resto de la proyección —whitelist, sin spread— así que una
 * clave que se agregue mañana al modelo no sale sola.
 */
export interface LibroPublico {
  titulo: string;
  autor: string;
}

/**
 * §4.4 — una opción de taxonomía en el `events.json`: **`slug` y `label`, nada
 * más**.
 *
 * `ValorOpcion` tiene además `orden`, `fijo`, `usos`, `aprobada` y
 * `huellaCreador`. Ninguno de esos cinco tiene por qué salir:
 *
 * | Campo | Por qué no sale |
 * |---|---|
 * | `orden` | es del desplegable del panel; los chips del sitio se ordenan por lo que el sitio decida |
 * | `fijo` | dice si la UI del panel puede borrarla, no le sirve a nadie afuera |
 * | `usos` | cuántas veces se usó es dato de gestión, y publicado dibuja qué carga esta gente y con qué frecuencia |
 * | `aprobada` | estado interno de moderación (§4.3) |
 * | `huellaCreador` | **es el que importa**: aunque sea una huella y no un uid (D-27), es un identificador estable de una persona, y §5.1 dice que del creador no sale nada al público |
 *
 * ── Por qué esto existe antes que su consumidor ──────────────────────────
 * B-212. El `events.json` es B-106 y todavía no está escrito. Cuando se escriba,
 * el camino corto es volcar `valores` tal cual —una línea, y se lee razonable— y
 * ahí entran `huellaCreador` y `usos` sin que nadie lo haya decidido.
 *
 * Y **nada lo detendría**: el barrido de centinelas de B-196
 * (`tests/barrido-de-salidas-publicas.test.ts`) está anclado a las interfaces de
 * una *actividad*, y `ValorOpcion`/`DocOpciones` están declaradas ahí como
 * ajenas. O sea: la única salida pública nueva que ya estaba planificada nacía
 * fuera de la red.
 *
 * Escribir la whitelist ahora es lo que evita que la decisión la tome un spread
 * escrito con apuro seis semanas después. Es la misma razón por la que
 * `toPublic` enumera campo por campo en vez de usar `pick` genérico.
 */
export interface OpcionPublica {
  slug: string;
  label: string;
}

/**
 * Qué de una forma de cursar es público (§5.1, B-224).
 *
 * **Se enumera campo por campo, incluida la sede.** No es cosmético: desde B-224
 * la sede viaja **adentro de un array**, y la poda de `autoguardado.ts` deja pasar
 * los arrays a propósito —«sus proyecciones públicas enumeran campo por campo, así
 * que una clave de más no llega a ninguna salida»—. Si acá se copiara la sede con
 * un spread, esa frase dejaría de ser cierta y una clave de más en un borrador
 * recuperado terminaría en el `events.json`.
 *
 * **`inicio` y `fin` NO están**, y es la decisión conservadora de B-224: qué
 * significan frente a `sesiones[].inicio/fin` sigue sin resolver, y un campo que
 * no sale no puede filtrar nada por error. Agregarlo después es barato; sacarlo de
 * algo ya publicado, no.
 */
export interface ModalidadPublica {
  id: string;
  modalidad: Actividad['modalidad'];
  sede: Actividad['sede'];
  online: { plataforma: string; url?: string } | null;
}

export interface ActividadPublica {
  id: string;
  titulo: string;
  slug: string;
  tipo: Actividad['tipo'];
  descripcion: string;
  imagenes: ImagenPublica[];
  /**
   * B-224 — las formas de cursar, con su lugar. Es lo que el sitio necesita para
   * decir «los martes presencial en Villa Crespo, los jueves por Meet».
   */
  modalidades: ModalidadPublica[];
  /** La unión de las modalidades de arriba. Es el eje del filtro del listado. */
  modalidad: Actividad['modalidad'];
  /** La sede principal: la de la primera fila que tenga una (B-224). */
  sede: Actividad['sede'];
  tags: string[];
  destacado: boolean;
  searchText: string;
  /**
   * **`AAAA-MM-DD`** de cuándo se cargó la actividad — B-227 y **D-134**.
   *
   * Existe por un orden del listado: «Recién agregadas» contesta «¿qué se sumó
   * desde la última vez que miré?», y esa pregunta no se puede contestar con las
   * fechas de los encuentros — una actividad cargada hoy para diciembre queda al
   * fondo del orden cronológico.
   *
   * ── Por qué el día y no el instante ───────────────────────────────────
   * La primera versión publicaba el ISO completo, y el `auditor-privacidad` lo
   * marcó: **con un solo admin, un `events.json` con
   * `"creadoEn":"2026-08-27T03:14:52.881Z"` en cada actividad no es una fecha, es
   * la agenda de trabajo de una persona identificada** — a qué hora carga, qué
   * noches, en qué tandas. Es el mismo razonamiento por el que D-57 rechaza el
   * hash del mail y por el que D-27 saca `huellaCreador` de la salida: el dato no
   * nombra a nadie, pero con un universo de una persona la desanonimización es
   * gratis.
   *
   * Y el único consumidor no necesita nada de eso: ordenar por día alcanza, y dos
   * actividades cargadas el mismo día desempatan por título. Es la regla de
   * siempre —se publica lo que el sitio necesita, no lo que el documento tiene—
   * aplicada a la **precisión** y no al campo.
   *
   * **Es una fecha, no una persona.** Lo que el §5.1 mantiene afuera del creador
   * es su identidad (`createdBy`, y hasta la `huellaCreador` de una opción de
   * taxonomía, D-27); *qué día* se cargó algo que ya es público no dice nada de
   * nadie. El §11.2 del diseño del sitio ya contemplaba publicar `updatedAt` con
   * el mismo criterio, para el `lastmod` del sitemap.
   *
   * **`updatedAt` NO sale, y es deliberado:** el orden que se pidió es por alta y
   * no por última edición, y una fecha de modificación publicada convierte cada
   * corrección de un typo en «actualizado hoy». Cuando el sitemap la necesite
   * (§11.2 #3) va a ser una línea, con su propia decisión.
   */
  creadoEn: string;
  arancel: Actividad['arancel'];
  organizador: Actividad['organizador'];
  tallerista: Actividad['tallerista'];
  libro: LibroPublico | null;
  esCiclo: boolean;
  sesiones: SesionPublica[];
  inscripcion: {
    requiere: boolean;
    via: Actividad['inscripcion']['via'];
    destino: string;
    cupo: number | null;
    abierta: boolean;
    /**
     * El ISO del cierre, o `null` si no cierra — B-111.
     *
     * **`abierta` se congela en el build y miente.** Se calcula con el reloj del
     * momento en que corrió el build, así que una inscripción que cerró a la
     * mañana sigue diciendo «abierta» hasta el rebuild siguiente. Con el rebuild
     * automático son ~2-7 minutos del debounce (§8), pero la ventana es real y
     * **no depende de que alguien edite**: sin un cambio que dispare rebuild,
     * nadie recalcula nada y el sitio invita a anotarse en algo que ya cerró.
     *
     * Mandando la fecha, quien consume la recalcula con **su** reloj. Y de paso
     * la página puede decir «las inscripciones cierran el 22 de septiembre», que
     * es lo que hace que alguien escriba hoy en vez de dejarlo para después.
     *
     * `abierta` se conserva —el arreglo es «además del booleano», no «en lugar
     * de»— porque un consumidor sin JavaScript no puede recalcular nada y
     * necesita algo ya resuelto. Lo que **no** puede hacer un consumidor nuevo es
     * usar `abierta` teniendo `cierraEn` a mano.
     *
     * No expone nada nuevo: es una fecha que la página ya quiere mostrar.
     */
    cierraEn: string | null;
    /** B-97 — «se llenó». Ver la proyección abajo. */
    completo: boolean;
  };
  online: { plataforma: string; url?: string } | null;
  material: {
    tiene: boolean;
    items: ItemMaterialPublico[];
  };
}

/** Serializa un Timestamp a ISO. Acepta Date por comodidad en tests. */
const aIso = (t: { toDate(): Date } | Date): string =>
  t instanceof Date ? t.toISOString() : t.toDate().toISOString();

/**
 * Lo mismo, pero **tolerante**: devuelve `''` con cualquier cosa que no sea una
 * fecha usable.
 *
 * Es para los campos de auditoría (`createdAt`), que a diferencia de las fechas
 * de las sesiones **no siempre son un `Timestamp` cuando esto corre**: un
 * documento recién armado por `formADocumento` los tiene como el sentinel de
 * `serverTimestamp()`, que no tiene `toDate()` y que el servidor recién resuelve
 * al escribir. Un documento leído de Firestore sí trae el `Timestamp`.
 *
 * Es además el default de lectura del §"un campo nuevo se lee con el default que
 * preserva lo anterior": un documento sembrado a mano sin `createdAt` publica una
 * cadena vacía, que ordena al fondo de «Recién agregadas» y no rompe nada.
 */
const aIsoSeguro = (t: unknown): string => {
  if (t instanceof Date) return t.toISOString();
  if (t && typeof (t as { toDate?: unknown }).toDate === 'function') {
    const d = (t as { toDate(): Date }).toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : '';
  }
  return '';
};

const aMillis = (t: { toMillis(): number } | Date): number =>
  t instanceof Date ? t.getTime() : t.toMillis();

/**
 * Qué de cada imagen es público (§5.1, B-167).
 *
 * **`storagePath` no sale, y conviene saber por qué no** — B-206 #1, decidido el
 * 2026-08-27 al implementar la subida.
 *
 * Lo que este comentario decía antes era que publicarlo "dibuja la estructura del
 * bucket y deja probar objetos por nombre". Eso **no es cierto**, y ocultarlo no
 * lo lograba: la URL canónica de Storage lleva el path URL-encodeado adentro
 * (`…/o/imagenes%2Fimg_ab12…jpg?alt=media&token=…`) y esa URL sí se publica,
 * porque es la que el navegador tiene que pedir. Con `origen: 'propia'` al lado,
 * el path ya estaba a la vista.
 *
 * Lo que se hizo en cambio, que es lo que vuelve inofensivo el hecho:
 *
 *  1. **El path es opaco.** Un solo prefijo plano y el nombre es el uuid de la
 *     fila (`rutaDeImagen`). No hay estructura que dibujar ni nombre que
 *     adivinar: `imagenes/img_<uuid>.jpg` no dice nada de nada.
 *  2. **Bajo ese prefijo la lectura es pública en `storage.rules`.** El token de
 *     `getDownloadURL()` deja de ser lo que protege el objeto, así que un token
 *     "filtrado" no abre nada que no estuviera abierto.
 *
 * Con eso, `storagePath` sigue afuera del JSON por lo que **sí** es: el handle
 * autoritativo con el que el panel y la Function direccionan el objeto. Un
 * consumidor del `events.json` no tiene nada que hacer con él, y las externas ni
 * siquiera lo tienen. Es la misma regla de siempre —el JSON publica lo que el
 * sitio necesita, no lo que el documento tiene— y no una promesa de secreto.
 *
 * La opción cara —un rewrite de Hosting o un dominio propio, que sacaría el path
 * de la URL y de paso pondría el egreso detrás del CDN— quedó en el BACKLOG por
 * lo que en realidad compra, que es costo y portabilidad, no privacidad.
 *
 * Lo demás sí sale: la URL es lo que el navegador va a pedir igual, el epígrafe se
 * muestra, y `ancho`/`alto` evitan que la tarjeta salte al cargar.
 *
 * `origen` sale porque el build lo necesita: las propias tienen tamaños derivados
 * y las externas se sirven tal cual desde su origen (DEC-7d). Es un enum cerrado
 * de dos valores, no contenido.
 */
const imagenPublica = (i: Imagen): ImagenPublica => ({
  id: i.id,
  url: i.url,
  epigrafe: i.epigrafe,
  origen: i.origen,
  portada: i.portada,
  ...(i.ancho !== undefined ? { ancho: i.ancho } : {}),
  ...(i.alto !== undefined ? { alto: i.alto } : {}),
});

/**
 * El libro, o `null`. Sin título no se inventa el campo (D-15): un objeto con
 * dos cadenas vacías en el `events.json` haría que el sitio pinte el rótulo
 * «Libro:» vacío en toda actividad que no lo tenga.
 */
const libroPublico = (l: Libro | null | undefined): LibroPublico | null =>
  l?.titulo ? { titulo: l.titulo, autor: l.autor ?? '' } : null;

/**
 * La plataforma siempre; la URL **solo** si `urlPublica` está en true.
 *
 * Desvío consciente del §5.2, que descarta la URL sin condición: el modelo del
 * §3.1 tiene el flag y el formulario su casilla, así que ignorarlo era prometer
 * algo que no pasaba. Decisión explícita del dueño (D-15).
 *
 * El default sigue siendo `false` y el formulario advierte que un link de reunión
 * público habilita zoombombing (trampa 5). Es **una sola función** para la fila y
 * para el bloque principal desde B-224: dos copias de esta condición son dos
 * maneras de que una se olvide del flag.
 */
const onlinePublico = (online: Online | null): { plataforma: string; url?: string } | null =>
  online
    ? online.urlPublica && online.url
      ? { plataforma: online.plataforma, url: online.url }
      : { plataforma: online.plataforma }
    : null;

/**
 * La sede, **enumerada campo por campo**.
 *
 * La diferencia con copiarla entera no es cosmética y va en las dos direcciones:
 * el literal **rompe el build** el día que `Sede` gane una clave, y el spread la
 * publicaría en silencio. Importa más desde B-224, porque la sede viaja adentro
 * de un array —donde la poda de `autoguardado.ts` no llega— y porque
 * `historial.ts` la escribe por un camino que no pasa por `formADocumento`
 * (`payload.sede = sedePrincipal(filas)`, con el objeto tal como venía de una
 * versión guardada).
 *
 * Es una sola función para la sede de la fila y para la derivada: dos copias son
 * dos maneras de que una se quede sin enumerar.
 */
const sedePublica = (s: Sede | null | undefined): Sede | null =>
  s
    ? {
        nombre: s.nombre,
        direccion: s.direccion,
        barrio: s.barrio,
        ciudad: s.ciudad,
        indicaciones: s.indicaciones,
        geo: s.geo ? { lat: s.geo.lat, lng: s.geo.lng } : null,
      }
    : null;

/** Ver `ModalidadPublica`: whitelist, sin spread, y sin las fechas. */
const modalidadPublica = (m: ModalidadFila): ModalidadPublica => ({
  id: m.id,
  modalidad: m.modalidad,
  sede: sedePublica(m.sede),
  online: onlinePublico(m.online),
});

const sesionPublica = (s: Sesion): SesionPublica => ({
  id: s.id,
  inicio: aIso(s.inicio),
  fin: aIso(s.fin),
  tema: s.tema ?? null,
  lectura: s.lectura ?? null,
  cancelada: s.cancelada ?? false,
});

/** Un item privado conserva título y tipo, pero pierde la URL (§5.1). */
const itemPublico = (i: ItemMaterial): ItemMaterialPublico =>
  i.publico
    ? { tipo: i.tipo, titulo: i.titulo, entrega: i.entrega, url: i.url }
    : { tipo: i.tipo, titulo: i.titulo, entrega: i.entrega };

/**
 * §4.4 — una opción de taxonomía, proyectada. Ver `OpcionPublica`.
 *
 * Enumera los dos campos y no hace `pick`: si mañana se agrega una clave a
 * `ValorOpcion`, esto sigue emitiendo dos y el compilador no se queja de nada —
 * que es exactamente el comportamiento que se quiere de una whitelist.
 */
export const opcionPublica = (v: ValorOpcion): OpcionPublica => ({
  slug: v.slug,
  label: v.label,
});

/**
 * Las opciones de un campo, listas para el `events.json`.
 *
 * **Se filtran las no aprobadas con `opcionesVisibles` sin `uid`**, y no con un
 * filtro propio: esa función ya es la regla del §4.3 y su docblock nombra
 * literalmente este caso («sin `uid` devuelve solo las aprobadas. Ese es el caso
 * del sitio público»). Reimplementarla acá habría sido la clase de B-72 otra vez
 * —la misma decisión escrita dos veces— y en el primer intento **ya salió mal**:
 * `v.aprobada !== false` descarta una opción `fijo: true` que tuviera
 * `aprobada: false`, y `estaAprobada` es `v.fijo || (v.aprobada ?? true)`. Las
 * opciones base son justo las que no pueden desaparecer de los filtros.
 *
 * Ojo con el matiz de D-30, que sigue valiendo: filtrar **lo elegible** es
 * correcto acá; lo que nunca se filtra es la lista con la que se **resuelve** un
 * slug a su etiqueta, porque una actividad publicada puede tener guardada una
 * opción pendiente y el sitio tiene que poder mostrar su nombre.
 */
export const opcionesPublicas = (valores: ValorOpcion[]): OpcionPublica[] =>
  opcionesVisibles(valores).map(opcionPublica);

export const toPublic = (a: Actividad, id: string, ahora = Date.now()): ActividadPublica => ({
  id,
  titulo: a.titulo,
  slug: a.slug,
  tipo: a.tipo,
  descripcion: a.descripcion,
  imagenes: imagenesDe(a).map(imagenPublica),
  modalidades: (a.modalidades ?? []).map(modalidadPublica),
  modalidad: a.modalidad,
  sede: sedePublica(a.sede),
  tags: a.tags ?? [],
  destacado: a.destacado ?? false,
  searchText: a.searchText ?? '',
  /*
   * D-134 — la fecha de alta, para el orden «Recién agregadas».
   *
   * **`slice(0, 10)` recorta al día**, y no es cosmético: publicar el instante
   * exacto de cada carga dibuja la agenda de trabajo del dueño (ver el docblock
   * del campo). Ordena igual, y una cadena vacía —el default cuando `createdAt`
   * todavía es el sentinel de `serverTimestamp()`— sigue ordenando al fondo.
   */
  creadoEn: aIsoSeguro(a.createdAt).slice(0, 10),
  arancel: a.arancel,
  organizador: a.organizador,
  tallerista: a.tallerista ?? null,
  libro: libroPublico(a.libro),
  esCiclo: a.esCiclo ?? false,
  sesiones: (a.sesiones ?? []).map(sesionPublica),
  inscripcion: {
    requiere: a.inscripcion.requiere,
    via: a.inscripcion.via,
    destino: a.inscripcion.destino,
    cupo: a.inscripcion.cupo,
    abierta: !a.inscripcion.cierra || aMillis(a.inscripcion.cierra) > ahora,
    // B-111 — la fecha cruda, para que el consumidor no dependa del reloj del
    // build. Ver la nota del tipo.
    cierraEn: a.inscripcion.cierra ? aIso(a.inscripcion.cierra) : null,
    /**
     * B-97 — **sí es público, y es el punto del campo**: sin esto el sitio sigue
     * diciendo «cupo: 12» cuando ya no entra nadie, que es peor que no decir
     * nada porque parece información fresca.
     *
     * **El canal de inscripción no se esconde acá.** `via` y `destino` siguen
     * saliendo con `completo: true`, y es una decisión del dueño, no un olvido:
     * siempre hay lista de espera y las bajas existen, así que esconder el canal
     * convierte una baja en un lugar que se pierde. El sitio muestra el cartel
     * **al lado** del canal, no en su lugar.
     *
     * Default de lectura para los documentos anteriores al campo: `false`, o sea
     * lo mismo que se publicaba antes (D-26).
     */
    completo: a.inscripcion.completo ?? false,
  },
  /** El bloque online principal. Ver `onlinePublico` para el flag del link. */
  online: onlinePublico(a.online ?? null),
  material: {
    tiene: a.material?.tiene ?? false,
    items: (a.material?.items ?? []).map(itemPublico),
  },
});
