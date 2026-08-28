import { nuevaImagenId } from '@/lib/imagenes';
import { duplicarModalidad } from '@/lib/modalidades';
import { aDatetimeLocal, deDatetimeLocal, nuevaSesionId } from '@/lib/sesiones';
import type { ActividadForm, SesionForm } from '@/types/actividad';

/**
 * Duplicar una actividad entera (B-11).
 *
 * Un ciclo nuevo suele ser el del año anterior con otras fechas, y son 30+
 * campos (§11). La copia es un **formulario nuevo**, no un documento: se guarda
 * por el camino de creación, así que `createdAt`/`createdBy` salen de la copia
 * y no del original (`formADocumento(..., esNuevo: true)`).
 *
 * Módulo puro a propósito (ver "Lógica pura separada de la infraestructura" en
 * docs/05-patrones.md): acá vive lo que, si sale mal, corrompe los eventos de
 * Calendar del original. Sin red, testeable barato.
 *
 * Lo que la copia NO puede heredar:
 *
 * - **Los ids de sesión** (§7.2, trampa 2). Dos actividades con los mismos ids
 *   de sesión rompen el diff: es la llave con la que la Function decide qué
 *   evento crear, actualizar o borrar.
 * - **`calendarEventId`** (§7.2). Los eventos del original existen en el
 *   calendario; los de la copia no. Heredarlos haría que editar la copia
 *   modifique o borre eventos del original.
 * - **El slug** (§7, trampa 10). Es único y queda inmutable al publicar.
 * - **El estado**: la copia arranca en `borrador`. Duplicar no publica nada ni
 *   manda nada al calendario (§7.3) sin que el usuario lo revise.
 *
 * Y lo que **sí se puede heredar pero conviene elegir** es B-199: `QueCopiar`.
 * La decisión de qué se copia vive acá y no en el modal, para que un llamador
 * que no pase nada obtenga el default seguro y no el «copiá todo» de antes.
 */

const MS_DIA = 86_400_000;
const MS_SEMANA = 7 * MS_DIA;

/** Sufijo con el que se marca una copia, y cómo reconocerlo para no encadenarlo. */
const RE_TITULO_COPIA = /\s*\(copia(?:\s+\d+)?\)\s*$/i;
const RE_SLUG_COPIA = /-copia(?:-\d+)?$/;

/**
 * ¿Este slug es el que se propuso automáticamente para una copia?
 *
 * Lo usa el schema para no dejar publicar con él: el slug queda inmutable al
 * publicar (trampa 10), así que una URL `…-copia` publicada por descuido no se
 * puede arreglar nunca más sin perder el SEO de esa página.
 */
export const esSlugDeCopia = (slug: string): boolean => RE_SLUG_COPIA.test(slug);

/**
 * El título se marca como copia: en el listado, dos filas con el mismo título
 * son indistinguibles. Se limpia el sufijo anterior primero, así duplicar dos
 * veces no deja "Taller (copia) (copia)".
 */
export const tituloCopia = (titulo: string): string =>
  `${titulo.replace(RE_TITULO_COPIA, '').trim()} (copia)`;

/**
 * Slug propuesto para la copia: el del original con `-copia`, y `-copia-2`,
 * `-copia-3`… si ya está tomado.
 *
 * Es una propuesta, no la palabra final: el formulario deja el campo editable
 * (la copia es borrador, no publicado) y lo vuelve a derivar del título en
 * cuanto el usuario lo cambia. `slugDisponible` en el submit sigue siendo la
 * guarda real contra el choque — `tomados` es la lista que el listado ya tiene
 * en memoria y puede estar desactualizada.
 */
export const slugCopia = (slug: string, tomados: readonly string[] = []): string => {
  const base = slug.replace(RE_SLUG_COPIA, '') || slug;
  const usados = new Set(tomados);
  const primero = `${base}-copia`;
  if (!usados.has(primero)) return primero;
  for (let n = 2; n < 1000; n++) {
    const candidato = `${base}-copia-${n}`;
    if (!usados.has(candidato)) return candidato;
  }
  // Inalcanzable en la práctica; mejor un slug feo que un loop infinito.
  return `${base}-copia-${Date.now().toString(36)}`;
};

/**
 * Suma días conservando la hora local. `+ n * MS_DIA` sobre el timestamp corre
 * el horario del encuentro si en el medio hay un cambio de horario de verano
 * (Argentina hoy no lo tiene, pero el navegador que carga puede estar en otro
 * huso). Con componentes locales, "los martes a las 19" sigue siendo a las 19.
 */
const sumarDias = (d: Date, dias: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
};

const fechas = (sesiones: readonly SesionForm[]): Date[] =>
  sesiones
    .flatMap((s) => [deDatetimeLocal(s.inicio), deDatetimeLocal(s.fin)])
    .filter((d): d is Date => d !== null);

/**
 * Cuántos días hay que correr el ciclo entero.
 *
 * Se conserva la estructura interna intacta —el mismo día de semana, la misma
 * hora, las mismas duraciones y los mismos huecos irregulares (§2.2: un
 * feriado que se saltea, una semana que se corre)— y se mueve el bloque
 * completo en **semanas enteras**: si el original era los martes a las 19, la
 * copia también.
 *
 * El piso es el más tardío entre hoy y el último encuentro del original:
 *
 * - Ciclo del año pasado → la copia arranca en la próxima aparición futura de
 *   ese día de semana. Con las fechas viejas, publicar la copia crearía eventos
 *   en el pasado.
 * - Ciclo en curso o por venir → la copia arranca después de que el original
 *   termine, que es lo que significa "la próxima edición".
 *
 * Nunca menos de una semana: una copia sentada exactamente sobre las fechas del
 * original no le sirve a nadie.
 */
export const diasDeDesplazamiento = (
  sesiones: readonly SesionForm[],
  ahora: Date = new Date(),
): number => {
  const todas = fechas(sesiones);
  if (todas.length === 0) return 0;

  const primera = Math.min(...todas.map((d) => d.getTime()));
  const ultima = Math.max(...todas.map((d) => d.getTime()));
  const piso = Math.max(ahora.getTime(), ultima);

  const semanas = Math.max(1, Math.ceil((piso - primera + 1) / MS_SEMANA));
  return semanas * 7;
};

const correr = (valor: string, dias: number): string => {
  const d = deDatetimeLocal(valor);
  // Una fecha vacía o inválida se deja como está: la validación del submit la
  // marca, y adivinarle un valor sería peor.
  return d ? aDatetimeLocal(sumarDias(d, dias)) : valor;
};

/** Copia de una sesión: id nuevo, sin evento de Calendar, y sin la cancelación. */
export const duplicarSesionParaCopia = (s: SesionForm, dias: number): SesionForm => ({
  ...s,
  id: nuevaSesionId(),
  inicio: correr(s.inicio, dias),
  fin: correr(s.fin, dias),
  // Una cancelación es una excepción del ciclo original ("ese martes no hubo"),
  // no una propiedad del ciclo nuevo. El encuentro se conserva, la cancelación no.
  cancelada: false,
  calendarEventId: null,
});

/**
 * Qué se copia al duplicar (B-199).
 *
 * Hasta acá duplicar copiaba todo lo copiable por spread y no se podía elegir.
 * Eso alcanzaba mientras todo lo copiable fuera texto de la actividad, pero hay
 * cosas que son de **esa edición** y no del ciclo: las notas internas de
 * difusión y los handles a arrobar de la temporada anterior se arrastraban sin
 * que nadie los revise, porque viven en un acordeón cerrado.
 *
 * **El default está decidido (2026-08-26): prendido lo que hoy se copia, y
 * apagado solo lo riesgoso.** El primer pedido era "todos apagados", y se
 * descartó con motivo: convertía *duplicar* en *actividad nueva*, y en el caso
 * real —«el mismo club, la temporada que viene»— habría que tildar quince
 * casillas para conseguir lo que hoy sale de un click. O sea: **el modal es para
 * desmarcar**, no para armar la copia de cero.
 *
 * El slug, el estado, los ids de sesión, `calendarEventId` y las cancelaciones
 * **no son casillas**: no se heredan y no son opcionales (ver arriba).
 */
export interface QueCopiar {
  descripcion: boolean;
  /** El tema y la lectura asignados a cada encuentro. */
  temas: boolean;
  /** Las imágenes **externas** (una URL de otro lado). */
  imagenes: boolean;
  /** El canal de inscripción, el cupo y el cierre. */
  inscripcion: boolean;
  material: boolean;
  tags: boolean;
  /** Notas internas y cuentas a arrobar. Nace apagada. */
  difusion: boolean;
  /**
   * Las imágenes **propias** (las que viven en nuestro Storage). Nace apagada.
   *
   * **La casilla ya no se muestra, y eso es un cambio deliberado de la segunda
   * tajada de B-167.** Mientras no se podía subir, la fila era inofensiva porque
   * `aplica` nunca daba `true`. Desde que se puede, daría `true` y sería **una
   * casilla que no hace nada**: tildarla no copiaría el objeto de Storage, y una
   * casilla que miente es peor que una función que falta.
   *
   * Lo que reemplaza a la fila es una línea en `SIEMPRE_AL_DUPLICAR`, que dice
   * que no se copian y por qué. La clave se conserva en el tipo porque el día que
   * se decida cómo copiarlas —el objeto de Storage, y duplicar deja de ser lógica
   * pura y puede fallar después de copiar dos de cuatro; o contar referencias, la
   * variante con estado compartido de B-71— la fila vuelve sin tocar nada más.
   */
  imagenesPropias: boolean;
}

/**
 * El default del 2026-08-26. **Es también el default del módulo**: un llamador
 * que no pase `copiar` obtiene esto y no el «copiá todo» anterior, así que la
 * decisión no depende de que la pantalla se acuerde de pasarla.
 */
export const COPIA_POR_DEFECTO: QueCopiar = {
  descripcion: true,
  temas: true,
  imagenes: true,
  inscripcion: true,
  material: true,
  tags: true,
  difusion: false,
  imagenesPropias: false,
};

/** Una fila del modal. */
export interface CasillaCopia {
  clave: keyof QueCopiar;
  label: string;
  /** Por qué uno querría destildarla. Se muestra debajo del label. */
  ayuda: string;
  /**
   * ¿El original tiene algo que copiar por esta casilla? Si no, la fila no se
   * muestra: una casilla que no cambia nada es ruido, y el modal tiene que
   * poder leerse de un vistazo para que se siga usando el botón.
   *
   * Va junto al label y no en un registro aparte a propósito (la lección de
   * B-75): dos listas que hay que mantener de acuerdo se desincronizan.
   */
  aplica: (o: ActividadForm) => boolean;
}

const conTexto = (s: string): boolean => s.trim() !== '';

/**
 * Las filas del modal, **en el orden de la pantalla**: primero lo que se hereda,
 * y al final las dos que nacen apagadas.
 *
 * Los labels están acá y no en el componente porque son parte de la decisión
 * —qué se ofrece destildar y cómo se llama— y así se pueden verificar sin
 * montar React (`docs/05-patrones.md`: el panel no tiene tests de componentes).
 */
export const CASILLAS_COPIA: readonly CasillaCopia[] = [
  {
    clave: 'descripcion',
    label: 'La descripción',
    ayuda: 'Si está escrita para la edición anterior, conviene empezar de cero.',
    aplica: (o) => conTexto(o.descripcion),
  },
  {
    clave: 'temas',
    label: 'El tema y la lectura de cada encuentro',
    ayuda: 'La temporada nueva suele leer otra cosa. Las fechas se copian igual.',
    aplica: (o) => o.sesiones.some((s) => conTexto(s.tema) || conTexto(s.lectura)),
  },
  {
    clave: 'imagenes',
    label: 'Las imágenes',
    ayuda: 'Son links a otro sitio. El flyer de la edición anterior suele tener la fecha encima.',
    aplica: (o) => o.imagenes.some((i) => i.origen === 'externa'),
  },
  {
    clave: 'inscripcion',
    label: 'El canal de inscripción, el cupo y el cierre',
    ayuda: 'El cierre se corre junto con las fechas. «Cupo completo» no se hereda nunca.',
    aplica: (o) =>
      conTexto(o.inscripcion.destino) ||
      o.inscripcion.via !== null ||
      o.inscripcion.cupo !== null ||
      conTexto(o.inscripcion.cierra),
  },
  {
    clave: 'material',
    label: 'El material: lecturas, guías y links',
    aplica: (o) => o.material.items.length > 0,
    ayuda: 'Los links quedan apuntando a donde apuntaban, con la misma forma de entrega.',
  },
  {
    clave: 'tags',
    label: 'Las etiquetas',
    ayuda: 'Casi siempre son las mismas: es el mismo tipo de actividad.',
    aplica: (o) => o.tags.length > 0,
  },
  {
    clave: 'difusion',
    label: 'La difusión: notas internas y cuentas a arrobar',
    ayuda:
      'Nace apagada: es trabajo interno de la otra edición y no se ve sin abrir el acordeón.',
    aplica: (o) => conTexto(o.difusion.notas) || o.difusion.arrobar.length > 0,
  },
  {
    clave: 'imagenesPropias',
    label: 'Las imágenes subidas al panel',
    ayuda: 'Nace apagada: la copia y el original compartirían el archivo, y borrar una rompe la otra.',
    // **Nunca se muestra**, y por eso `duplicarActividadForm` no tiene una rama
    // para esta clave. Ver el comentario de `QueCopiar.imagenesPropias`: desde que
    // se pueden subir imágenes propias, mostrarla sería ofrecer una casilla que no
    // hace nada. Lo que el usuario sí ve es la línea de `SIEMPRE_AL_DUPLICAR`.
    aplica: () => false,
  },
];

/** Las filas que tiene sentido mostrarle a esta actividad. */
export const casillasAplicables = (origen: ActividadForm): CasillaCopia[] =>
  CASILLAS_COPIA.filter((c) => c.aplica(origen));

/**
 * Lo que pasa siempre, tildado lo que se tilde. Es la letra chica del modal: son
 * decisiones tomadas (D-17, D-18, §7.3, trampa 2) y no opciones, y el lugar
 * donde se ven es justo antes de duplicar.
 */
export const SIEMPRE_AL_DUPLICAR: readonly string[] = [
  'El título queda marcado «(copia)» y la dirección web se propone con «-copia»: hay que cambiarla antes de publicar, porque queda fija.',
  'Las fechas se corren en semanas enteras, después del último encuentro del original: mismo día de semana y misma hora.',
  'La copia nace en borrador. No se publica nada ni se crea ningún evento en el calendario hasta que la revises.',
  'Los encuentros cancelados vuelven sin la cancelación, y «cupo completo» no se hereda.',
  // B-167, segunda tajada. Está acá y no como casilla porque no es opcional: la
  // copia y el original compartirían el mismo archivo en Storage, y borrar una le
  // rompería las imágenes a la otra. Las de URL sí se copian y tienen su casilla.
  'Las imágenes subidas al panel no se copian: hay que volver a subirlas. Las que son un link a otro sitio sí.',
];

/**
 * Form del original → form de la copia, listo para editar y guardar como
 * actividad nueva.
 *
 * `tomados` son los slugs que ya están en uso (el listado los tiene en
 * memoria); `ahora` se inyecta para poder testear el desplazamiento; `copiar`
 * es lo que se tildó en el modal (B-199), y lo que no venga sale de
 * `COPIA_POR_DEFECTO` — el default seguro, no «copiá todo».
 */
export const duplicarActividadForm = (
  origen: ActividadForm,
  opts: {
    tomados?: readonly string[];
    ahora?: Date;
    copiar?: Partial<QueCopiar>;
  } = {},
): ActividadForm => {
  const dias = diasDeDesplazamiento(origen.sesiones, opts.ahora ?? new Date());
  const copiar: QueCopiar = { ...COPIA_POR_DEFECTO, ...opts.copiar };

  return {
    ...origen,
    titulo: tituloCopia(origen.titulo),
    slug: slugCopia(origen.slug, opts.tomados),
    // Las fechas y la estructura del ciclo se copian siempre (D-17); el tema y
    // la lectura son lo elegible, porque son de esa temporada y no del ciclo.
    sesiones: origen.sesiones.map((s) => {
      const copia = duplicarSesionParaCopia(s, dias);
      return copiar.temas ? copia : { ...copia, tema: '', lectura: '' };
    }),
    descripcion: copiar.descripcion ? origen.descripcion : '',

    // Los anidados se copian en lugar de compartir la referencia con el
    // original: el form del original sale de `documentoAForm`, que sí comparte
    // objetos con el documento que el listado tiene en memoria. Editar la copia
    // no puede tocar nada del original, ni en el estado de React.
    /**
     * B-167 — la copia hereda las **externas** y no las propias.
     *
     * Una externa es una URL de otro lado: copiarla no cuesta nada y las dos
     * actividades pueden apuntar al mismo lugar sin interferir. Una propia vive
     * en nuestro Storage, y si la copia compartiera el `storagePath`, borrar una
     * le rompería las imágenes a la otra — la clase de B-71 con estado
     * compartido. La respuesta conservadora es no heredarlas: volver a subir
     * hasta cuatro fotos es barato al lado de un borrado que rompe a otro.
     *
     * B-199 lo volvió elegible: `copiar.imagenes` son las externas.
     *
     * **Las propias ya existen** —se pueden subir desde la segunda tajada de
     * B-167— y siguen sin copiarse **nunca**. Eso ya no es "todavía no se puede":
     * es la decisión, y por eso su casilla dejó de mostrarse (ver
     * `QueCopiar.imagenesPropias`) y el hecho pasó a `SIEMPRE_AL_DUPLICAR`.
     * Copiarlas necesita copiar el objeto de Storage —y duplicar deja de ser
     * lógica pura, y puede fallar después de copiar dos de cuatro— o contar
     * referencias, que es la variante con estado compartido de B-71. Si algún día
     * se resuelve, la rama va acá.
     *
     * Ids nuevos, como las sesiones: compartirlos haría que cualquier cosa que
     * compare por id crea que son la misma fila (trampa 2).
     */
    imagenes: (copiar.imagenes ? origen.imagenes.filter((i) => i.origen === 'externa') : [])
      // La portada se rearma sobre lo que quedó: si la del original no entró,
      // la copia quedaría sin ninguna y el schema pide exactamente una.
      .map((i, n) => ({ ...i, id: nuevaImagenId(), portada: n === 0 })),

    organizador: { ...origen.organizador },
    tallerista: origen.tallerista ? { ...origen.tallerista } : null,
    /**
     * DEC-1 — la copia **hereda el libro**. Duplicar una presentación es la
     * misma obra en otra fecha o en otra librería, que es el caso que hizo
     * existir a `duplicar` (§11: 30+ campos). Si es otro libro, son dos campos
     * de texto para pisar.
     *
     * Se copia el objeto en lugar de compartir la referencia, como el resto de
     * los anidados: el form del original sale de `documentoAForm`, que comparte
     * objetos con el documento que el listado tiene en memoria, y editar la
     * copia no puede tocar nada del original ni en el estado de React.
     */
    libro: { ...origen.libro },
    /**
     * B-224 — la copia hereda las formas de cursar **con ids nuevos**. Es la
     * trampa 2, la misma razón por la que no hereda los ids de sesión: dos
     * actividades con las mismas filas hacen que cualquier cosa que compare por
     * id crea que son la misma.
     *
     * Se hereda el lugar y **también la ventana de fechas**, a diferencia de las
     * sesiones, que se corren en semanas enteras: la ventana de una modalidad no
     * es un encuentro semanal, y correrla sería inventar un dato. Queda a la
     * vista en el formulario de la copia, que nace en borrador.
     *
     * `duplicarModalidad` copia los anidados en lugar de compartir la
     * referencia, como el resto: el form del original sale de `documentoAForm`,
     * que comparte objetos con el documento que el listado tiene en memoria, y
     * editar la copia no puede tocar nada del original ni en el estado de React.
     */
    modalidades: origen.modalidades.map(duplicarModalidad),
    arancel: { ...origen.arancel },
    material: copiar.material
      ? {
          tiene: origen.material.tiene,
          items: origen.material.items.map((i) => ({ ...i })),
        }
      // `tiene: false` y no solo la lista vacía: con la casilla prendida y cero
      // items, el schema pide "agregá al menos un material o destildá la casilla".
      : { tiene: false, items: [] },
    difusion: copiar.difusion
      ? { arrobar: [...origen.difusion.arrobar], notas: origen.difusion.notas }
      : { arrobar: [], notas: '' },
    tags: copiar.tags ? [...origen.tags] : [],

    inscripcion: {
      ...origen.inscripcion,
      /*
       * Destildar la inscripción vacía el canal, el cupo y el cierre, y deja
       * `requiere` como estaba: "¿hay que inscribirse?" es de la actividad, y
       * quien destildó esto no dijo que la copia sea con entrada libre. Lo que
       * queda sin llenar lo reclama el schema al publicar, no al abrir: la copia
       * nace borrador, así que el formulario no abre con errores encima (D-17).
       */
      ...(copiar.inscripcion ? {} : { via: null, destino: '', cupo: null }),
      // El cierre acompaña al ciclo: si no, queda en el pasado y la copia sale
      // con la inscripción cerrada (`abierta` en la proyección pública, §5.2).
      cierra: copiar.inscripcion ? correr(origen.inscripcion.cierra, dias) : '',
      /**
       * B-97 — la copia **no hereda «se llenó»**. Es el mismo criterio que
       * `cancelada` en las sesiones: que la edición anterior se haya llenado es un
       * hecho de esa edición, no una propiedad del ciclo nuevo, que todavía no
       * tiene una sola inscripción. Heredarlo publicaría «Cupo completo» en una
       * actividad con el cupo entero libre, y sale al sitio y al calendario.
       */
      completo: false,
    },
    // Duplicar no publica: nada llega al calendario hasta que el usuario revise
    // fechas y slug y publique a mano (§7.3).
    estado: 'borrador',
  };
};
