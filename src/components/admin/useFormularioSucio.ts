import { useEffect, useRef } from 'react';
import { marcarCambiosSinGuardar } from '@/lib/formulario-sucio';

/**
 * Marca el formulario como "con cambios sin guardar" en cuanto su estado se
 * aparta del inicial, para que nadie lo recargue por atrás (ver
 * `src/lib/formulario-sucio.ts`).
 *
 * Comparar el JSON del estado completo contra el snapshot inicial es lo más
 * simple que existe acá: un `useEffect` y nada más. La alternativa era tocar los
 * ~30 `onChange` del formulario o envolverlo en otra capa de estado; esto no
 * ensucia ninguna de las dos cosas.
 *
 * El costo es un `JSON.stringify` de unos pocos KB por tecleo, que al lado de
 * un re-render de React es ruido.
 *
 * Volver a mano a los valores originales cuenta como "sin cambios", y está
 * bien: si no quedó nada que perder, recargar no borra nada.
 */
export function useFormularioSucio(estado: unknown): void {
  const inicial = useRef<string | null>(null);

  useEffect(() => {
    const actual = JSON.stringify(estado);
    // Primer render: es el estado inicial, la referencia contra la que comparar.
    if (inicial.current === null) {
      inicial.current = actual;
      return;
    }
    marcarCambiosSinGuardar(actual !== inicial.current);
  }, [estado]);

  // Al desmontarse (guardó, canceló o volvió a la lista) no queda nada en juego.
  useEffect(() => () => marcarCambiosSinGuardar(false), []);
}
