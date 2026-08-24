/**
 * Navegación por teclado: la aritmética del foco, sin DOM (B-14, B-64).
 *
 * El panel tenía el mismo patrón incompleto en dos lugares distintos —el menú
 * "⋯" de cada fila del listado y la capa del centro de ayuda—: los dos cerraban
 * con `Escape` y con un click afuera, los dos tenían sus controles alcanzables
 * con Tab, y a ninguno le funcionaban las flechas ni devolvía el foco al
 * abridor. Eran dos ítems separados del backlog (B-14 y el tercer punto de B-64)
 * porque se descubrieron mirando dos pantallas, pero es **una** clase.
 *
 * Lo que se comparte es justo lo que es fácil de escribir mal dos veces: dónde
 * cae el foco cuando se pasa del último ítem, y qué tecla mueve a dónde. La
 * parte que toca el DOM (buscar los elementos, llamar a `focus()`) queda en cada
 * componente, que es donde está el `ref`.
 */

/**
 * Qué cuenta como enfocable dentro de una capa.
 *
 * Se usa para el ciclo de Tab del diálogo. `[tabindex="-1"]` queda afuera a
 * propósito: es enfocable por programa (la caja del diálogo lo usa para recibir
 * el foco al abrirse) pero no es una parada de Tab.
 */
export const SELECTOR_ENFOCABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * El índice que sigue, dando la vuelta.
 *
 * Da la vuelta y no se detiene en los extremos porque es lo que hace el patrón
 * de menú de ARIA, y porque con dos ítems —los que tiene el menú del listado
 * hoy— un tope convierte la flecha en un botón que la mitad de las veces no hace
 * nada.
 *
 * Con la lista vacía devuelve `-1`: no hay dónde poner el foco, y quien llama
 * tiene que poder distinguir eso de "el primero".
 */
export const indiceSiguiente = (actual: number, cantidad: number, delta: number): number => {
  if (cantidad <= 0) return -1;
  /**
   * "Ninguno" no es una posición: es *afuera*, y de qué lado depende de para
   * dónde se va. Yendo hacia adelante arranca antes del primero; hacia atrás,
   * después del último. Tratarlo como el índice -1 a secas daba el penúltimo con
   * ↑ (`-1 - 1` da la vuelta a `cantidad - 2`), que es el bug silencioso de esta
   * cuenta: con dos ítems parece razonable y con tres ya está mal.
   */
  const desde = actual < 0 ? (delta > 0 ? -1 : cantidad) : actual;
  // El `+ cantidad` es para que un negativo no salga negativo del módulo de JS.
  return (((desde + delta) % cantidad) + cantidad) % cantidad;
};

/**
 * A qué índice manda una tecla dentro de una lista de opciones, o `null` si esa
 * tecla no es de navegación y quien llama no debe hacer nada con ella.
 *
 * `actual === -1` significa "todavía no hay nada enfocado": abrir el menú con
 * ↓ tiene que caer en el primero y con ↑ en el último, que es lo que hace
 * `indiceSiguiente` desde -1 sin ningún caso especial.
 *
 * Devolver `null` y no el índice actual importa: es lo que le dice al
 * componente que **no** llame a `preventDefault()`, así Tab, Escape y las
 * letras siguen funcionando como siempre.
 */
export const indiceDeTecla = (tecla: string, actual: number, cantidad: number): number | null => {
  if (cantidad <= 0) return null;
  switch (tecla) {
    case 'ArrowDown':
      return indiceSiguiente(actual, cantidad, 1);
    case 'ArrowUp':
      return indiceSiguiente(actual, cantidad, -1);
    case 'Home':
      return 0;
    case 'End':
      return cantidad - 1;
    default:
      return null;
  }
};

/**
 * El índice al que salta Tab dentro de una capa cerrada sobre sí misma.
 *
 * Es la otra mitad de lo mismo: sin esto, Tab desde el último control de la capa
 * se va al formulario de atrás —que sigue ahí, tapado— y quien navega con
 * teclado pierde el diálogo sin haberlo cerrado.
 *
 * `actual === -1` (el foco está en la caja del diálogo, no en un control) manda
 * al primero con Tab y al último con Shift+Tab.
 */
export const indiceDeTab = (actual: number, cantidad: number, haciaAtras: boolean): number =>
  indiceSiguiente(actual, cantidad, haciaAtras ? -1 : 1);
