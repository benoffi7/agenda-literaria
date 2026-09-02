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
import { usosAContar } from '@/lib/formulario/etiquetas';
import { registrarUsos, upsertOpcion, upsertOpciones } from '@/lib/opciones';
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
  /**
   * B-340 — el documento tal como estaba antes de esta edición, para que
   * `usosAContar` cuente solo lo que cambió y no vuelva a sumar en cada
   * guardado un tipo, un arancel, un barrio o una etiqueta que ya estaban ahí.
   * Es el `inicial` que el formulario ya tiene al abrirse: ausente en una
   * actividad nueva, donde no hay nada previo que restar.
   */
  anterior?: {
    arancel: { tipo: string };
    tipo: string;
    modalidades: readonly {
      sede: { barrio: string } | null;
      online: { plataforma: string } | null;
    }[];
    tags: readonly string[];
  };
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
       * Las etiquetas nuevas que **no** llegaron a `/opciones/*`. Vacío es lo
       * esperable. Ver el comentario de orden de escritura, abajo.
       *
       * B-177 — era un booleano, y con un booleano el aviso solo podía decir
       * "alguna etiqueta no se registró", que no es accionable: hay hasta cinco
       * campos con taxonomía y el arreglo es volver a tipear **esa**. Son los
       * labels tal como se escribieron, no los slugs: es lo que la persona
       * reconoce de lo que acaba de cargar.
       */
      etiquetasSinRegistrar: readonly string[];
    }
  | { estado: 'error'; error: unknown };

export interface PuertosGuardado {
  slugDisponible: (slug: string, idActual?: string) => Promise<boolean>;
  upsertOpcion: (campo: CampoTaxonomia, label: string, uid: string) => Promise<string>;
  upsertOpciones: (campo: CampoTaxonomia, labels: string[], uid: string) => Promise<string[]>;
  registrarUsos: (campo: CampoTaxonomia, slugs: string[]) => Promise<void>;
  crearActividad: (f: ActividadForm, uid: string) => Promise<string>;
  actualizarActividad: (id: string, f: ActividadForm, uid: string) => Promise<void>;
}

/** Los puertos de verdad: Firestore. El default de producción. */
export const puertosFirestore: PuertosGuardado = {
  slugDisponible,
  upsertOpcion,
  upsertOpciones,
  registrarUsos,
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
  const { form, uid, estadoDestino, idActual, labelsNuevos, tagsNuevos, anterior } = entrada;
  // Desestructurados a propósito: el chequeo de clase de B-71
  // (`tests/clases-de-bug.test.ts`) busca las dos escrituras **por nombre en
  // todo `src/`** —el alta de opciones y la de la actividad, cada una precedida
  // por su `await`— para verificar cuál va primero. Llamarlas como
  // `puertos.<nombre>(...)` las esconde del chequeo, que entonces pasa sin
  // haber mirado nada.
  const {
    slugDisponible,
    upsertOpcion,
    upsertOpciones,
    registrarUsos,
    crearActividad,
    actualizarActividad,
  } = puertos;
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
    const labelsTags = guardado.tags.map((s) => tagsNuevos[s]).filter(Boolean) as string[];

    /*
     * B-177 — qué etiquetas quedaron sin registrar, no si quedó alguna.
     *
     * Se arranca del conjunto completo y cada alta que sale bien se descuenta,
     * así que lo que queda al salir por el `catch` es exactamente lo que no
     * llegó. Con un booleano el aviso decía "alguna etiqueta nueva no se
     * registró" y no cuál, y volver a tipear la que falta implica adivinar entre
     * cinco campos.
     *
     * **La clave es el par `campo|label`, no el label.** Lo encontró el
     * `auditor-trampas`: con un `Set` de labels, dos "Otro" tipeados igual en dos
     * campos distintos —un arancel "Nuevo" y un barrio "Nuevo", que es
     * exactamente lo que pasa cuando alguien duda y escribe lo mismo dos veces—
     * son **una** entrada. Si el alta del primero sale bien y la del segundo
     * falla, el éxito del primero borra la entrada compartida y el fallo del
     * segundo **desaparece**: el aviso dice que todo salió bien y queda una
     * taxonomía sin registrar que nadie sabe que hay que volver a tipear. El
     * separador es un `\0` porque no puede aparecer en un label.
     *
     * Lo que se **muestra** sí se deduplica por label: dos campos que fallaron
     * con el mismo texto son un solo nombre en pantalla, porque nombrarlo dos
     * veces no agrega información — es el mismo criterio que `resumirFaltantes`.
     */
    const clave = (campo: string, label: string) => `${campo}\0${label}`;
    const restantes = new Map<string, string>([
      ...labelsNuevos.map((l) => [clave(l.campo, l.label), l.label] as const),
      ...labelsTags.map((l) => [clave('tags', l), l] as const),
    ]);
    try {
      for (const { campo, label } of labelsNuevos) {
        await upsertOpcion(campo, label, uid);
        restantes.delete(clave(campo, label));
      }
      if (labelsTags.length) {
        // Una sola llamada para todos los tags, así que es todo o nada: si
        // `upsertOpciones` falla, ninguno quedó registrado.
        await upsertOpciones('tags', labelsTags, uid);
        for (const l of labelsTags) restantes.delete(clave('tags', l));
      }
    } catch {
      // Se sale con lo que quedó en `restantes`. No se reintenta acá: la
      // transacción del §4.2 ya reusa por slug, así que el reintento útil es el
      // de la persona volviendo a tipear la etiqueta, y eso lo habilita el aviso.
    }

    /*
     * §4.3 — recién acá se cuenta el uso, y va después del alta a propósito:
     * `registrarUsos` no crea el documento de opciones si no existe, así que
     * contar antes de sembrar no contaría nada. B-168 / D-103.
     *
     * En su propio `try` desde B-177, y eso **cambia lo que el flag significa**.
     * Antes compartía el `catch` con las altas, así que un fallo al contar el uso
     * se reportaba como "la etiqueta no se registró" —y es mentira: la etiqueta
     * está, lo que no se contó es el uso—. El aviso de pantalla mandaría a
     * arreglar algo que no está roto. Un fallo acá **no se reporta**: lo único
     * que se pierde es una posición en el orden del desplegable, y avisar de eso
     * gasta la atención que el aviso necesita para lo que sí importa.
     */
    try {
      for (const [campo, slugs] of Object.entries(
        usosAContar(guardado, labelsNuevos, tagsNuevos, anterior),
      ) as [CampoTaxonomia, string[]][]) {
        await registrarUsos(campo, slugs);
      }
    } catch {
      // Ver arriba: silencioso a propósito.
    }

    return { estado: 'ok', id, guardado, etiquetasSinRegistrar: [...new Set(restantes.values())] };
  } catch (error) {
    return { estado: 'error', error };
  }
};
