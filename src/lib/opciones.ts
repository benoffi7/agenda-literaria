import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import base from '@/lib/opciones-base.json';
import { db } from '@/lib/firebase-client';
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
 */
export const upsertOpcion = async (
  campo: CampoTaxonomia,
  label: string,
): Promise<string> => {
  const slug = slugify(label);
  if (!slug) throw new Error('La etiqueta quedó vacía después de normalizar.');

  const ref = refOpciones(campo);

  return runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists()) {
      // Primer uso del campo: sembramos las base junto con la nueva.
      const base = OPCIONES_BASE[campo];
      const existe = base.find((v) => v.slug === slug);
      const valores = existe
        ? base.map((v) => (v.slug === slug ? { ...v, usos: v.usos + 1 } : v))
        : [...base, { slug, label: label.trim(), orden: 99, fijo: false, usos: 1 }];
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
      tx.update(ref, {
        valores: [...valores, { slug, label: label.trim(), orden: 99, fijo: false, usos: 1 }],
      });
    }
    return slug;
  });
};

/** Registra el uso de varias etiquetas de una sola vez (caso `tags`). */
export const upsertOpciones = async (
  campo: CampoTaxonomia,
  labels: string[],
): Promise<string[]> => {
  const slugs: string[] = [];
  // En serie a propósito: son transacciones sobre el mismo documento y en
  // paralelo se pisarían/reintentarían entre ellas.
  for (const label of labels) {
    if (!label.trim()) continue;
    slugs.push(await upsertOpcion(campo, label));
  }
  return slugs;
};

/** Siembra las opciones base si el documento no existe (idempotente). */
export const sembrarOpciones = async (campo: CampoTaxonomia): Promise<void> => {
  const ref = refOpciones(campo);
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, { valores: OPCIONES_BASE[campo] });
};
