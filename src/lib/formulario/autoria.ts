/**
 * Quién cargó una actividad, en el idioma del panel (B-130).
 *
 * **Por qué no dice el nombre de la otra persona.** El documento guarda
 * `createdBy`, que es un uid: no hay nombre ni mail que mostrar sin ir a
 * buscarlo. Las alternativas eran guardar el mail en el documento —cambia el
 * modelo y el §5.1 exige verificar que no se filtre— o cablear el mapa
 * uid→nombre, que es exactamente lo que queda viejo sin que nada falle.
 *
 * La pregunta que se reportó es más chica que eso: *"los eventos que crea el
 * otro admin también me aparecen, ¿no?"*. O sea **¿esto lo cargué yo?**, y eso
 * se contesta con el uid que el panel ya tiene en la sesión, sin tocar el
 * modelo ni arriesgar una filtración.
 *
 * Con dos cuentas —las que hay— "otra cuenta" identifica sola a la otra persona.
 * Con tres deja de alcanzar, y ahí sí se justifica guardar el mail: queda
 * anotado en el backlog como el momento de hacerlo, no antes.
 */

export type Autoria = 'propia' | 'ajena' | 'desconocida';

/**
 * `desconocida` es para los documentos anteriores a que se escribiera
 * `createdBy`: no se los marca como ajenos, porque afirmar de más sobre datos
 * viejos es peor que no decir nada.
 */
export const autoriaDe = (
  actividad: { createdBy?: string | null },
  uidActual: string | undefined,
): Autoria => {
  const creador = actividad.createdBy ?? '';
  if (!creador || !uidActual) return 'desconocida';
  return creador === uidActual ? 'propia' : 'ajena';
};

/** Lo que se lee en la fila. `null` = no se muestra nada. */
export const ETIQUETA_AUTORIA: Record<Autoria, string | null> = {
  // Lo propio no se marca: si todo lleva marca, la marca deja de avisar.
  propia: null,
  ajena: 'La cargó otra cuenta',
  desconocida: null,
};
