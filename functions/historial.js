/**
 * §12 — Lógica pura del historial de versiones. Sin dependencias de Firebase ni
 * de red: la parte frágil acá es decidir *cuándo* se guarda una versión, y eso
 * se puede testear sin emuladores (mismo criterio que `calendario.js`).
 *
 * El problema que resuelve: con edición habilitada, tarde o temprano alguien
 * pisa una descripción larga y la quiere de vuelta. Hoy eso se pierde para
 * siempre, y es lo más cercano a pérdida de datos que tiene el sistema.
 *
 * La trampa: `onDocumentUpdated` sobre `actividades/{id}` se dispara con TODA
 * escritura, y `syncCalendar` escribe `calendarEventId` de vuelta en `sesiones`
 * después de sincronizar. Guardar una versión en cada disparo generaría, por
 * cada publicación, una versión del cambio real y otra del write-back de la
 * Function. Ver `huboCambioDeContenido`.
 */

/**
 * Cuántas versiones se conservan por actividad. Ver `versionesAborrar` para el
 * motivo de que la retención sea por cantidad y no por antigüedad.
 */
export const MAX_VERSIONES = 20;

/**
 * Los campos que escribe la máquina, no una persona.
 *
 * Es lo único que se enumera a mano, y es deliberadamente el complemento de lo
 * que uno esperaría: **no** hay lista de campos "importantes". Igual que la
 * guarda anti-loop del sync (D-07), lo relevante se *deriva* — acá, "todo lo
 * que una persona pudo haber tipeado" — en vez de mantenerse a mano.
 *
 * La diferencia de dirección importa, y es lo que hace segura a esta lista:
 *
 *  - Con una lista blanca de campos recuperables, agregar un campo al modelo y
 *    olvidarse de sumarlo a la lista hace que pisar ese campo **no** guarde
 *    versión: pérdida de datos, en silencio. Es exactamente lo que esta feature
 *    existe para evitar.
 *  - Con esta lista negra, olvidarse de sumar un campo nuevo que escriba la
 *    máquina genera una versión **de más**: un documento de basura, visible,
 *    barato y acotado por la retención.
 *
 * Ante la duda, entonces, se guarda. Un campo nuevo del modelo entra solo.
 */
const CAMPOS_DE_MAQUINA = ['updatedAt', 'updatedBy'];

/** Ídem dentro de cada sesión. `calendarEventId` es EL caso que rompe todo. */
const CAMPOS_DE_MAQUINA_SESION = ['calendarEventId'];

/**
 * Forma canónica de un valor de Firestore, comparable con `JSON.stringify`.
 *
 * Dos razones para no serializar el documento crudo:
 *
 *  1. `JSON.stringify` respeta el orden de inserción de las claves, y nada
 *     garantiza que dos lecturas de Firestore entreguen los campos en el mismo
 *     orden. Un reordenamiento se leería como una edición.
 *  2. Un `Timestamp` serializa a su representación interna. Dos Timestamp del
 *     mismo instante tienen que comparar iguales.
 */
const canonico = (valor) => {
  if (valor === null || valor === undefined) return null;

  // Timestamp de Firestore (y cualquier cosa con la misma forma: los tests
  // arman timestamps mínimos, igual que hace `calendario.js`).
  if (typeof valor?.toMillis === 'function') return { instante: valor.toMillis() };
  if (typeof valor?.toDate === 'function') return { instante: valor.toDate().getTime() };

  if (Array.isArray(valor)) return valor.map(canonico);

  if (typeof valor === 'object') {
    return Object.fromEntries(
      Object.keys(valor)
        .sort()
        .map((clave) => [clave, canonico(valor[clave])]),
    );
  }

  return valor;
};

/**
 * El documento sin lo que escribe la máquina: lo que queda es lo que una
 * persona cargó y podría querer de vuelta.
 *
 * Un campo ausente y un campo en `null` NO se unifican a propósito: unificarlos
 * suprimiría versiones, y de los dos errores posibles ese es el caro.
 */
export const contenidoEditable = (documento) => {
  if (!documento) return null;

  const limpio = { ...documento };
  for (const campo of CAMPOS_DE_MAQUINA) delete limpio[campo];

  if (Array.isArray(limpio.sesiones)) {
    limpio.sesiones = limpio.sesiones.map((sesion) => {
      const copia = { ...sesion };
      for (const campo of CAMPOS_DE_MAQUINA_SESION) delete copia[campo];
      return copia;
    });
  }

  return canonico(limpio);
};

/**
 * Los campos de primer nivel cuyo contenido editable cambió, ordenados.
 *
 * Se guarda en la versión para que la subcolección se pueda leer desde la
 * consola de Firestore sin abrir cada documento: mientras no haya UI de
 * restauración (B-40), esto es lo que hace usable el historial.
 */
export const camposCambiados = (antes, despues) => {
  const a = contenidoEditable(antes) ?? {};
  const b = contenidoEditable(despues) ?? {};

  const claves = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return claves.filter((clave) => JSON.stringify(a[clave]) !== JSON.stringify(b[clave]));
};

/**
 * §12 y D-41 — ¿Esta escritura pisó algo que a una persona le interesaría
 * recuperar?
 *
 * Mismo criterio que la guarda anti-loop del sync (D-07): en vez de mantener
 * una lista de campos, se deriva lo que importa —el contenido editable— y se
 * compara eso.
 *
 * El write-back de `calendarEventId` de `syncCalendar` produce, por
 * construcción, el mismo contenido editable antes y después: no genera
 * versión. No es un acuerdo entre dos listas que alguien puede romper por
 * olvido, es una propiedad de la derivación.
 *
 * Efecto lateral bueno: guardar el formulario sin cambiar nada (que igual
 * escribe `updatedAt`/`updatedBy`) tampoco deja una versión idéntica a la
 * anterior.
 */
export const huboCambioDeContenido = (antes, despues) =>
  camposCambiados(antes, despues).length > 0;

/**
 * Id del documento de versión (D-43).
 *
 * El §12 propone el timestamp solo, y ahí hay un agujero: dos escrituras en el
 * mismo milisegundo colisionan y la segunda **pisa** a la primera. Perder una
 * versión es justo lo que esta feature viene a evitar, así que el id lleva
 * además el id del evento que la generó.
 *
 * Dos propiedades que salen de eso:
 *
 *  - **Único:** dos disparos simultáneos son dos eventos distintos, así que no
 *    se pisan aunque caigan en el mismo milisegundo.
 *  - **Idempotente:** Cloud Functions v2 entrega *al menos* una vez. Un
 *    reintento del mismo evento tiene el mismo instante y el mismo id, así que
 *    reescribe el mismo documento en vez de duplicar la versión.
 *
 * El instante va en ISO-8601 y no en milisegundos porque mientras no haya UI
 * (B-40) el historial se lee desde la consola de Firestore: ahí el id es todo
 * lo que se ve de un documento. Y al ser de ancho fijo, el orden lexicográfico
 * de los ids es el orden cronológico — de eso depende `versionesAborrar`.
 */
export const idDeVersion = (instante, eventoId) => {
  const iso = new Date(instante).toISOString().replace(/[:.]/g, '-');
  // Firestore acepta casi cualquier cosa en un id, pero un id que se copia y
  // pega desde la consola conviene que sea alfanumérico.
  const sufijo = String(eventoId ?? '').replace(/[^A-Za-z0-9-]/g, '');
  return sufijo ? `${iso}_${sufijo}` : iso;
};

/**
 * Cuáles versiones borrar para no pasarse del tope, de un conjunto de ids.
 *
 * **Retención por cantidad, no por antigüedad (D-42).** Una actividad muy
 * editada acumula copias del documento entero: no acotarlo hubiera sido una
 * decisión implícita. Se eligió el tope por cantidad porque:
 *
 *  - Por antigüedad falla justo en el caso de uso: el escenario real es "pisé
 *    la descripción hace meses y recién ahora me doy cuenta". Un ciclo cargado
 *    en marzo, editado una vez y revisado en diciembre habría perdido su única
 *    versión útil con cualquier TTL razonable.
 *  - Por cantidad el crecimiento queda acotado y siempre se conservan las N
 *    más nuevas, que son las que se piden ("volver atrás lo último que hice"),
 *    incluido el caso de las ocho ediciones seguidas.
 *
 * `MAX_VERSIONES = 20` cubre eso de sobra: 20 copias de un documento de pocos
 * KB por actividad es storage irrelevante.
 *
 * Depende de que el id ordene cronológicamente, que es lo que garantiza
 * `idDeVersion`.
 */
export const versionesAborrar = (ids, max = MAX_VERSIONES) => {
  const ordenados = [...ids].sort();
  if (max <= 0) return ordenados;
  return ordenados.slice(0, Math.max(0, ordenados.length - max));
};
