/**
 * ¿Hay un formulario con cambios sin guardar?
 *
 * Es un store de módulo de diez líneas en lugar de un contexto de React, y es a
 * propósito: el aviso de versión nueva vive fuera del árbol del formulario, así
 * que pasarle el dato por props obligaba a cablear `AdminApp` → vista →
 * formulario, y un contexto obligaba a envolver el árbol entero. Acá el
 * formulario solo avisa y quien necesita el dato se suscribe. Nada en el medio
 * se enteró.
 *
 * Para qué: recargar la página mientras alguien completa los 30+ campos del
 * §11 le borra varios minutos de trabajo. Eso es peor que tener el JS viejo.
 *
 * Es estado de UI de una sola pestaña: no se persiste ni viaja a Firestore.
 */
let sucio = false;
const oyentes = new Set<() => void>();

export const hayCambiosSinGuardar = (): boolean => sucio;

export const marcarCambiosSinGuardar = (valor: boolean): void => {
  if (valor === sucio) return;
  sucio = valor;
  for (const oyente of oyentes) oyente();
};

/** Devuelve la función para desuscribirse (va derecho al cleanup de un efecto). */
export const observarCambiosSinGuardar = (oyente: () => void): (() => void) => {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
};
