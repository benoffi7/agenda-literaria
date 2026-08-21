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
import type { CampoTaxonomia, DocOpciones, ValorOpcion } from '@/types/actividad';

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
 * Orden del desplegable: primero las fijas por su `orden`, después las creadas
 * por "Otro" por frecuencia real de uso — mejor que alfabético (§4.3).
 */
export const ordenarValores = (valores: ValorOpcion[]): ValorOpcion[] =>
  [...valores].sort((a, b) => {
    if (a.fijo !== b.fijo) return a.fijo ? -1 : 1;
    if (a.fijo) return a.orden - b.orden;
    if (b.usos !== a.usos) return b.usos - a.usos;
    return a.label.localeCompare(b.label, 'es');
  });

/**
 * §4.3 — ¿la opción está validada? Las fijas lo están por definición: son las
 * base, las que puede haber cableadas en la lógica.
 *
 * **El campo ausente cuenta como aprobada, y eso es deliberado.** Los
 * documentos de `/opciones/*` que ya están en producción se escribieron antes
 * de que existiera `aprobada`, y `preparar-produccion.mjs` no los pisa (es
 * idempotente). Tratar la ausencia como "pendiente" haría desaparecer del
 * desplegable opciones que hoy se usan y que ya están guardadas en actividades
 * publicadas: el formulario mostraría el slug crudo en lugar de la etiqueta y
 * quien edite esa actividad tendría que volver a elegir un valor que ya estaba
 * bien.
 *
 * La regla general: un campo nuevo sobre documentos que ya existen se lee con
 * el default que preserva el comportamiento anterior. Solo lo nuevo arranca
 * pendiente, porque solo lo nuevo se escribe con el campo puesto.
 */
export const estaAprobada = (v: ValorOpcion): boolean => v.fijo || (v.aprobada ?? true);

/**
 * §4.3 — qué opciones puede elegir quien está mirando: las aprobadas, más las
 * que creó esa persona y todavía esperan validación.
 *
 * Sin `uid` devuelve solo las aprobadas. Ese es el caso del sitio público: el
 * `events.json` del §4.4 no debe publicar vocabulario sin validar.
 *
 * Ojo: esto filtra lo **elegible**, no lo que se puede *resolver*. La etiqueta
 * de un slug pendiente se sigue mostrando (en el formulario y en el calendario)
 * porque la actividad lo guardó legítimamente; esconderlo mostraría el slug
 * crudo, que se ve roto.
 */
export const opcionesVisibles = (valores: ValorOpcion[], uid?: string): ValorOpcion[] => {
  const huella = uid ? huellaCreador(uid) : '';
  return valores.filter(
    (v) => estaAprobada(v) || (huella !== '' && v.huellaCreador === huella),
  );
};

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
 * §4.3 — lo que se crea acá nace **pendiente de aprobación** y marcado con la
 * huella de su autor: funciona igual para quien la creó (la actividad se guarda
 * con este slug) pero no entra al desplegable de los demás hasta validarse.
 * Reusar una opción existente solo suma un uso: no toca `aprobada` ni la huella,
 * así que registrar el uso de una opción base no la vuelve pendiente ni le
 * cambia el autor.
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
    label: label.trim(),
    orden: 99,
    fijo: false,
    usos: 1,
    aprobada: false,
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

/** Siembra las opciones base si el documento no existe (idempotente). */
export const sembrarOpciones = async (campo: CampoTaxonomia): Promise<void> => {
  const ref = refOpciones(campo);
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, { valores: OPCIONES_BASE[campo] });
};
