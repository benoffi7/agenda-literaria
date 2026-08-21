/**
 * Vista previa del evento de Google Calendar (B-12).
 *
 * El panel vuelca ~20 campos del formulario a la descripción del evento (D-09)
 * y hasta ahora la única forma de ver el resultado era publicar y mirar el
 * calendario.
 *
 * **No duplica la construcción del evento.** Importa `construirEvento` de
 * `@calendario`, la misma función que corre en la Cloud Function: si la vista
 * previa armara su propio texto, las dos versiones se separarían en el primer
 * cambio y la vista previa mentiría — y una vista previa que miente es peor que
 * no tenerla. De paso sale gratis la parte más delicada: las reglas de
 * privacidad del §5.1 (el link de la reunión solo con `urlPublica`, la difusión
 * interna nunca, la URL del material privado tampoco) las aplica esa función,
 * no este archivo.
 *
 * Acá viven solo las dos adaptaciones que el formulario necesita:
 *
 *  1. **Fechas.** `construirDescripcion` espera `Timestamp` de Firestore
 *     (`.toDate()`, `.toMillis()`) y el formulario tiene strings de
 *     `datetime-local`. La conversión la hace `formADocumento`, la misma que
 *     corre al guardar, así que la vista previa ve exactamente el documento que
 *     se va a escribir.
 *  2. **Etiquetas.** La actividad guarda slugs (§4.1) y la descripción muestra
 *     etiquetas. En la Function eso se resuelve leyendo `/opciones/*`; en el
 *     panel se arma con las opciones que el formulario ya tiene cargadas.
 */
import { construirEvento, debeExistir } from '@calendario';
import { formADocumento } from '@/lib/actividades';
import { deDatetimeLocal } from '@/lib/sesiones';
import {
  CAMPOS_TAXONOMIA,
  type ActividadForm,
  type CampoTaxonomia,
  type Estado,
  type Online,
  type Sesion,
  type ValorOpcion,
} from '@/types/actividad';

/** `{ campo: { slug: etiqueta } }` — la forma que espera `@calendario`. */
export type LabelsTaxonomia = Partial<Record<CampoTaxonomia, Record<string, string>>>;

/**
 * Mapa de etiquetas a partir de las opciones que el panel ya tiene cargadas.
 *
 * `pendientes` son las etiquetas creadas con "Otro" que todavía no están en
 * `/opciones/*`: se persisten en el submit y no al tipearlas (D-02), así que sin
 * esto la vista previa las mostraría des-slugueadas ("Con Beca Parcial" en lugar
 * de "Con beca parcial") y no coincidiría con el evento publicado.
 */
export const labelsDeOpciones = (
  porCampo: Partial<Record<CampoTaxonomia, ValorOpcion[]>>,
  pendientes: LabelsTaxonomia = {},
): LabelsTaxonomia => {
  const labels: LabelsTaxonomia = {};
  for (const campo of CAMPOS_TAXONOMIA) {
    labels[campo] = {
      ...Object.fromEntries((porCampo[campo] ?? []).map((v) => [v.slug, v.label])),
      ...(pendientes[campo] ?? {}),
    };
  }
  return labels;
};

/** Lo que la vista previa muestra de un evento. */
export interface EventoPrevisualizado {
  /** `summary` del evento: título de la actividad más el tema del encuentro. */
  titulo: string;
  /** `location`. `null` cuando el evento sale sin ubicación. */
  ubicacion: string | null;
  /** `description` completa, texto plano con saltos de línea. */
  descripcion: string;
  /**
   * §7.3 — el evento existe en el calendario solo si la actividad está
   * publicada y el encuentro no está cancelado. Si es `false`, la vista previa
   * muestra cómo quedaría, no algo que hoy esté publicado.
   */
  saleAlCalendario: boolean;
  /** D-15 — el link de la reunión sale en la descripción de este evento. */
  linkPublicado: boolean;
  /** Hay link cargado pero no se publica: se envía a quienes se inscriban. */
  linkReservado: boolean;
}

export type ResultadoVistaPrevia =
  | { ok: true; evento: EventoPrevisualizado }
  | { ok: false; motivo: string };

/** Los campos del documento que la vista previa mira para sus avisos. */
interface DocumentoParaPrevia {
  estado: Estado;
  sesiones: Sesion[];
  online: Online | null;
}

/**
 * ¿Alguna fecha del formulario está incompleta? `formADocumento` tira error en
 * ese caso, y en la vista previa eso es lo normal mientras se está cargando un
 * encuentro, no una excepción.
 */
const fechasIncompletas = (form: ActividadForm): boolean =>
  form.sesiones.some((s) => !deDatetimeLocal(s.inicio) || !deDatetimeLocal(s.fin)) ||
  Boolean(form.inscripcion.cierra && !deDatetimeLocal(form.inscripcion.cierra));

/**
 * Cómo va a quedar el evento del encuentro `sesionId`. Si ese id no está (se
 * borró la fila mientras la vista previa estaba abierta) cae al primero.
 */
export const vistaPreviaEvento = (
  form: ActividadForm,
  sesionId: string | null,
  labels: LabelsTaxonomia = {},
): ResultadoVistaPrevia => {
  const elegida = form.sesiones.find((s) => s.id === sesionId) ?? form.sesiones[0];
  if (!elegida) {
    return { ok: false, motivo: 'Agregá un encuentro para ver cómo queda el evento.' };
  }
  if (fechasIncompletas(form)) {
    return {
      ok: false,
      motivo: 'Completá las fechas de los encuentros para ver cómo queda el evento.',
    };
  }

  // El uid solo alimenta los campos de auditoría, que nunca salen al evento
  // (§5.1). `esNuevo: false` para no agregar `createdAt`/`createdBy`, que acá
  // tampoco significan nada.
  const documento = formADocumento(form, '', false) as unknown as DocumentoParaPrevia;
  const sesion = documento.sesiones.find((s) => s.id === elegida.id);
  if (!sesion) {
    return { ok: false, motivo: 'Agregá un encuentro para ver cómo queda el evento.' };
  }

  const evento = construirEvento(documento, sesion, labels);
  const online = documento.online;

  return {
    ok: true,
    evento: {
      titulo: evento.summary,
      ubicacion: evento.location ?? null,
      descripcion: evento.description,
      saleAlCalendario: debeExistir(documento, sesion),
      linkPublicado: Boolean(online?.url && online.urlPublica),
      linkReservado: Boolean(online?.url && !online.urlPublica),
    },
  };
};
