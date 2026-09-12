/**
 * B-77 — la carga de las etiquetas de taxonomía, en su propio módulo.
 *
 * §4.1 — la actividad guarda solo el slug de cada taxonomía, así que para que la
 * descripción del evento diga "A la gorra" y no "a-la-gorra" hay que resolver las
 * etiquetas contra `/opciones/*`. Lo necesitan los **dos** triggers del lado de
 * Calendar (`syncCalendar` y `rebuildPorOpciones`), y por eso vive acá y no en
 * ninguno de los dos: con el caché en uno de ellos, el otro tendría el suyo y
 * `invalidarLabels` no serviría de nada.
 *
 * Recibe el `db` en vez de importar `firebase-admin`, mismo criterio que
 * `referenciasEnUso` (`limpieza-imagenes.js`).
 */

/**
 * D-20 — las taxonomías que **el evento de Calendar muestra**, escritas de este
 * lado: `functions/` se despliega con su propio `package.json` y no puede
 * importar hacia arriba. Se evaluó y se descartó; la respuesta acordada es un
 * test que ate las dos listas, no un import imposible — y desde B-830 ese test
 * existe (`clases-de-bug.test.ts`).
 *
 * **No es una copia de `CAMPOS_TAXONOMIA`, y desde B-830 tampoco lo parece.** Es
 * un **subconjunto**: `incluye-actividad` no está porque el evento no dice qué se
 * llevan (ver el docblock del campo en `src/types/actividad.ts`), y pedir sus
 * etiquetas sería una lectura más de Firestore en cada invocación para un dato
 * que `construirDescripcion` nunca mira.
 *
 * El test lo ata en las dos direcciones: todo campo de acá tiene que existir
 * arriba —si no, `db.getAll` leería un documento que no es de ninguna taxonomía—
 * y el que falte tiene que estar en la lista de ausencias justificadas, para que
 * la próxima taxonomía obligue a decidir en vez de entrar (o quedar afuera) sola.
 */
export const CAMPOS_TAXONOMIA = ['arancel', 'tipo', 'barrio', 'plataforma', 'tags'];

/**
 * Las taxonomías que **a propósito** no entran a `CAMPOS_TAXONOMIA` de este
 * archivo, con su motivo. Es la mitad que hace que la lista de arriba se pueda
 * atar sin exigir que sea idéntica.
 */
export const TAXONOMIAS_FUERA_DEL_EVENTO = [
  'incluye-actividad',
  /*
   * **Los seis de las suscripciones literarias** (B-832), y acá el motivo es más
   * fuerte que en el caso de `incluye-actividad`: aquélla es un campo de una
   * actividad que el evento decidió no mostrar; éstas son de **otra colección**.
   * Una suscripción no tiene encuentros, así que no hay evento de Calendar donde
   * pudieran aparecer — pedir sus etiquetas sería una lectura más de Firestore en
   * cada invocación del sync para un dato que `construirDescripcion` no mira.
   */
  'periodicidad',
  'tipo-oferente',
  'perfil-editorial',
  'incluye-suscripcion',
  'extras-suscripcion',
  'alcance-envio',
  /*
   * **Los tres de los lugares para eventos** (B-833), con el mismo motivo que
   * los seis de arriba: son de **otra colección**, un lugar no tiene encuentros
   * y no hay evento de Calendar donde pudieran aparecer. Pedir sus etiquetas
   * sería una lectura más de Firestore en cada invocación del sync para un dato
   * que `construirDescripcion` no mira.
   */
  'tipo-lugar',
  'incluye-lugar',
  'condicion-de-uso',
];

/**
 * Caché por instancia: son 5 documentos que cambian muy de vez en cuando y la
 * Function corre una vez por escritura de actividad.
 */
let _labels = null;

/**
 * `{ campo: { slug: label } }` para las cinco taxonomías.
 *
 * §4.3 — acá entran TODAS las opciones, también las pendientes de aprobación. A
 * propósito: `aprobada` decide qué se puede *elegir* en el desplegable de las
 * otras cuentas, no qué se puede *mostrar*. La actividad guardó ese slug
 * legítimamente y el evento es público: filtrar acá haría que la descripción
 * dijera "con-beca-parcial" en lugar de "Con beca parcial".
 */
export const cargarLabels = async (db) => {
  if (_labels) return _labels;
  const labels = {};
  const snaps = await db.getAll(...CAMPOS_TAXONOMIA.map((c) => db.doc(`opciones/${c}`)));
  snaps.forEach((snap, i) => {
    const campo = CAMPOS_TAXONOMIA[i];
    labels[campo] = Object.fromEntries(
      (snap.data()?.valores ?? []).map((v) => [v.slug, v.label]),
    );
  });
  _labels = labels;
  return labels;
};

/**
 * Tira el caché. Lo llama `rebuildPorOpciones` cuando `/opciones/*` cambió: sin
 * esto, la instancia que atendió el cambio seguiría resolviendo con las
 * etiquetas viejas hasta reciclarse — y es justo la instancia que a continuación
 * reescribe los eventos con las nuevas (B-04).
 *
 * Solo invalida **esta** instancia; las demás lo recargan al reciclarse.
 */
export const invalidarLabels = () => {
  _labels = null;
};
