/**
 * Buffer de etiquetas creadas con "Otro" que todavía no están en `/opciones/*`.
 *
 * D-02 — se persisten en el submit y no al tipearlas: abandonar el formulario a
 * mitad de camino no debe dejar basura en la taxonomía (§4.3). La consecuencia
 * es que entre que se tipean y que se guardan hay etiquetas que solo existen en
 * la memoria del formulario, y la vista previa del evento las necesita para no
 * mostrarlas des-slugueadas.
 *
 * Puro: es el reducer del buffer más la proyección al mapa que consume
 * `lib/vistaPreviaEvento.ts`. Estaba dentro del `.tsx` (B-70).
 */
import { slugify } from '@/lib/slugify';
import type { LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import { CAMPOS_MULTIVALOR, type CampoMultivalor } from '@/types/actividad';

/**
 * Los campos con taxonomía de **valor único**. Los multivalor no están acá:
 * viven en `CAMPOS_MULTIVALOR` (`types/actividad.ts`) y su buffer es un mapa
 * `slug → label` que arma `TagsInput`, uno por campo.
 *
 * Las dos listas juntas tienen que dar `CAMPOS_TAXONOMIA`: lo fija
 * `tests/taxonomia.test.ts`, para que una taxonomía nueva no quede sin buffer.
 */
export type CampoLabelUnico =
  | 'arancel'
  | 'tipo'
  | 'barrio'
  | 'plataforma'
  // B-832 — los tres campos de **un solo slug** de una suscripción literaria. No
  // los usa el formulario de actividad (viven en `SuscripcionFormulario`), y
  // están acá igual porque lo que esta lista cubre es **la taxonomía**, no el
  // formulario: `tests/taxonomia.test.ts` exige que entre las dos familias estén
  // todas las de `CAMPOS_TAXONOMIA`, para que ninguna se quede sin buffer de
  // etiquetas nuevas.
  | 'periodicidad'
  | 'tipo-oferente'
  | 'perfil-editorial'
  // B-833 — los dos campos de **un solo slug** de un lugar para eventos. Mismo
  // motivo que los tres de arriba: lo que esta lista cubre es **la taxonomía**,
  // no el formulario de actividad.
  | 'tipo-lugar'
  | 'condicion-de-uso';

/**
 * El buffer de las taxonomías **multivalor**: `campo → slug → label`.
 *
 * Era un solo `Record<string, string>` porque `tags` era la única multivalor.
 * Con `incluye-actividad` (B-830) son dos, así que el mecanismo se generalizó en
 * vez de copiarse — la clase de B-72, y con dos consumidores es el momento más
 * barato para hacerlo. El día que entren `incluye-suscripcion` e `incluye-lugar`
 * (`docs/prd/README.md` § 3) no hay nada que tocar acá.
 */
export type MultivalorNuevos = Partial<Record<CampoMultivalor, Record<string, string>>>;

export interface LabelNuevo {
  campo: CampoLabelUnico;
  label: string;
}

/**
 * Registra la etiqueta recién tipeada en un campo de valor único.
 *
 * Reemplaza la anterior del mismo campo en lugar de acumularla: el campo tiene
 * un solo valor, así que la etiqueta previa ya no se va a guardar y persistirla
 * crearía en la taxonomía una opción que nadie eligió — el `usos: 1` colgado
 * del que se queja el §4.3.
 *
 * Sin `label` (se eligió una opción que ya existe) no hay nada que recordar.
 */
export const recordarLabel = (
  previos: readonly LabelNuevo[],
  campo: CampoLabelUnico,
  label?: string,
): LabelNuevo[] =>
  label ? [...previos.filter((l) => l.campo !== campo), { campo, label }] : [...previos];

/**
 * Mapa `campo → slug → label` con las etiquetas que todavía no están en
 * `/opciones/*`, para que la vista previa muestre "Con beca parcial" y no
 * "Con Beca Parcial" (el des-slug de D-11) donde el evento publicado va a decir
 * lo primero.
 *
 * El slug se deriva con `slugify` —el mismo que usa la transacción del §4.2— y
 * las etiquetas se recortan igual que al persistirlas: si acá se guardara el
 * texto con espacios y allá sin, la vista previa mentiría por un espacio.
 */
export const labelsPendientesDe = (
  labelsNuevos: readonly LabelNuevo[],
  multivalorNuevos: MultivalorNuevos,
): LabelsTaxonomia => {
  const mapa: LabelsTaxonomia = {};
  for (const { campo, label } of labelsNuevos) {
    mapa[campo] = { ...mapa[campo], [slugify(label)]: label.trim() };
  }
  for (const campo of CAMPOS_MULTIVALOR) {
    const entradas = Object.entries(multivalorNuevos[campo] ?? {});
    if (entradas.length) {
      mapa[campo] = Object.fromEntries(entradas.map(([slug, label]) => [slug, label.trim()]));
    }
  }
  return mapa;
};

/**
 * La forma mínima de una actividad que `usosAContar` necesita mirar — la misma
 * para el documento que se guarda y para el que había antes de editarlo
 * (B-340).
 */
interface DatosDeUsos {
  arancel: { tipo: string };
  tipo: string;
  // B-224 — `sede` y `online` viven adentro de cada modalidad, y siguen siendo
  // nulos según cuál sea (§11): una fila virtual no tiene barrio y una presencial
  // no tiene plataforma. Se recorren **todas** las filas: con dos sedes en dos
  // barrios, contar solo la primera dejaría al segundo barrio sin uso y ordenando
  // último en el desplegable para siempre. Los vacíos los descarta el filtro de
  // abajo, y `registrarUsos` ya ignora los slugs vacíos.
  modalidades: readonly {
    sede: { barrio: string } | null;
    online: { plataforma: string } | null;
  }[];
  tags: readonly string[];
  /** B-830 — opcional en el tipo por lo mismo que el `?? []` de abajo. */
  incluye?: readonly string[];
}

/** Los slugs elegidos, campo por campo, sin repetir dentro de un mismo campo. */
const elegidosDe = (datos: DatosDeUsos) => ({
  arancel: [datos.arancel.tipo],
  tipo: [datos.tipo],
  // `?? []` — mismo criterio defensivo que el resto de los lectores del
  // documento crudo (`actividades.ts`, `toPublic.ts`): `guardado` sale de
  // `ActividadForm`, siempre completo, pero `anterior` (B-340) puede venir de
  // cualquier llamador futuro. Sin esto, un `anterior` incompleto tira un
  // `TypeError` que el `catch` silencioso de `guardar.ts` traga, y `usos` deja
  // de contarse para las cinco taxonomías sin ningún síntoma (lo señaló el
  // `auditor-privacidad`).
  barrio: [...new Set((datos.modalidades ?? []).map((m) => m.sede?.barrio ?? ''))],
  plataforma: [...new Set((datos.modalidades ?? []).map((m) => m.online?.plataforma ?? ''))],
  tags: [...(datos.tags ?? [])],
  'incluye-actividad': [...(datos.incluye ?? [])],
});

/**
 * Los slugs de taxonomía que esta actividad **eligió**, campo por campo, para
 * que `registrarUsos` sume el `usos` del §4.3 (B-86, B-168, D-103).
 *
 * **Se restan los que se acaban de crear.** `upsertOpcion` los siembra con
 * `usos: 1`, así que contarlos otra vez los dejaría en 2 y el orden por
 * frecuencia arrancaría torcido justo para las opciones nuevas — que son las que
 * el §4.3 quiere poder distinguir de la basura ("una opción con `usos: 1` creada
 * hace meses es casi seguro un typo colgado"). Si esa resta se cae, el síntoma es
 * silencioso: números plausibles y un orden mal.
 *
 * **Y se restan los que ya estaban en `anterior` (B-340).** Sin `anterior`,
 * `usos` contaba *veces guardado* y no *cuántas actividades usan esta opción*:
 * editar la misma actividad doce veces —barato desde B-183, que guarda
 * borradores en cada tecleo— le sumaba doce a su tipo, su arancel, su barrio y
 * sus etiquetas, y eso rompía justo lo que el §4.3 le pide a `usos`: ordenar
 * por frecuencia real y detectar un `usos: 1` como typo colgado. `anterior` es
 * el documento tal como estaba **antes de esta edición** —el `inicial` que ya
 * tiene el formulario al abrirse, sin necesidad de una lectura extra—, así que
 * solo cuenta lo que la edición agregó. Sin `anterior` (una actividad nueva) se
 * cuenta todo, que es lo que corresponde: no había nada antes que restar.
 *
 * Puro y sobre el form ya guardado, no sobre el estado del componente: cuenta lo
 * que quedó escrito, no lo que se tipeó y después se cambió.
 */
export const usosAContar = (
  guardado: DatosDeUsos,
  labelsNuevos: readonly LabelNuevo[],
  multivalorNuevos: MultivalorNuevos,
  anterior?: DatosDeUsos,
): Partial<Record<CampoLabelUnico | CampoMultivalor, string[]>> => {
  const recienCreados = labelsPendientesDe(labelsNuevos, multivalorNuevos);
  const nuevoEn = (campo: keyof LabelsTaxonomia, slug: string) =>
    Boolean(recienCreados[campo]?.[slug]);

  const elegidos = elegidosDe(guardado);
  const elegidosAntes = anterior ? elegidosDe(anterior) : null;
  const yaEstabaAntes = (campo: keyof typeof elegidos, slug: string) =>
    Boolean(elegidosAntes?.[campo].includes(slug));

  const salida: Partial<Record<keyof typeof elegidos, string[]>> = {};
  for (const [campo, slugs] of Object.entries(elegidos) as [keyof typeof elegidos, string[]][]) {
    const aContar = slugs.filter((s) => s && !nuevoEn(campo, s) && !yaEstabaAntes(campo, s));
    if (aContar.length) salida[campo] = aContar;
  }
  return salida;
};
