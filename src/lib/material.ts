import type { ItemMaterial } from '@/types/actividad';

/**
 * B-342 — el id de un ítem de material se genera al crear la fila del
 * formulario, nunca por índice del array. Mismo patrón y mismo fallback que
 * `nuevaSesionId()`, `nuevaImagenId()` y `nuevaModalidadId()`.
 *
 * **No es la trampa 2** en el sentido estricto —un ítem de material no
 * sincroniza con Calendar ni con Storage, así que renumerarlo no borra nada
 * del otro lado—, pero es la misma clase: `key={i}` reusa el nodo del DOM, así
 * que borrar la primera de tres filas movía el foco y el cursor a la fila de
 * al lado, y un estado local por fila (si se agrega en el futuro) saltaría de
 * fila. El chasis compartido (`FilasEditor`) ya asume ids de cliente para
 * todas las listas que edita.
 */
export const nuevaItemMaterialId = (): string => {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : // Fallback para contextos sin crypto.randomUUID (no debería pasar en
        // localhost ni en https, pero no queremos ids colisionables).
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `mat_${uuid}`;
};

/**
 * El id determinístico de un ítem de material que ya estaba en el documento
 * antes de B-342 y no tiene `id` — mismo patrón que `ID_IMAGEN_MIGRADA`
 * (D-125), sufijado con el índice porque acá, a diferencia de la galería
 * (que migraba desde un único `imagenUrl`), puede haber **varios** ítems sin
 * id en el mismo array: sin el índice, dos filas migradas colisionarían en
 * la misma clave y el chasis de filas confundiría una con la otra.
 *
 * Tiene que ser determinístico: un uuid nuevo en cada lectura haría que el
 * formulario naciera "con cambios sin guardar" cada vez que se abre una
 * actividad vieja sin tocar nada (la misma advertencia que D-125 hace sobre
 * el id de la imagen migrada).
 */
export const idItemMaterialMigrado = (indice: number): string => `mat_legacy_${indice}`;

/** Un ítem de material en blanco, con su id ya generado. */
export const itemMaterialVacio = (): ItemMaterial => ({
  id: nuevaItemMaterialId(),
  tipo: 'lectura',
  titulo: '',
  url: '',
  entrega: 'previo',
  // Por defecto privado: publicar un link por error es más caro que el clic
  // extra de tildarlo (§5.1).
  publico: false,
});

/** La copia de un ítem de material, con id nuevo (misma razón que `duplicarModalidad`). */
export const duplicarItemMaterial = (i: ItemMaterial): ItemMaterial => ({
  ...i,
  id: nuevaItemMaterialId(),
});
