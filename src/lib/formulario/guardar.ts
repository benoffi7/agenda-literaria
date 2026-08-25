/**
 * El caso de uso de guardar una actividad desde el panel.
 *
 * Era el cuerpo de `guardar()` dentro de `ActividadFormulario.tsx`: validación,
 * chequeo del slug, alta de las etiquetas nuevas en la taxonomía y escritura de
 * la actividad, todo mezclado con `setState` y con la analítica (B-70).
 *
 * Acá adentro no hay React ni analítica: entra el formulario, sale un
 * resultado. Lo que sí hay son escrituras, así que las dependencias de Firestore
 * entran como **puertos** con un default real (`puertosFirestore`). No es
 * ceremonia: es lo que permite testear el orden de las escrituras —que es el bug
 * B-71— sin emuladores y sin poder tocar datos de verdad.
 */
import { actualizarActividad, crearActividad, slugDisponible } from '@/lib/actividades';
import { upsertOpcion, upsertOpciones } from '@/lib/opciones';
import { actividadFormSchema } from '@/lib/schema';
import { slugify } from '@/lib/slugify';
import type { ActividadForm, CampoTaxonomia } from '@/types/actividad';
import type { LabelNuevo } from '@/lib/formulario/etiquetas';

/** Lo que el schema rechazó, en la forma en que el formulario lo muestra. */
export interface IssueDeForm {
  path: readonly (string | number)[];
  message: string;
}

export interface EntradaGuardado {
  form: ActividadForm;
  /** uid de quien guarda: autor del documento y huella de la opción nueva (§4.3). */
  uid: string;
  /**
   * Estado al que se guarda, cuando el botón lo fuerza ("Guardar borrador").
   * Sin esto se guarda con el estado que tiene el formulario.
   */
  estadoDestino?: ActividadForm['estado'];
  /** Id de la actividad que se está editando. Ausente = creación. */
  idActual?: string;
  /** Etiquetas tipeadas en "Otro" que todavía no están en `/opciones/*` (D-02). */
  labelsNuevos: readonly LabelNuevo[];
  /** Ídem para tags, que son multivalor: `slug → label`. */
  tagsNuevos: Record<string, string>;
}

export type ResultadoGuardado =
  | { estado: 'invalido'; errores: Record<string, string>; issues: readonly IssueDeForm[] }
  | { estado: 'slug-tomado'; errores: Record<string, string> }
  | {
      estado: 'ok';
      id: string;
      /** El formulario tal como se guardó, ya con el slug normalizado. */
      guardado: ActividadForm;
      /**
       * La actividad se escribió pero alguna etiqueta nueva no llegó a
       * `/opciones/*`. Ver el comentario de orden de escritura, abajo.
       */
      etiquetasSinRegistrar: boolean;
    }
  | { estado: 'error'; error: unknown };

export interface PuertosGuardado {
  slugDisponible: (slug: string, idActual?: string) => Promise<boolean>;
  upsertOpcion: (campo: CampoTaxonomia, label: string, uid: string) => Promise<string>;
  upsertOpciones: (campo: CampoTaxonomia, labels: string[], uid: string) => Promise<string[]>;
  crearActividad: (f: ActividadForm, uid: string) => Promise<string>;
  actualizarActividad: (id: string, f: ActividadForm, uid: string) => Promise<void>;
}

/** Los puertos de verdad: Firestore. El default de producción. */
export const puertosFirestore: PuertosGuardado = {
  slugDisponible,
  upsertOpcion,
  upsertOpciones,
  crearActividad,
  actualizarActividad,
};

/** Los errores del schema, indexados como los muestra el formulario. */
export const erroresDeIssues = (issues: readonly IssueDeForm[]): Record<string, string> => {
  const mapa: Record<string, string> = {};
  for (const issue of issues) mapa[issue.path.join('.')] = issue.message;
  return mapa;
};

export const guardarActividad = async (
  entrada: EntradaGuardado,
  puertos: PuertosGuardado = puertosFirestore,
): Promise<ResultadoGuardado> => {
  const { form, uid, estadoDestino, idActual, labelsNuevos, tagsNuevos } = entrada;
  // Desestructurados a propósito: el chequeo de clase de B-71
  // (`tests/clases-de-bug.test.ts`) busca las dos escrituras **por nombre en
  // todo `src/`** —el alta de opciones y la de la actividad, cada una precedida
  // por su `await`— para verificar cuál va primero. Llamarlas como
  // `puertos.<nombre>(...)` las esconde del chequeo, que entonces pasa sin
  // haber mirado nada.
  const { slugDisponible, upsertOpcion, upsertOpciones, crearActividad, actualizarActividad } =
    puertos;
  const candidato: ActividadForm = estadoDestino ? { ...form, estado: estadoDestino } : form;

  // §11 — los condicionales por tipo y modalidad se validan en el submit, no
  // por campo (D-01).
  const parsed = actividadFormSchema.safeParse(candidato);
  if (!parsed.success) {
    const issues = parsed.error.issues as readonly IssueDeForm[];
    return { estado: 'invalido', errores: erroresDeIssues(issues), issues };
  }

  try {
    const slug = slugify(candidato.slug);
    if (!(await slugDisponible(slug, idActual))) {
      return { estado: 'slug-tomado', errores: { slug: 'Ya hay otra actividad con este slug' } };
    }

    const guardado: ActividadForm = { ...candidato, slug };

    // ── Orden de escritura: la actividad primero, las etiquetas después ──
    //
    // B-71 — al revés (como estaba), una escritura de la actividad que falla
    // —red, permisos, un slug que se tomó en el medio— dejaba las opciones ya
    // creadas colgadas en el desplegable, sin UI para limpiarlas (B-06). Era
    // basura permanente en la taxonomía, justo lo que D-02 quería evitar.
    //
    // En este orden el peor caso es que el slug quede guardado sin estar
    // registrado en `/opciones/*`, y de eso ya hay red: el evento público
    // resuelve la etiqueta con el des-slug de D-11 ("Con Beca Parcial" en lugar
    // de "Con beca parcial") y volver a tipearla la registra. Se pasa de perder
    // datos a perder una capitalización.
    const id = idActual
      ? (await actualizarActividad(idActual, guardado, uid), idActual)
      : await crearActividad(guardado, uid);

    // §4.2 — las etiquetas nuevas se incorporan al desplegable acá, en
    // transacción y reusando por slug si ya existían. §4.3 — el uid queda como
    // huella de autor: la opción sirve para esta cuenta hasta que se apruebe.
    //
    // Un fallo acá **no** vuelve fallido el guardado: la actividad ya está
    // escrita, y reportar error haría que el segundo intento choque contra su
    // propio slug (`slugDisponible` ya lo ve tomado) sobre un formulario que
    // en realidad se guardó bien.
    let etiquetasSinRegistrar = false;
    try {
      for (const { campo, label } of labelsNuevos) {
        await upsertOpcion(campo, label, uid);
      }
      const labelsTags = guardado.tags.map((s) => tagsNuevos[s]).filter(Boolean) as string[];
      if (labelsTags.length) await upsertOpciones('tags', labelsTags, uid);
    } catch {
      etiquetasSinRegistrar = true;
    }

    return { estado: 'ok', id, guardado, etiquetasSinRegistrar };
  } catch (error) {
    return { estado: 'error', error };
  }
};
