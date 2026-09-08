import type { ActividadForm, Comision, SesionForm } from '@/types/actividad';

/*
 * Las comisiones del ciclo — B-181. «Opciones para sumarse» en la pantalla,
 * `comisiones` en el código: el porqué del nombre está en el docblock de
 * `Comision` (`src/types/actividad.ts`), y en una línea es que `opciones` ya
 * significa la taxonomía del §4 en todo este repo.
 *
 * **Lo que NO vive acá:** de qué comisión es un encuentro y cómo se numera dentro
 * de ella. Eso es `comisionDe` y `numeroDeEncuentro` en `functions/calendario.js`,
 * importables con `@calendario`, porque el evento de Calendar y el panel tienen
 * que contar igual (D-20, D-71, y B-84 fue la vez que no contaron igual).
 */

/**
 * Id de una comisión. **Generado en el cliente al crear la fila, nunca por
 * índice del array** — es la trampa 2: borrar la segunda comisión renumera todo
 * y cada encuentro apuntaría al grupo equivocado, que es peor que el diff de
 * sesiones porque acá el dato mal no se ve (el encuentro sigue ahí, con la
 * etiqueta de otro).
 *
 * Mismo patrón y mismo fallback que `nuevaSesionId()` y `nuevaModalidadId()`.
 */
export const nuevaComisionId = (): string => {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `com_${uuid}`;
};

/** Una comisión nueva, sin nombre todavía: lo escribe el que la creó. */
export const comisionVacia = (etiqueta = ''): Comision => ({
  id: nuevaComisionId(),
  etiqueta,
});

/**
 * ¿Este ciclo tiene comisiones? Es la pregunta que decide si el formulario
 * muestra el desplegable en cada encuentro y si la página pública agrupa.
 *
 * Se pregunta por la lista y no por `esCiclo`: una actividad puede tener
 * comisiones sin que nadie haya tildado el ciclo, y el schema no lo prohíbe.
 */
export const tieneComisiones = (a: { comisiones?: readonly Comision[] }): boolean =>
  (a.comisiones ?? []).length > 0;

/**
 * Los encuentros agrupados por comisión, **en el orden de `comisiones`** y con
 * los huérfanos al final.
 *
 * El orden es el de la lista de comisiones y no el de aparición en `sesiones`:
 * es el que el dueño arma en el formulario, y el que se mantiene igual aunque se
 * reordenen o se borren encuentros. La bolsa `sinComision` existe para que un
 * documento incoherente —que el schema no deja publicar, pero que puede llegar
 * editado a mano— **muestre sus encuentros** en vez de esconderlos: perder una
 * fila en pantalla es el peor de los dos errores posibles.
 */
export const porComision = <S extends { comisionId?: string | null }>(
  comisiones: readonly Comision[],
  sesiones: readonly S[],
): { grupos: { comision: Comision; sesiones: S[] }[]; sinComision: S[] } => {
  const ids = new Set(comisiones.map((c) => c.id));
  return {
    grupos: comisiones.map((comision) => ({
      comision,
      sesiones: sesiones.filter((s) => s.comisionId === comision.id),
    })),
    sinComision: sesiones.filter((s) => !s.comisionId || !ids.has(s.comisionId)),
  };
};

/**
 * Saca una comisión de la lista **y desengancha sus encuentros**.
 *
 * Las dos cosas van juntas y en una sola función a propósito: borrar la comisión
 * sin tocar las sesiones deja los `comisionId` apuntando a un id que ya no
 * existe, que es exactamente lo que el schema rechaza al publicar. El que borra
 * desde la UI no tiene por qué acordarse de la segunda mitad.
 *
 * **Los encuentros no se borran.** Son fechas cargadas a mano; que desaparezcan
 * por sacar una etiqueta sería destruir trabajo sin preguntar. Quedan sin
 * comisión, visibles, y el schema pide que se les asigne una antes de publicar.
 */
export const sinComision = (form: ActividadForm, id: string): ActividadForm => ({
  ...form,
  comisiones: form.comisiones.filter((c) => c.id !== id),
  sesiones: form.sesiones.map(
    (s): SesionForm => (s.comisionId === id ? { ...s, comisionId: null } : s),
  ),
});
