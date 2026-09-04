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
 * D-20 — esta lista es una **copia** de `CAMPOS_TAXONOMIA` de `src/lib/`, y no
 * se puede evitar: `functions/` se despliega con su propio `package.json` y no
 * puede importar hacia arriba. Se evaluó y se descartó; la respuesta acordada es
 * un test que compare las dos listas, no un import imposible.
 */
export const CAMPOS_TAXONOMIA = ['arancel', 'tipo', 'barrio', 'plataforma', 'tags'];

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
