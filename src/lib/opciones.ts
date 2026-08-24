import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import base from '@/lib/opciones-base.json';
// `firestore-client` y no `firebase-client`: el corte del bundle (B-09) saca
// Firestore del chunk de login. Importarlo del módulo de auth lo trae de vuelta.
import { db } from '@/lib/firestore-client';
import { huellaCreador } from '@/lib/huella';
import { slugify } from '@/lib/slugify';
import {
  estaAprobada,
  etiquetaPresentable,
  opcionesVisibles,
  ordenarValores,
} from '@/lib/taxonomia';
import type { CampoTaxonomia, DocOpciones, ValorOpcion } from '@/types/actividad';

/**
 * Las reglas puras del §4 viven en `taxonomia.ts` (B-72) y se re-exportan acá
 * para que nadie tenga que cambiar de import: este módulo sigue siendo la
 * puerta única a `/opciones/*`.
 */
export { estaAprobada, etiquetaPresentable, opcionesVisibles, ordenarValores };

/**
 * §4 — patrón genérico de taxonomía: desplegable enumerado + casilla "Otro"
 * cuyo valor se incorpora al desplegable para usos futuros.
 * Una sola implementación resuelve arancel, tipo, barrio, plataforma y tags.
 */

const refOpciones = (campo: CampoTaxonomia) => doc(db(), 'opciones', campo);

/**
 * Opciones base (`fijo: true`) — no se borran ni renombran desde la UI (§4.3).
 * Viven en un JSON aparte porque los comparte el script de seed de los
 * emuladores, que corre en Node plano y no puede importar TypeScript.
 */
export const OPCIONES_BASE = base as Record<CampoTaxonomia, ValorOpcion[]>;

/**
 * Todas las opciones del campo, ordenadas. **No filtra por aprobación**: quien
 * las muestre decide qué es elegible con `opcionesVisibles`, pero resolver la
 * etiqueta de un slug necesita la lista completa.
 */
export const leerOpciones = async (campo: CampoTaxonomia): Promise<ValorOpcion[]> => {
  const snap = await getDoc(refOpciones(campo));
  const valores = (snap.data() as DocOpciones | undefined)?.valores;
  return ordenarValores(valores ?? OPCIONES_BASE[campo]);
};

/** Suscripción en vivo: una opción nueva aparece sola en el desplegable. */
export const observarOpciones = (
  campo: CampoTaxonomia,
  cb: (valores: ValorOpcion[]) => void,
) =>
  onSnapshot(refOpciones(campo), (snap) => {
    const valores = (snap.data() as DocOpciones | undefined)?.valores;
    cb(ordenarValores(valores ?? OPCIONES_BASE[campo]));
  });

/**
 * §4.2 — antes de crear, busca si ya existe por slug.
 * "A la Gorra " → "a-la-gorra" → ya existe → reusa, no duplica.
 *
 * Va en transacción porque dos guardados simultáneos con la misma etiqueta
 * nueva pisarían el array uno al otro.
 *
 * §4.3 — lo que se crea acá queda marcado con la huella de su autor y **nace
 * aprobada** (B-131, decisión del dueño). Reusar una opción existente solo suma
 * un uso: no toca `aprobada` ni la huella, así que registrar el uso de una
 * opción base no la vuelve pendiente ni le cambia el autor.
 *
 * B-05 — el label se guarda con `etiquetaPresentable`: el slug es la identidad
 * y esto es lo que se ve, en el desplegable, en el evento de Calendar y en los
 * chips del sitio (§4.4).
 */
export const upsertOpcion = async (
  campo: CampoTaxonomia,
  label: string,
  uid: string,
): Promise<string> => {
  const slug = slugify(label);
  if (!slug) throw new Error('La etiqueta quedó vacía después de normalizar.');

  const ref = refOpciones(campo);
  const nueva = (): ValorOpcion => ({
    slug,
    label: etiquetaPresentable(label),
    orden: 99,
    fijo: false,
    usos: 1,
    /*
     * `true` por decisión, no por descuido (B-131). El dueño decidió que una
     * etiqueta nueva quede disponible para las dos cuentas enseguida: el §4.2
     * —slugify más el autocompletado— ya ataja los duplicados antes de que
     * nazcan, y la aprobación agregaba control de vocabulario, no corrección.
     *
     * Con esto la maquinaria de aprobación (`estaAprobada`,
     * `opcionesVisibles`, `huellaCreador`, `aprobarOpcion`, la pantalla de
     * taxonomías y `scripts/aprobar-opciones.mjs`) queda **dormida, no
     * muerta**: se deja entera para el escenario que anticipa el §4.3 ("si en
     * el futuro carga gente además del dueño"). Volver a poner `false` acá la
     * prende de nuevo, y nada más. `tests/opciones-aprobacion.test.ts` fija
     * este default para que no se dé vuelta sin que nadie lo note.
     */
    aprobada: true,
    huellaCreador: huellaCreador(uid),
  });

  return runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists()) {
      // Primer uso del campo: sembramos las base junto con la nueva.
      const base = OPCIONES_BASE[campo];
      const existe = base.find((v) => v.slug === slug);
      const valores = existe
        ? base.map((v) => (v.slug === slug ? { ...v, usos: v.usos + 1 } : v))
        : [...base, nueva()];
      tx.set(ref, { valores });
      return slug;
    }

    const valores = (snap.data() as DocOpciones).valores ?? [];
    const existe = valores.find((v) => v.slug === slug);

    if (existe) {
      tx.update(ref, {
        valores: valores.map((v) =>
          v.slug === slug ? { ...v, usos: (v.usos ?? 0) + 1 } : v,
        ),
      });
    } else {
      tx.update(ref, { valores: [...valores, nueva()] });
    }
    return slug;
  });
};

/** Registra el uso de varias etiquetas de una sola vez (caso `tags`). */
export const upsertOpciones = async (
  campo: CampoTaxonomia,
  labels: string[],
  uid: string,
): Promise<string[]> => {
  const slugs: string[] = [];
  // En serie a propósito: son transacciones sobre el mismo documento y en
  // paralelo se pisarían/reintentarían entre ellas.
  for (const label of labels) {
    if (!label.trim()) continue;
    slugs.push(await upsertOpcion(campo, label, uid));
  }
  return slugs;
};

/**
 * §4.3 · B-86 — suma un uso a opciones que **ya existen**.
 *
 * `usos` tiene dos trabajos: ordenar el desplegable por frecuencia real y
 * delatar basura ("una opción con `usos: 1` creada hace meses es casi seguro un
 * typo colgado"). Los dos necesitan que elegir una opción del desplegable
 * cuente, no solo crearla: sin esto todas las creadas se quedan clavadas en 1 y
 * las base en 0, así que `ordenarValores` ordena por etiqueta y la señal de
 * basura no distingue el typo del barrio que se usa todas las semanas.
 *
 * Una sola transacción por campo, no una por slug: es el caso `tags`, donde una
 * actividad puede traer cinco.
 *
 * **Los slugs que no existen se ignoran a propósito.** Sin label no hay opción
 * que crear, y crear una des-slugueada acá metería vocabulario que nadie tipeó.
 * El que falta lo crea `upsertOpcion`, que ya nace con `usos: 1`.
 *
 * **Quien llame no debe pasar los slugs que acaba de crear con `upsertOpcion`**
 * en el mismo guardado: ya vienen con su primer uso contado y se sumarían dos
 * veces. Repetir un slug dentro de la misma llamada cuenta una sola vez: una
 * actividad usa una etiqueta, no la usa N veces.
 */
export const registrarUsos = async (
  campo: CampoTaxonomia,
  slugs: string[],
): Promise<void> => {
  const aContar = new Set(slugs.filter(Boolean));
  if (aContar.size === 0) return;

  const ref = refOpciones(campo);
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    // Sin documento no hay nada que contar: lo siembra `upsertOpcion` o
    // `sembrarOpciones`. Contar acá obligaría a inventar el array entero.
    if (!snap.exists()) return;

    const valores = (snap.data() as DocOpciones).valores ?? [];
    if (!valores.some((v) => aContar.has(v.slug))) return;

    tx.update(ref, {
      valores: valores.map((v) =>
        aContar.has(v.slug) ? { ...v, usos: (v.usos ?? 0) + 1 } : v,
      ),
    });
  });
};

/**
 * Cambia un valor del array de un campo, en transacción, con las dos guardas
 * del §4.3: la opción tiene que existir y no puede ser `fijo`.
 *
 * Es la base de las tres operaciones de la pantalla de taxonomías (B-06). Está
 * en un solo lugar porque la guarda de `fijo` es lo único que separa "renombré
 * una etiqueta" de "rompí el badge verde de «Gratis» que está cableado en la
 * lógica", y una guarda copiada tres veces se olvida en la cuarta.
 */
const editarValor = async (
  campo: CampoTaxonomia,
  slug: string,
  cambio: (v: ValorOpcion) => ValorOpcion | null,
): Promise<void> => {
  const ref = refOpciones(campo);
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    const valores = snap.exists() ? ((snap.data() as DocOpciones).valores ?? []) : [];
    const actual = valores.find((v) => v.slug === slug);
    if (!actual) throw new Error(`La opción «${slug}» ya no está en ${campo}.`);
    if (actual.fijo) {
      throw new Error(
        `«${actual.label}» es una opción base: no se puede editar ni borrar desde el panel (§4.3).`,
      );
    }

    const nuevo = cambio(actual);
    tx.update(ref, {
      valores: nuevo
        ? valores.map((v) => (v.slug === slug ? nuevo : v))
        : valores.filter((v) => v.slug !== slug),
    });
  });
};

/**
 * §4.1 · B-06 — renombra la etiqueta de una opción **sin tocar su slug**.
 *
 * Que el slug no cambie es el punto del §4.1 ("la actividad guarda solo el
 * `slug`, así renombrar el label no obliga a tocar ningún documento de
 * actividad"): arreglar "narrativa" → "Narrativa" no puede desconectar las
 * actividades que ya la usan. Por eso el slug del label nuevo no se recalcula,
 * y por eso esto también es el arreglo de las etiquetas que ya están cargadas
 * mal (B-05).
 *
 * Los eventos ya publicados se re-sincronizan solos: `rebuildPorOpciones`
 * detecta el renombre (D-93).
 */
export const renombrarOpcion = async (
  campo: CampoTaxonomia,
  slug: string,
  label: string,
): Promise<string> => {
  const nuevo = etiquetaPresentable(label);
  if (!nuevo) throw new Error('La etiqueta no puede quedar vacía.');
  await editarValor(campo, slug, (v) => ({ ...v, label: nuevo }));
  return nuevo;
};

/**
 * §4.3 · B-06 — borra una opción creada con "Otro".
 *
 * No busca ni actualiza las actividades que la usan, y no puede: son hasta
 * cientos de documentos y esto corre en el navegador. Una actividad que la
 * tenga guardada sigue mostrando su etiqueta des-slugueada (D-11), que es
 * exactamente el respaldo para el que se escribió. Quien borra lo ve avisado en
 * la pantalla: la opción con `usos > 0` se confirma aparte.
 */
export const borrarOpcion = async (campo: CampoTaxonomia, slug: string): Promise<void> =>
  editarValor(campo, slug, () => null);

/**
 * §4.3 · B-25 — aprueba una opción pendiente desde el panel, sin necesitar una
 * máquina con Node y `gcloud` (que es lo que pide
 * `scripts/aprobar-opciones.mjs`, y desde el teléfono no hay).
 *
 * Idempotente: aprobar algo ya aprobado no cambia nada. No toca `usos` ni la
 * huella del autor, que es el rastro de quién la creó.
 *
 * Hoy nada nace pendiente (B-131), así que esto solo aplica a las opciones que
 * quedaron pendientes antes de esa decisión — y al día en que se vuelva a
 * prender la aprobación.
 */
export const aprobarOpcion = async (campo: CampoTaxonomia, slug: string): Promise<void> =>
  editarValor(campo, slug, (v) => ({ ...v, aprobada: true }));

/** Siembra las opciones base si el documento no existe (idempotente). */
export const sembrarOpciones = async (campo: CampoTaxonomia): Promise<void> => {
  const ref = refOpciones(campo);
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, { valores: OPCIONES_BASE[campo] });
};
