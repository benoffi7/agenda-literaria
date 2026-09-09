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
 * **Y con cuatro cuentas la marca sigue sirviendo** (B-179 · B-811 · D-610).
 * Escrito cuando había dos, este comentario decía que "otra cuenta" identifica
 * sola a la otra persona y que con tres dejaba de alcanzar, así que ahí había
 * que guardar el mail. Desde el 2026-09-08 hay cuatro y esa promesa se revisó:
 * **el trabajo de la marca es contestar "¿esto lo cargué yo?"**, que es la
 * pregunta que se reportó, y esa se contesta igual de bien con cuatro cuentas
 * que con dos. Lo que caducó fue un efecto de al lado —que "no fuiste vos"
 * equivalía a "fue la otra persona"— que nunca fue el requerimiento.
 *
 * Por eso el texto dice "otra cuenta" y no "la otra cuenta": el artículo
 * indefinido es lo que hace que no envejezca con la cantidad de cuentas. El
 * rótulo de taxonomías pagó exactamente ese bug ("la usaron **las** dos
 * cuentas"), y `tests/autoria.test.ts` lo fija acá.
 *
 * **Y "quién tocó qué" ya está, mejor resuelto:** el historial del §12 guarda
 * `updatedBy` en cada escritura, o sea cada cambio y no solo la creación.
 * Guardar el mail en el documento sumaría un dato personal al modelo —que entra
 * al historial, así que borrar una cuenta no lo borra, y que hay que seguir
 * excluyendo de cada salida pública— para contestar peor algo que el historial
 * ya contesta.
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
