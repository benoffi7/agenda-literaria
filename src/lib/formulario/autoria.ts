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

/**
 * **La marca con nombre y apellido** — B-888, tajada 2.
 *
 * Hasta acá la marca decía «La cargó otra cuenta» y el docblock de arriba explica
 * por qué el artículo era indefinido: no había con qué decir *cuál*, y cablear un
 * mapa uid→nombre era exactamente lo que D-610 rechazó por envejecer sin que nada
 * falle. Con `/usuarios` (D-650) hay con qué, y el mail **no envejece**: cada
 * cuenta lo refresca sola al entrar.
 *
 * ── Las tres decisiones de esta función ───────────────────────────────────
 *  - **Lo ajeno gana sobre lo último.** Se pregunta primero por quién la cargó y
 *    después por quién la tocó, y no al revés, porque «la cargó otra cuenta» es
 *    la pregunta que se reportó (B-130) y la que ordena el listado. El resultado
 *    lateral es que con el directorio vacío esta función devuelve **exactamente**
 *    lo que devolvía antes, así que el texto de B-130 no cambia hasta que alguien
 *    entre al panel y se registre.
 *  - **El fallback conserva el artículo indefinido.** Un uid que todavía no está
 *    en el directorio —una cuenta que no volvió a entrar desde que existe la
 *    colección— no se resuelve, y ahí se dice «otra cuenta» y no se inventa nada:
 *    es la misma regla que `autoriaDe` aplica con `desconocida`, y la que
 *    `tests/autoria.test.ts` fija para que la marca no envejezca con la cantidad
 *    de cuentas.
 *  - **Lo propio y sin tocar por nadie sigue sin marca.** Es lo de siempre: si
 *    todo lleva marca, la marca deja de avisar.
 */
export const marcaDeAutoria = (
  actividad: { createdBy?: string | null; updatedBy?: string | null },
  uidActual: string | undefined,
  mailes: ReadonlyMap<string, string>,
): string | null => {
  const quien = (uid: string): string => mailes.get(uid) ?? 'otra cuenta';

  if (autoriaDe(actividad, uidActual) === 'ajena') {
    return `La cargó ${quien(actividad.createdBy ?? '')}`;
  }
  const ultimo = actividad.updatedBy ?? '';
  // Lo cargué yo y lo cambió otro: es el dato nuevo, y el que el §12 ya guardaba
  // sin que el listado lo mostrara.
  if (ultimo && uidActual && ultimo !== uidActual) return `La cambió ${quien(ultimo)}`;
  return null;
};
