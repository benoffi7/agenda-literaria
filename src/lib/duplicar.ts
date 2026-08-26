import { nuevaImagenId } from '@/lib/imagenes';
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
 * Form del original → form de la copia, listo para editar y guardar como
 * actividad nueva.
 *
 * `tomados` son los slugs que ya están en uso (el listado los tiene en
 * memoria); `ahora` se inyecta para poder testear el desplazamiento.
 */
export const duplicarActividadForm = (
  origen: ActividadForm,
  opts: { tomados?: readonly string[]; ahora?: Date } = {},
): ActividadForm => {
  const dias = diasDeDesplazamiento(origen.sesiones, opts.ahora ?? new Date());

  return {
    ...origen,
    titulo: tituloCopia(origen.titulo),
    slug: slugCopia(origen.slug, opts.tomados),
    sesiones: origen.sesiones.map((s) => duplicarSesionParaCopia(s, dias)),

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
     * compartido. Mientras no exista el modal de B-199, que va a dejar elegir
     * qué se duplica, la respuesta conservadora es no heredarlas: volver a subir
     * hasta cuatro fotos es barato al lado de un borrado que rompe a otro.
     *
     * Ids nuevos, como las sesiones: compartirlos haría que cualquier cosa que
     * compare por id crea que son la misma fila (trampa 2).
     */
    imagenes: origen.imagenes
      .filter((i) => i.origen === 'externa')
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
    sede: origen.sede
      ? { ...origen.sede, geo: origen.sede.geo ? { ...origen.sede.geo } : null }
      : null,
    online: origen.online ? { ...origen.online } : null,
    arancel: { ...origen.arancel },
    material: {
      tiene: origen.material.tiene,
      items: origen.material.items.map((i) => ({ ...i })),
    },
    difusion: { arrobar: [...origen.difusion.arrobar], notas: origen.difusion.notas },
    tags: [...origen.tags],

    inscripcion: {
      ...origen.inscripcion,
      // El cierre acompaña al ciclo: si no, queda en el pasado y la copia sale
      // con la inscripción cerrada (`abierta` en la proyección pública, §5.2).
      cierra: correr(origen.inscripcion.cierra, dias),
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
