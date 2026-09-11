/**
 * §12 y B-40 — el historial de versiones, del lado del panel.
 *
 * El historial ya se guardaba: `functions/historial-trigger.js` escribe el
 * documento anterior en `/actividades/{id}/versiones/{version}` en cada edición
 * que pisa contenido, y también al borrar (B-41). Lo que no existía era la forma
 * de mirarlo: recuperar un campo pisado era abrir la consola de Firestore, elegir
 * un documento por su id —que es una fecha— y copiar el valor a mano.
 *
 * **Restaurar campo por campo, no el documento entero.** Restaurar todo pisaría
 * los cambios posteriores que sí se querían: el caso real es "me comí la
 * descripción hace dos ediciones", no "quiero volver al martes". Con el campo,
 * lo que se recupera es exactamente lo que se perdió.
 *
 * **Qué campos cambió cada versión no se recalcula acá**: viene guardado en el
 * documento (`camposCambiados`), que es lo que la Function ya computó cuando
 * decidió guardarla. Lo que sí se calcula es la comparación **contra el documento
 * de hoy**, que es otra pregunta: una versión de hace cinco ediciones pisó un
 * campo que quizá ya volvió a su valor.
 *
 * Esa comparación se importa de `@historial` —la misma función que usa el
 * trigger— y no se reimplementa. Si el panel tuviera su propia idea de qué campos
 * escribe la máquina, un campo nuevo entraría en una lista y no en la otra, y el
 * panel ofrecería "restaurar" un `updatedAt`. Es el patrón de `@calendario`
 * (D-20) aplicado al §12.
 */
import {
  collection,
  doc,
  documentId,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
// `firestore-client` y no `firebase-client`: el corte del bundle (B-09, D-51).
import { db } from '@/lib/firestore-client';
// B-150 — el emparejamiento de campos de máquina por id de sesión es UNO, y
// vive en el borde form ⇄ documento. Acá se reusa; no se reimplementa.
import { documentoAForm, fusionarSesiones, leerActividad, slugDisponible } from '@/lib/actividades';
// B-888 tajada 2 / D-660 — restaurar el slug es el cuarto lugar que lo escribe,
// así que es el cuarto que tiene que mover su reserva. Se importa el módulo del
// índice y no se rehace la escritura: dos formas de reservar el mismo nombre es
// la clase de B-88 con una puerta más.
import { refDeSlug, reservaDeSlug } from '@/lib/slugs';
import {
  modalidadResultante,
  onlinePrincipal,
  sedePrincipal,
} from '@/lib/modalidades';
import { CAMPOS_DE_SEARCH_TEXT, buildSearchText } from '@/lib/normalize';
import { linkDeReunionQueSale, urlDeMaterialQueSale } from '@/lib/toPublic';
import { fechaHoraCorta } from '@/lib/sesiones';
// §7.3 — «una sesión tiene evento si la actividad está publicada y la sesión no
// está cancelada». Importada y no reescrita: su propio docblock dice que se
// exporta para eso (D-20).
import { debeExistir } from '@calendario';
import { camposCambiados, estuvoPublicada } from '@historial';
import {
  ES_RECHAZO_DE_PRIVACIDAD,
  actividadFormSchema,
  llevaLinkDeReunion,
  tienePagina,
  type IssueDeSchema,
} from '@/lib/schema';
import type {
  Actividad,
  ActividadConId,
  ModalidadFila,
  Sesion,
  TimestampLike,
} from '@/types/actividad';

const COL = 'actividades';
const SUB = 'versiones';

/** Un documento de `/actividades/{id}/versiones/{version}`. */
export interface Version {
  /** Cuándo se pisó el contenido. Es el `event.time` del trigger. */
  guardadoEn: TimestampLike | null;
  /** uid del que hizo la edición que pisó estos datos. Nunca sale del panel. */
  actualizadoPor: string | null;
  /** Campos de primer nivel que esa edición cambió, calculados por la Function. */
  camposCambiados: string[];
  /** `true` si la versión es la de un borrado (B-41): es la actividad entera. */
  borrado: boolean;
  /** El documento completo tal como estaba antes. */
  documento: Actividad;
}

export interface VersionConId extends Version {
  /** `2026-08-24T19-30-00-000Z_<evento>` — ordena cronológicamente (D-43). */
  id: string;
}

/**
 * Las versiones de una actividad, de la más nueva a la más vieja.
 *
 * Se ordena por id del documento y no por `guardadoEn` porque el id **es** el
 * instante (D-43) y es de ancho fijo: el orden lexicográfico es el cronológico,
 * y así no hace falta un índice ni depender de un campo que podría faltar en un
 * documento viejo.
 *
 * Sin `limit`: la retención ya las acota a `MAX_VERSIONES` (20) por actividad
 * (D-42), así que no hay paginado que inventar.
 */
export const listarVersiones = async (actividadId: string): Promise<VersionConId[]> => {
  const q = query(collection(db(), COL, actividadId, SUB), orderBy(documentId(), 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const datos = d.data() as Partial<Version>;
    return {
      id: d.id,
      guardadoEn: datos.guardadoEn ?? null,
      actualizadoPor: datos.actualizadoPor ?? null,
      camposCambiados: datos.camposCambiados ?? [],
      borrado: datos.borrado === true,
      documento: (datos.documento ?? {}) as Actividad,
    };
  });
};

// ─────────────────────────────────────────────────────────────────
// Qué se puede restaurar — lógica pura
// ─────────────────────────────────────────────────────────────────

/**
 * Trampa 10 — el slug es inmutable después de publicar: restaurarlo rompe la URL
 * que ya está indexada y compartida. El formulario lo bloquea por la misma razón
 * (`slugBloqueado`), y el historial no puede ser la puerta de atrás.
 *
 * **B-285 — «después de publicar», no «mientras está publicada».** Esto era
 * `actual.estado !== 'publicado'`, y con eso la puerta de atrás quedaba abierta
 * de todos modos: bastaba pasar la actividad a borrador para poder restaurar el
 * slug de una URL ya indexada. La pregunta la contesta ahora `estuvoPublicada`
 * (`@historial`), la misma función del trigger que escribe la marca, cuyo default
 * de lectura para un documento anterior al campo es el `estado === 'publicado'`
 * de antes (D-26). El `=== true` es la coerción: la Function es JS plano.
 */
export const slugRestaurable = (actual: Actividad): boolean =>
  estuvoPublicada(actual) !== true;

/**
 * Los campos de esta versión que **hoy** están distintos, o sea lo único que
 * tiene sentido ofrecer para restaurar.
 *
 * No es `version.camposCambiados`: eso dice qué pisó esa edición en su momento.
 * Si dos ediciones después el campo volvió solo a su valor viejo, restaurarlo no
 * hace nada, y ofrecerlo es ruido en una pantalla que se usa apurado.
 *
 * `camposCambiados` viene de `@historial`, la misma función del trigger, así que
 * los campos de máquina (`updatedAt`, `updatedBy`, `calendarEventId`) quedan
 * afuera sin que este módulo tenga que saber cuáles son.
 */
export const camposRestaurables = (version: Version, actual: Actividad): string[] =>
  (camposCambiados(version.documento, actual) as string[])
    .filter((campo) => campo !== 'slug' || slugRestaurable(actual))
    .filter((campo) => campo !== 'comisiones' || comisionesRestaurables(version, actual))
    .filter((campo) => flagsDePublicacionRestaurables(campo, version, actual))
    .filter((campo) => !CAMPOS_DERIVADOS.includes(campo))
    .filter((campo) => existiaEnLaVersion(campo, version));

/**
 * ¿Se pueden restaurar **estas** comisiones sobre **esta** actividad? — B-181, y
 * lo encontró el `auditor-privacidad` como P1.
 *
 * **El historial era una puerta al documento que no pasaba por el schema** (lo
 * decía el docblock de `existiaEnLaVersion`, tres bloques abajo: `restaurarCampo`
 * escribe con un `updateDoc` y marca rebuild). Así que la guarda que B-181 puso en
 * el schema —una etiqueta no puede llevar la dirección de una reunión si la
 * actividad tiene página— tenía la mitad de la puerta abierta:
 *
 *   guardar el link en la etiqueta **en borrador** (permitido a propósito: de un
 *   borrador no sale nada) → corregirlo y publicar → la versión guardada conserva
 *   el link → «Restaurar → Opciones para sumarse» lo escribe sobre la publicada.
 *
 * Y el panel no podía avisar: `resumenDeCampo` resume un array como «2 elementos»,
 * así que la pantalla ofrecía «Opciones para sumarse — Decía: 2 elementos». Destino
 * del link: el `<h3>` de la página indexada, el `subEvent` del JSON-LD y el
 * `summary` del evento público.
 *
 * Es el precedente de B-285 con otro campo: «el historial no puede ser la puerta
 * de atrás» —eso cerró el slug (trampa 10)—, y la regla es la misma. Se reusa
 * `llevaLinkDeReunion` del schema en vez de escribir el patrón otra vez: dos
 * derivaciones de «esto es un link de reunión» que se separan es la clase de B-88,
 * y la que se quedaría corta sería justamente ésta.
 *
 * **Solo bloquea si la actividad de hoy tiene página** (`tienePagina`): restaurar
 * esa misma versión sobre un borrador es legítimo —es recuperar lo que se escribió—
 * y de un borrador no sale nada.
 *
 * **Desde B-818 la puerta sí pasa por el schema** (`issuesDeRestauracion`), o sea
 * que esta guarda dejó de ser lo único que frena este caso. Se queda igual, y por
 * dos motivos: nombra el problema —«esa versión tiene un link en el nombre de una
 * opción»— donde el genérico diría el mensaje del schema sin decir de dónde sale, y
 * es la que además **saca la fila de la pantalla** en vez de dejarla para que el
 * click la rechace.
 */
export const comisionesRestaurables = (version: Version, actual: Actividad): boolean => {
  if (!tienePagina(actual.estado)) return true;
  const comisiones = (version.documento as { comisiones?: { etiqueta?: string }[] }).comisiones;
  return !(comisiones ?? []).some((c) => llevaLinkDeReunion(c?.etiqueta ?? ''));
};

/**
 * ¿Restaurar **este** campo vuelve a prender un flag de publicación que hoy está
 * apagado? — B-819, y lo encontró el `auditor-privacidad` cerrando B-818.
 *
 * ── Los dos flags son un par, y por eso es UNA función ────────────────────
 * `online.urlPublica` (D-15) y `material.items[].publico` (§5.1) deciden lo
 * mismo con dos nombres: si un link privado sale o no. **El schema no tiene
 * ninguna regla sobre ninguno de los dos** —la decisión se delegó al flag a
 * propósito—, así que `issuesDeRestauracion` devuelve `[]` y el piso de B-818 no
 * los ve. Tampoco los ven las guardas puntuales.
 *
 * **El precedente de tratarlos juntos lo escribió el propio repo:** el P1 nº 1 de
 * D-124 —el borrador autoguardado— los apaga a los dos con una sola función
 * (`sinFlagsDePublicacion`). Cerrar una mitad de un par y no la otra es la clase
 * D-30/B-88 que este archivo ya cita tres veces, y acá la mitad que se quedaría
 * corta es la del material, que fue la que la primera versión de B-819 no
 * nombraba.
 *
 * ── Por qué se saca la fila en vez de avisar ──────────────────────────────
 * Porque **la pantalla no puede avisar**, y eso es lo que lo hizo P1:
 * `resumenDeCampo` resume un array como «2 elementos» y un objeto sin `nombre`
 * como sus claves, así que la fila dice «Modalidades — Decía: 2 elementos» o
 * «Material — Decía: tiene, items». Quien aprieta no ve que está volviendo a
 * publicar un link que hoy está apagado, y la escritura marca rebuild: sale solo.
 * Es exactamente la forma de B-181, con otro campo y sin el schema atrás.
 *
 * Nombrarlo en el `confirm()` era la alternativa barata y peor: ese texto ya dice
 * «¿Restaurar modalidades…?» y una advertencia más no cambia que la fila sigue
 * diciendo «2 elementos».
 *
 * ── Se compara por `id`, nunca por posición ───────────────────────────────
 * Las dos listas tienen id de cliente (`mod_<uuid>`, `mat_<uuid>` — trampa 2), y
 * comparar por índice haría que agregar una fila corriera todas las demás y la
 * guarda mirara el flag de otra. Un item **sin** counterpart hoy también bloquea:
 * restaurarlo agrega un link publicado que hoy no está publicado, que es el mismo
 * daño. Y un item de la versión **sin id** —material anterior a B-342— bloquea
 * igual: no se puede probar que ya sea público, y en la duda no se publica.
 *
 * **Solo bloquea si la actividad de hoy tiene página** (`tienePagina`), como
 * `comisionesRestaurables`: de un borrador no sale nada, así que restaurar ahí es
 * recuperar lo que se escribió.
 *
 * **El caso legítimo que esto NO rompe:** volver a prender un flag a propósito se
 * hace desde el formulario, que es donde está la casilla y donde el texto dice qué
 * hace (B-240). El historial no es el lugar para eso.
 */
export const flagsDePublicacionRestaurables = (
  campo: string,
  version: Version,
  actual: Actividad,
): boolean => {
  if (campo !== 'modalidades' && campo !== 'material') return true;
  if (!tienePagina(actual.estado)) return true;

  /**
   * **Lo que sale, no el flag.** `id|url`, porque estrenar es de la URL.
   *
   * Un `Set` de ids contestaba «¿hay alguna fila con este id prendida?», y eso
   * colapsa dos filas con el mismo id —nada valida unicidad: el schema solo
   * chequea el prefijo `mod_`— y tapa el caso «mismo id, otra URL». La clave
   * lleva las dos cosas.
   *
   * La `url` sale del predicado del **productor** (`@/lib/toPublic`), nunca de
   * una copia local: ver el docblock de `linkDeReunionQueSale`, que cuenta el P0
   * que costó la primera versión de esta guarda.
   */
  const loQueSale = (doc: Partial<Actividad>): { url: string; clave: string | null }[] => {
    /*
     * `tiene` entra al predicado del material porque la página de detalle lo
     * gatea: con la casilla apagada la URL no está en el HTML indexado, así que
     * restaurar una versión que la prende **estrena** esa página. Es un destino
     * nuevo, y el argumento asimétrico de D-139 dice que una página indexada no se
     * despublica.
     */
    const tiene = doc.material?.tiene === true;

    const crudas: { url: string | null; id: string | undefined }[] =
      campo === 'modalidades'
        ? (doc.modalidades ?? []).map((m) => ({
            url: linkDeReunionQueSale(m?.online ?? null),
            id: m?.id,
          }))
        : (doc.material?.items ?? []).map((i) => ({
            url: i ? urlDeMaterialQueSale(i, tiene) : null,
            id: i?.id,
          }));

    // `flatMap` y no `filter` + type predicate: el predicado obliga a declarar el
    // tipo de `id` dos veces y las dos listas lo tienen distinto (`ModalidadFila.id`
    // es obligatorio, el del material puede faltar antes de B-342).
    return crudas.flatMap(({ url, id }) =>
      url ? [{ url, clave: id ? `${id}|${url}` : null }] : [],
    );
  };

  const hoy = new Set(
    loQueSale(actual)
      .map(({ clave }) => clave)
      .filter((c): c is string => c !== null),
  );

  /*
   * Bloquea si la versión publica algo que hoy no está publicado. Una entrada
   * **sin `id`** —material anterior a B-342— no se puede casar con nada, así que
   * cuenta como no publicada hoy: no se puede probar que ya salga, y en la duda no
   * se publica (§5.1, trampa 5).
   */
  return !loQueSale(version.documento as Partial<Actividad>).some(
    ({ clave }) => !clave || !hoy.has(clave),
  );
};

/**
 * Los campos que **nadie edita**: los calcula `formADocumento` a partir de otros
 * (B-224, D-130). Ofrecerlos para restaurar es ofrecer una incoherencia.
 *
 * `modalidad`, `sede` y `online` salen de `modalidades`; `searchText`, de media
 * docena de campos (§6). Restaurar cualquiera de ellos **por separado** deja el
 * documento diciendo dos cosas —una sede que ninguna forma de cursar tiene— hasta
 * el próximo guardado, que lo pisa sin avisar. Y en el medio eso sale al
 * `events.json` y al evento, porque la restauración escribe con `updateDoc` y
 * marca rebuild.
 *
 * Lo que sí se restaura es `modalidades`, y `payloadDeRestauracion` recalcula los
 * cuatro derivados en la misma escritura.
 */
const CAMPOS_DERIVADOS: readonly string[] = ['modalidad', 'sede', 'online', 'searchText'];

/**
 * ¿El campo **existía** cuando se guardó esta versión?
 *
 * `camposCambiados` une las claves de los dos documentos, así que un campo que se
 * agregó al modelo **después** de esta versión sale reportado como cambiado — con
 * razón, para el trigger que decide si vale guardar una versión. Pero para decidir
 * qué es *restaurable* ese criterio miente: no hay nada que restaurar, el campo no
 * existía.
 *
 * Sin este filtro, `valorARestaurar` lo convierte en `null` con su `??`, y
 * `restaurarCampo` lo escribe con un `updateDoc` directo. O
 * sea: la pantalla ofrece "Imágenes — Decía: (vacío)" sobre una versión anterior a
 * B-167, y restaurarla escribe `imagenes: null` en el documento en vivo. De ahí
 * `imagenesDe` lo ve falsy, cae al `imagenUrl` viejo, y **la galería entera se
 * reemplaza por la imagen de antes de la migración** — que además llega al sitio
 * sola, porque la escritura marca rebuild. Nada tira error en toda la cadena.
 *
 * **Es la clase, no la instancia.** Le pasa a cualquier campo agregado al modelo
 * después de que se guardó una versión: `imagenes` es el más nuevo y el que más
 * duele, pero el mismo camino existía para todos los anteriores. Es el patrón del
 * §5 de `05-patrones.md` —un campo nuevo se lee con el default que preserva lo
 * anterior— aplicado al lugar donde nadie lo miró: la restauración.
 *
 * **Y la validación de B-818 no lo cubre**, aunque desde ese ítem la escritura sí
 * pasa por el schema: `documentoAForm` lee `imagenes: null` con `imagenesDe`, que
 * cae al `imagenUrl` viejo y devuelve una galería **válida**. El schema no puede
 * distinguir «restaurado a `null`» de «no tiene imágenes cargadas», así que este
 * filtro sigue siendo el único que ve la diferencia. La guarda general es un piso,
 * no un reemplazo de las puntuales.
 */
const existiaEnLaVersion = (campo: string, version: Version): boolean =>
  campo in (version.documento as unknown as Record<string, unknown>);

/**
 * El valor que se va a escribir, que **no siempre es el que dice la versión**.
 *
 * `sesiones` es el caso, y es la trampa cara de esta pantalla: la versión guarda
 * el array completo, `calendarEventId` incluido. Escribirlo tal cual le
 * devolvería al documento ids de eventos de Calendar de hace tres ediciones, y a
 * partir de ahí el diff del §7.2 trabaja sobre ids que pueden no existir más: un
 * `update` contra un evento borrado, o peor, un `insert` que duplica el encuentro
 * en el calendario **público**. Es exactamente la clase de B-80 —un campo que
 * escribe el backend viajando de vuelta por el cliente— y acá entraría por una
 * puerta nueva.
 *
 * La regla, entonces: de la versión sale el **contenido** de cada encuentro
 * (fecha, tema, lectura, cancelado) y del documento de hoy sale su
 * `calendarEventId`, emparejando por `id` de sesión —que es estable y por eso
 * existe (§7.2, trampa 2)—. Una sesión que la versión trae y hoy no existe queda
 * con `calendarEventId: null`, así el sync le crea su evento como si fuera nueva,
 * que es lo correcto.
 *
 * **El emparejamiento es `fusionarSesiones` y no una copia** (B-150). Era el
 * mismo `Map` por id escrito dos veces —acá y en el guardado del formulario— y
 * eso es la clase que D-20/D-71 evitan: el día que aparezca un segundo campo de
 * máquina en una sesión, una de las dos copias se acuerda y la otra no, sin que
 * nada falle. Ahora las dos recorren la lista de `@historial`.
 */
export const valorARestaurar = (
  campo: string,
  version: Version,
  actual: Actividad,
): unknown => {
  const viejo = (version.documento as unknown as Record<string, unknown>)[campo] ?? null;
  if (campo !== 'sesiones') return viejo;

  return fusionarSesiones((viejo ?? []) as Sesion[], actual.sesiones ?? []);
};

/**
 * Los campos con los que se arma el `searchText` (§6).
 *
 * Restaurar un título sin recalcularlo dejaría la búsqueda del panel encontrando
 * la actividad por un texto que ya no está escrito en ninguna parte — y peor, el
 * `searchText` viaja al `events.json` (§5.2), así que la incoherencia sale al
 * sitio público. `formADocumento` lo recalcula en cada guardado justamente por
 * esto; el historial escribe por otro camino y tiene que hacer lo mismo.
 */
/**
 * De qué campos sale el `searchText`. **Importada, no copiada:** esta lista tenía
 * su propia versión con cinco de los seis, y al agregar el libro (DEC-1) restaurar
 * un libro viejo escribía el campo y dejaba el índice de búsqueda con el título
 * descartado — que es lo que sale al `events.json`. Ver `CAMPOS_DE_SEARCH_TEXT`.
 */
const CAMPOS_DE_BUSQUEDA: readonly string[] = CAMPOS_DE_SEARCH_TEXT;

/**
 * El objeto que se le manda a `updateDoc`: el campo restaurado, la autoría de
 * quien restauró, y `searchText` si hizo falta.
 *
 * Es puro para poder verificar sin Firestore las dos cosas que importan: que
 * `calendarEventId` no viaje hacia atrás, y que el `searchText` acompañe.
 */
export const payloadDeRestauracion = (
  campo: string,
  version: Version,
  actual: Actividad,
  uid: string,
): Record<string, unknown> => {
  const valor = valorARestaurar(campo, version, actual);
  const payload: Record<string, unknown> = { [campo]: valor };

  /**
   * B-224 — restaurar las formas de cursar arrastra sus tres derivados en la
   * **misma** escritura. Sin esto el documento queda con una sede que ninguna
   * fila tiene y una modalidad que no es la unión de nada, y eso sale al
   * `events.json` y al evento hasta el próximo guardado.
   */
  if (campo === 'modalidades') {
    const filas = (valor ?? []) as ModalidadFila[];
    payload.modalidad = modalidadResultante(filas);
    payload.sede = sedePrincipal(filas);
    payload.online = onlinePrincipal(filas);
  }

  /**
   * B-181 — restaurar las comisiones **desengancha los encuentros que quedan
   * colgados**, en la misma escritura. Es el patrón de `modalidades` de arriba
   * aplicado al par que este ítem creó, y lo cobró la cuarta pasada del
   * `auditor-privacidad`.
   *
   * `comisiones` y `sesiones[].comisionId` son **un par**, y esta pantalla puede
   * restaurar una mitad sola: una versión anterior a la creación de una comisión
   * la borra, y las sesiones que la referencian quedan apuntando a un id que ya no
   * existe. El schema rechaza ese documento al publicar —«Este encuentro apunta a
   * una opción que ya no existe»— y hasta B-818 **esta puerta no pasaba por el
   * schema**, así que nada lo frenaba; la
   * escritura marca rebuild: los encuentros pasan a la bolsa sin encabezado, la
   * cuenta de opciones baja, y los N eventos de Calendar de esas sesiones pierden
   * su «— Martes 19 h» de una pasada.
   *
   * Se desengancha en vez de bloquear la restauración: el que restaura quiere el
   * contenido de esa versión, y dejar los encuentros **sin** opción es exactamente
   * el estado que el formulario sabe pedir que se complete (`sinComision` hace lo
   * mismo cuando se borra una desde el panel). Bloquearlo sería esconder una
   * versión legítima.
   *
   * **Y desde B-818 eso vale solo mientras la actividad no tenga que publicarse**,
   * que lo cobró el `auditor-privacidad` sobre la guarda nueva. El desenganche deja
   * `comisionId: null` con `comisiones` no vacío, y eso es el rechazo «Elegí de qué
   * opción es este encuentro» del nivel largo: sobre una **publicada**,
   * `issuesDeRestauracion` lo cuenta como nuevo y `restaurarCampo` tira. O sea que
   * el desenganche sigue siendo el comportamiento en borrador y pendiente, y sobre
   * una publicada la restauración se rechaza con el mensaje del schema.
   *
   * **Es coherente y no un efecto de costado**: dejar publicada una actividad con
   * encuentros sin opción es exactamente lo que el nivel largo no permite, y hasta
   * acá esta puerta lo escribía igual. El desenganche no sobra —es lo que evita el
   * `comisionId` colgado, que el rechazo de arriba tampoco tapa en borrador— pero
   * dejó de ser lo último que decide. Está anotado en D-540.
   */
  /*
   * **El par se desengancha en los dos sentidos**, y el segundo lo cobró la quinta
   * pasada del `auditor-trampas` sobre la corrección del primero: cerrar una
   * mitad de un par y no la otra es la clase D-30/B-88, y acá el sentido que
   * faltaba es igual de alcanzable.
   *
   * `comisionId` **no** es un campo de máquina (`CAMPOS_DE_MAQUINA_SESION` es solo
   * `calendarEventId`), así que restaurar `sesiones` trae el `comisionId` tal como
   * estaba en la versión vieja. Si esa comisión se borró después —o se rehízo con
   * otro id—, la restauración **reintroduce** la referencia colgada: la fila cae a
   * la bolsa sin encabezado en la página y su evento de Calendar pierde el
   * «— Martes 19 h», sin que nada tire error.
   */
  const idsDeComisionValidos = (comisiones: unknown): Set<string> =>
    new Set(((comisiones ?? []) as { id: string }[]).map((c) => c.id));

  const sinComisionColgada = (
    sesiones: readonly Sesion[],
    ids: Set<string>,
  ): Sesion[] =>
    sesiones.map((sesion) =>
      sesion.comisionId && !ids.has(sesion.comisionId) ? { ...sesion, comisionId: null } : sesion,
    );

  if (campo === 'comisiones') {
    /*
     * **Solo si hay algo que desenganchar** — y esto lo cobró la quinta pasada del
     * `auditor-privacidad` sobre la corrección de la cuarta, como B-80 por una
     * puerta nueva.
     *
     * **La ventana ya no es la del montaje** —`restaurarCampo` relee antes de
     * llamar acá, ver su docblock— **pero sigue habiendo una**: la que va del
     * `getDoc` al `updateDoc`, exactamente la misma que `actualizarActividad`
     * documenta desde B-150. Escribir el array entero cuando no hay ningún colgado
     * mete al panel en esa ventana **sin necesidad**: vuelve a ser dueño de un
     * campo que escribe la Function, y a cambio de nada.
     *
     * Las dos cosas van juntas y ninguna reemplaza a la otra: la relectura acorta
     * la ventana, este `if` evita entrar en ella cuando la escritura no hacía
     * falta. Si alguien saca una de las dos, vuelve la clase de B-80.
     *
     * Y en ese caso **no se autorrepara**: si el payload del evento no cambió,
     * `planificar` devuelve cero operaciones y el trigger retorna antes de reponer
     * los ids (D-91), así que el `null` se queda hasta la edición siguiente — que
     * emite `crear` y deja un segundo evento en el calendario público con el
     * primero huérfano.
     *
     * Con colgados de verdad el título del evento sí cambia, hay `actualizar`, y la
     * reposición de D-91 tapa la ventana. O sea que la única exposición era el caso
     * en que la escritura no hacía falta.
     */
    const desenganchadas = sinComisionColgada(actual.sesiones ?? [], idsDeComisionValidos(valor));
    if (desenganchadas.some((s, i) => s !== (actual.sesiones ?? [])[i])) {
      payload.sesiones = desenganchadas;
    }
  }

  if (campo === 'sesiones') {
    payload.sesiones = sinComisionColgada(
      (valor ?? []) as Sesion[],
      idsDeComisionValidos(actual.comisiones),
    );
  }

  /**
   * El `searchText` se arma sobre **el documento que va a quedar**, derivados
   * incluidos — y no sobre `actual` con el campo restaurado encima.
   *
   * La diferencia es un bug real y silencioso: `buildSearchText` lee las sedes de
   * `modalidades` **y** la `sede` de primer nivel, así que con `actual` crudo el
   * índice se quedaba con el barrio **viejo** al lado del nuevo. La actividad
   * seguía apareciendo al buscar un barrio que ya no es suyo, y se corregía sola
   * recién en la próxima edición completa: si alguien la busca no la encuentra
   * donde está, y si no la busca no se entera nadie.
   *
   * Es la clase de B-88 en miniatura —dos consumidores del mismo dato derivando
   * por caminos distintos— y por eso el orden importa: primero se calculan los
   * derivados, y el índice se arma sobre eso.
   */
  if (CAMPOS_DE_BUSQUEDA.includes(campo)) {
    payload.searchText = buildSearchText({ ...actual, ...payload } as Actividad);
  }

  // La restauración es una edición más y se firma como tal: quien la hizo queda
  // en `updatedBy`, y `updatedAt` la ordena en el listado como cualquier otra.
  payload.updatedBy = uid;
  payload.updatedAt = serverTimestamp();
  return payload;
};

/**
 * ¿Qué rechaza el schema sobre **este** documento? — el insumo de la guarda de
 * B-818, y `null` si el documento no se puede ni leer.
 *
 * Es el mismo `safeParse` del guardado (`guardarActividad`) sobre el mismo
 * schema, entrando por el mismo borde: `documentoAForm`. **Importado y no
 * reescrito**, y no es una comodidad: el schema tiene dos niveles sobre el mismo
 * objeto y la línea que los separa es `tienePagina(estado)`, así que una segunda
 * derivación de «esto se valida con el nivel largo» es exactamente la clase de
 * B-88 en el único lugar del panel que escribe sin validar.
 *
 * El `null` es «ilegible», que no es lo mismo que «inválido»: `documentoAForm`
 * llama `.toDate()` sobre las fechas, y sobre un documento con una fecha que no
 * es un `Timestamp` tira. Quién lo distingue de `[]` —y qué hace con cada uno—
 * lo decide `issuesDeRestauracion`.
 */
const issuesDelDocumento = (a: Actividad): IssueDeSchema[] | null => {
  let form;
  try {
    form = documentoAForm(a);
  } catch {
    return null;
  }
  const r = actividadFormSchema.safeParse(form);
  if (r.success) return [];
  return r.error.issues.map((i) => ({
    path: [...i.path],
    message: i.code === 'invalid_enum_value' ? MENSAJE_DE_VALOR_INVALIDO : i.message,
  }));
};

/**
 * El único mensaje de zod que **devuelve el valor recibido**, reemplazado — y lo
 * cobró el `auditor-privacidad` sobre el barrido de centinelas de este camino.
 *
 * Los mensajes del schema los escribe el schema y son literales; de los defaults
 * de zod alcanzables acá, `invalid_enum_value` es el único que interpola el valor
 * (`received '…'`). Los campos con enum detrás son vocabularios cerrados —`estado`,
 * `inscripcion.via`, `material.items[].tipo`/`entrega`, `modalidades[].modalidad`—
 * así que hoy lo que devolvería no es un dato privado; pero el valor sale del
 * documento, y un documento escrito por fuera del panel puede tener cualquier cosa
 * ahí. Con esto el mensaje no puede llevar un valor del documento **por
 * construcción**, no por suerte, que es lo que `tests/historial-restaurar.test.ts`
 * afirma con centinelas.
 *
 * Y se gana lo otro, que vale igual: «Invalid enum value. Expected 'a' | 'b',
 * received 'x'» está en inglés y no le dice nada a quien carga actividades. El §5
 * ya lo decía para las salidas —«viaja la etiqueta, no el mensaje»—; el cartel del
 * panel no es una salida pública, y aun así es el mismo criterio.
 */
const MENSAJE_DE_VALOR_INVALIDO = 'Ese campo tiene un valor que no es de los posibles';

/** Un issue, en una clave comparable: el mismo mensaje en el mismo campo. */
const claveDeIssue = (i: IssueDeSchema): string => `${i.path.join('.')}|${i.message}`;

/**
 * Lo que el schema no va a poder leer, dicho como un rechazo más para no tener
 * dos caminos de salida en `issuesDeRestauracion`.
 */
const ILEGIBLE: IssueDeSchema = {
  path: [],
  message: 'esa versión trae datos que el formulario no puede leer',
};

/**
 * ¿Este rechazo existe para que un dato **no salga**? — la excepción a la resta,
 * y lo cobró el `auditor-privacidad` sobre la primera versión de esta guarda.
 *
 * La lista vive en el schema (`MENSAJES_DE_PRIVACIDAD`), que es donde están las
 * reglas: acá se pregunta, no se decide. El motivo largo está en su docblock; en
 * una línea, enmascarar un rechazo **de completitud** que ya estaba es lo correcto
 * y enmascarar uno **de privacidad** es dejar pasar una fuga cuyo destino cambió.
 */
const esDePrivacidad = (i: IssueDeSchema): boolean =>
  ES_RECHAZO_DE_PRIVACIDAD.includes(i.message);

/**
 * ¿Esta restauración **le abre al dato un destino que hoy no tiene**? — lo que
 * acota la excepción de arriba, y el tercer intento.
 *
 * El primero no la acotaba, y con eso una actividad que ya filtra quedaba con
 * **toda** restauración bloqueada: la pantalla tapiada que la resta existe para
 * evitar, y encima sobre el documento que hay que arreglar. El segundo preguntaba
 * solo si **cambiaba el estado**, y ésa era la mitad del §7.3: la condición del
 * sync es `estado === 'publicado' && !sesion.cancelada`, o sea que **descancelar
 * un encuentro crea un evento que no existía** sin que el estado se mueva. El
 * camino, que lo midió el `auditor-privacidad`: una publicada con el link en la
 * etiqueta y todos los encuentros cancelados no tiene hoy ningún evento —el link
 * está solo en la página— y «Restaurar → Encuentros» sobre una versión que los
 * tenía activos lo pone en el `summary` del calendario **público**. La variante es
 * la misma con un encuentro que hoy no existe.
 *
 * Así que la pregunta es la de verdad, y son dos mitades porque los destinos son
 * dos:
 *
 * - **la página** la decide `estado` (`tienePagina`), y para eso alcanza con ver
 *   si se movió;
 * - **el evento de Calendar** lo decide `debeExistir`, que mira el estado **y** el
 *   `cancelada` de cada sesión. Se importa de `@calendario` y no se reescribe: dos
 *   derivaciones de «esta sesión tiene evento» que se separan es la clase de B-88,
 *   y el propio docblock de `debeExistir` dice que se exporta justamente para
 *   esto (D-20).
 *
 * Solo cuenta lo que **crece**: publicar o descancelar abre un destino, despublicar
 * o cancelar lo cierra, y cerrar un destino nunca es una fuga nueva.
 */
const cambiaElDestino = (actual: Actividad, resultante: Actividad): boolean => {
  if (resultante.estado !== actual.estado) return true;

  const conEvento = (a: Actividad): Set<string> =>
    new Set((a.sesiones ?? []).filter((s) => debeExistir(a, s)).map((s) => s.id));

  const antes = conEvento(actual);
  return [...conEvento(resultante)].some((id) => !antes.has(id));
};

/**
 * Los rechazos del schema que **esta restauración introduce** — B-818, P1.
 *
 * ── Qué agujero cierra ────────────────────────────────────────────────────
 * `restaurarCampo` escribe con un `updateDoc` que no pasa por el schema, y eso
 * lo dice medio archivo: los docblocks de `existiaEnLaVersion`, de
 * `comisionesRestaurables` y del bloque `comisiones` de `payloadDeRestauracion`
 * arrancan todos por ahí. Hasta acá la respuesta había sido **una guarda por
 * regla**, escrita cuando algún auditor encontraba la instancia: el slug (trampa
 * 10, B-285), la etiqueta con un link (B-181), el par de comisiones colgado.
 *
 * Y quedaba afuera la regla que abre todas las demás: **`estado`**. «Restaurar →
 * Estado» sobre una versión que decía `publicado` escribe `estado: 'publicado'`
 * salteando el nivel entero de publicar —la sede incompleta, el canal de
 * inscripción sin destino, el monto contradictorio, el slug `-copia`— y la
 * escritura marca rebuild, así que sale al sitio sola. El camino no necesita
 * mala fe ni consola: publicada → borrador → editar algo que **en borrador está
 * permitido a propósito** → «Restaurar → Estado».
 *
 * Así que la guarda dejó de ser por regla y pasó a ser la pregunta general:
 * **¿el documento que va a quedar pasa el schema?** Eso cubre `estado` y cubre
 * también lo que nadie había mirado —restaurar una `inscripcion` sin destino o
 * unas `modalidades` incompletas **sobre una publicada** salteaba el mismo nivel
 * por el mismo `updateDoc`—, y cubre la regla que se agregue mañana sin que haya
 * que volver a pasar por acá. Las guardas puntuales **se quedan**: el slug no lo
 * frena el schema (que solo rechaza `-copia`, no la mutación) y el mensaje de las
 * comisiones nombra el problema mejor que el genérico.
 *
 * ── Por qué el diff y no el veredicto ─────────────────────────────────────
 * Se comparan los rechazos de **antes** y de **después**, y solo bloquean los
 * nuevos. Sin eso, una actividad publicada que hoy ya no pasa el nivel largo
 * —porque se publicó antes de que existiera la regla que ahora la rechaza—
 * quedaría con la pantalla de recuperación **entera** bloqueada, y es justo la
 * pantalla a la que se va cuando algo está roto. La restauración responde por lo
 * que rompe, no por lo que se encontró roto.
 *
 * El caso de B-818 igual queda bloqueado, y no por casualidad: restaurar
 * `publicado` **mueve el nivel de validación**, así que todos los rechazos del
 * nivel largo son nuevos por definición. Y el simétrico sigue libre: restaurar
 * `borrador` sobre una publicada solo puede quitar rechazos.
 *
 * **Con una excepción, y es la que hace que la resta no sea una fuga:** cuando la
 * restauración **le abre al dato un destino que hoy no tiene**, los rechazos que
 * existen para que un dato no salga bloquean aunque ya estuvieran
 * (`esDePrivacidad` × `cambiaElDestino`). Los dos casos medidos son una cancelada
 * cuya etiqueta ya lleva un link —publicarla le da eventos de Calendar que no
 * tenía— y una publicada con todos los encuentros cancelados, donde
 * **descancelarlos hace lo mismo sin tocar el estado**. Acotada al destino y no
 * aplicada siempre: si no, una actividad que ya filtra queda con toda restauración
 * bloqueada. Ver `MENSAJES_DE_PRIVACIDAD` y `cambiaElDestino`.
 *
 * ── El ilegible, y para qué lado falla ────────────────────────────────────
 * Los dos lados se leen con `documentoAForm`, que puede tirar. **Si el que no se
 * puede leer es el de hoy, no se bloquea** (`antes === null` → `[]`): no hay
 * línea de base contra la que comparar, y dejar la restauración cerrada sobre un
 * documento ya ilegible es tapiar la única salida. **Si el que no se puede leer
 * es el resultado, sí**: entonces la restauración es lo que lo rompió.
 *
 * **Lo que el fail-open deja sin cubrir, dicho en voz alta:** con `antes === null`
 * no corre nada, ni la excepción de privacidad de arriba. Es el precio elegido —
 * una pantalla de recuperación tapiada sobre el documento que solo se arregla
 * desde ahí es peor— y el alcance es angosto: para llegar hace falta un documento
 * cuyas fechas no sean `Timestamp`, o sea escrito por fuera del panel.
 *
 * Es pura y exportada para poder verificarla sin Firestore, como sus vecinas.
 * Recibe el `payload` ya armado y no lo rearma: lo que se valida tiene que ser
 * **exactamente** lo que se escribe, y dos derivaciones del mismo documento que
 * se separan es el bug que este archivo ya tiene documentado tres veces.
 */
export const issuesDeRestauracion = (
  actual: Actividad,
  payload: Record<string, unknown>,
): IssueDeSchema[] => {
  const antes = issuesDelDocumento(actual);
  if (antes === null) return [];

  const resultante = { ...actual, ...payload } as Actividad;
  const despues = issuesDelDocumento(resultante);
  if (despues === null) return [ILEGIBLE];

  const reevaluarPrivacidad = cambiaElDestino(actual, resultante);
  const yaEstaban = new Set(antes.map(claveDeIssue));
  return despues.filter(
    (i) =>
      (reevaluarPrivacidad && esDePrivacidad(i)) || !yaEstaban.has(claveDeIssue(i)),
  );
};

/**
 * El mensaje que ve quien apretó «Restaurar» — B-818.
 *
 * Dice **qué** rompería y no solo que no se puede: el aviso de B-184 («la barra
 * dice cuántos campos faltan pero no cuáles») es el mismo error, y el schema ya
 * escribe sus rechazos en el idioma del panel. Se muestran hasta tres porque
 * restaurar `estado` sobre una incompleta puede juntar diez, y una lista de diez
 * en un cartel de error no se lee.
 */
export const mensajeDeRestauracionInvalida = (issues: readonly IssueDeSchema[]): string => {
  const muestra = issues.slice(0, 3).map((i) => i.message);
  const resto = issues.length - muestra.length;
  return (
    'No se puede restaurar: el resultado rompe reglas que hoy se cumplen — ' +
    muestra.join(' · ') +
    (resto > 0 ? ` (y ${resto} más)` : '') +
    '.'
  );
};

/**
 * Cómo se ve un valor viejo en la pantalla, en una línea.
 *
 * Sin esto la única forma de decidir si una versión es la que se busca es
 * restaurarla y ver qué pasa, que en una pantalla de recuperación es lo último
 * que se quiere. No pretende ser un diff: alcanza con reconocer *"sí, esa era la
 * descripción larga"*.
 *
 * Los `Timestamp` se detectan por forma y no por `instanceof`: el mismo valor
 * llega como `Timestamp` del SDK en el panel y como objeto plano en los tests,
 * igual que hace `canonico` en el trigger.
 */
export const resumenDeCampo = (valor: unknown, largo = 90): string => {
  if (valor === null || valor === undefined) return '(vacío)';
  if (typeof valor === 'string') {
    const limpio = valor.trim();
    if (limpio === '') return '(vacío)';
    return limpio.length > largo ? `${limpio.slice(0, largo)}…` : limpio;
  }
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no';
  if (typeof valor === 'number') return String(valor);
  if (Array.isArray(valor)) {
    if (valor.length === 0) return '(ninguno)';
    return `${valor.length} ${valor.length === 1 ? 'elemento' : 'elementos'}`;
  }
  if (typeof valor === 'object') {
    const o = valor as Record<string, unknown>;
    if (typeof o.toDate === 'function') {
      return fechaHoraCorta((o.toDate as () => Date)());
    }
    // Un objeto del modelo (sede, organizador, inscripción): lo que se reconoce
    // de un vistazo es su nombre, y si no tiene, sus claves con algo cargado.
    if (typeof o.nombre === 'string' && o.nombre.trim()) return o.nombre.trim();
    const cargadas = Object.keys(o).filter(
      (k) => o[k] !== null && o[k] !== '' && o[k] !== false,
    );
    return cargadas.length ? cargadas.join(', ') : '(vacío)';
  }
  return String(valor);
};

/**
 * Escribe la restauración.
 *
 * **Deja versión de lo restaurado, y está bien:** es una escritura al documento,
 * así que dispara `guardarVersion` y el estado anterior queda guardado. Deshacer
 * un "deshacer" tiene que ser posible.
 *
 * ── Relee el documento antes de armar el payload (B-150, D-360) ────────────
 * `actual` es el snapshot que la pantalla leyó **al montar** (`leerActividad`, un
 * `getDoc` único), y la pantalla puede quedar abierta. Todo lo que el payload tome
 * de `actual` —el `calendarEventId` de cada sesión al fusionar, las comisiones
 * contra las que se desengancha, el documento sobre el que se arma el
 * `searchText`— sería de entonces.
 *
 * Es exactamente el arreglo que B-150 le hizo a `actualizarActividad` («el panel
 * sigue emitiendo el campo, pero ya no emite el valor del formulario: relee el
 * documento y repone los campos de máquina»), y lo cobró la sexta pasada del
 * `auditor-privacidad`: sin esto, restaurar podía devolverle al documento un
 * `calendarEventId: null` de antes del write-back del sync, y la edición siguiente
 * emitía `crear` — un segundo evento en el calendario **público** con el primero
 * huérfano (B-80, D-91). La reposición del trigger no lo tapa: `reponerIds` solo
 * toca las sesiones que tuvieron operación.
 *
 * **Si el documento ya no está** se usa el snapshot y el `updateDoc` falla igual,
 * así que el `?? actual` es por forma y no un fallback de verdad. **Si la lectura
 * rechaza**, la restauración aborta sin escribir —`leerActividad` no atrapa nada—
 * y **tiene que seguir abortando**: envolverla en un `try/catch` que caiga al
 * snapshot haría que las tres guardas de abajo las contestara el estado del
 * montaje, que es exactamente el agujero que cierran. La primera versión de este
 * docblock prometía ese fallback y no existía; lo cobró el `auditor-privacidad`,
 * porque una frase así es una invitación escrita a reabrir el P1.
 */
export const restaurarCampo = async (
  actual: ActividadConId,
  campo: string,
  version: Version,
  uid: string,
): Promise<void> => {
  const fresco = (await leerActividad(actual.id)) ?? actual;

  /*
   * ── Y las guardas se re-evalúan contra lo releído ─────────────────────
   * Lo cobró la séptima pasada del `auditor-privacidad` como P1, y el argumento es
   * el mismo docblock de arriba llevado hasta el final: `camposRestaurables` decide
   * qué ofrece **en el render**, contra el snapshot del montaje, y esta función
   * confiaba en que la lista renderizada ya había filtrado.
   *
   * El camino: la pantalla se monta con la actividad en `borrador` —donde la
   * etiqueta con un link es legítima y la guarda está en verde—, alguien la publica
   * desde otra pestaña u otro dispositivo, y el click escribe esa etiqueta **sobre
   * el documento releído, que ya tiene página**. Lo mismo con el slug (trampa 10)
   * sobre una que se publicó en el medio.
   *
   * Se tira y no se salta en silencio: el `catch` de la pantalla muestra el
   * mensaje, y «no pude» es la respuesta correcta a «restaurá esto» cuando dejó de
   * ser restaurable — restaurar a medias sería peor.
   *
   * Se re-evalúan **estas tres** (la tercera es B-819) y no `camposRestaurables`
   * entero: esa función también filtra por «sigue estando distinto», y ahí la
   * respuesta correcta no es un error sino no hacer nada. Las de acá son las que
   * existen para que algo **no salga**.
   */
  if (campo === 'slug' && !slugRestaurable(fresco)) {
    throw new Error('La dirección web no se puede restaurar: la actividad ya se publicó.');
  }
  if (campo === 'comisiones' && !comisionesRestaurables(version, fresco)) {
    throw new Error(
      'Esa versión tiene un link en el nombre de una opción, y esta actividad ya tiene página.',
    );
  }
  if (!flagsDePublicacionRestaurables(campo, version, fresco)) {
    /*
     * La tercera, y entra por el mismo camino que las dos de arriba — B-819. La
     * carrera es idéntica: la pantalla se monta con la actividad en `borrador`,
     * donde la guarda está en verde porque de un borrador no sale nada; alguien la
     * publica desde otra pestaña, y el click escribiría el flag prendido **sobre
     * el documento releído, que ya tiene página**.
     *
     * No lleva `campo === '…'` adelante porque la función ya decide sobre qué
     * campos opina: dos lugares eligiendo los mismos dos nombres es la clase que
     * este archivo evita.
     */
    throw new Error(
      'Esa versión tiene el link marcado como público y hoy está apagado. Volver a publicarlo se hace desde el formulario.',
    );
  }

  const payload = payloadDeRestauracion(campo, version, fresco, uid);

  /*
   * ── Y el documento que va a quedar pasa por el schema (B-818) ─────────
   * La guarda general, después de las tres puntuales: éstas nombran su problema
   * mejor, y el schema no conoce la inmutabilidad del slug.
   *
   * Se valida **el `payload` de arriba**, el mismo objeto que se escribe dos
   * líneas más abajo. Rearmarlo para validar sería tener dos derivaciones del
   * documento resultante, que es la clase que este archivo evita en `searchText`,
   * en `fusionarSesiones` y en `CAMPOS_DE_SEARCH_TEXT`.
   */
  const issues = issuesDeRestauracion(fresco, payload);
  if (issues.length > 0) throw new Error(mensajeDeRestauracionInvalida(issues));

  /*
   * ── Y la unicidad, que el schema no puede ver — B-820 ─────────────────
   * El formulario no deja guardar **dos** cosas: lo que rechaza
   * `actividadFormSchema` y lo que rechaza `slugDisponible`
   * (`formulario/guardar.ts`, «Ya hay otra actividad con este slug»). El piso de
   * arriba cubre solo la primera, porque el schema es **puro** y la unicidad es
   * una query. Esta mitad no la veía nadie.
   *
   * El camino: una actividad que **nunca se publicó** —`slugRestaurable` la
   * habilita, y es correcto por la trampa 10— restaura su slug viejo, que en el
   * medio otra actividad reusó. Quedan dos documentos con el mismo slug, y si las
   * dos terminan publicadas `getStaticPaths` colisiona: la URL sirve el contenido
   * de una de las dos y nada avisa.
   *
   * **Va última, y sobre el `payload`.** Última porque es la única que cuesta una
   * query y las tres puntuales más el schema son gratis: si algo de arriba ya
   * rechazó, no se paga. Y sobre el `payload` por lo mismo que el schema valida el
   * payload y no un objeto rearmado (B-818): dos derivaciones de «lo que se va a
   * escribir» es la clase que este archivo evita en `searchText`, en
   * `fusionarSesiones` y en `CAMPOS_DE_SEARCH_TEXT`.
   *
   * No lleva `campo === 'slug'` adelante: `payload.slug` solo existe cuando el
   * campo es el slug, así que la condición ya está en el dato.
   */
  const slugNuevo = (payload as { slug?: unknown }).slug;
  if (typeof slugNuevo === 'string' && !(await slugDisponible(slugNuevo, actual.id))) {
    throw new Error(
      'Esa dirección web ya la usa otra actividad. Cambiala desde el formulario antes de restaurarla.',
    );
  }

  /*
   * ── Restaurar el slug mueve su reserva, en el mismo batch — D-660 ──────
   * Es la misma decisión que `actualizarActividad`, y acá hace **más** falta: el
   * chequeo de arriba es el que B-820 puso porque el schema no puede ver la
   * unicidad, y sin mover la reserva el índice diría que el slug viejo sigue
   * tomado y que el nuevo está libre — o sea, al revés que el catálogo. El batch
   * hace que las tres escrituras sean una: no hay un estado intermedio en el que
   * el documento diga una dirección y el índice otra.
   */
  /*
   * **`fresco.slug` y NO `actual.slug`** — lo encontró el `auditor-trampas`, y la
   * primera versión de este bloque lo tenía mal.
   *
   * `actual` es el documento que trajo el montaje de la pantalla de historial;
   * `fresco` es el que el documento tiene **en este instante** (es la relectura de
   * la línea 879, que el docblock de esta función argumenta tres veces). Con
   * `actual.slug`, si entre que se abrió la pantalla y el click alguien le cambió
   * el slug a esta actividad —está permitido: es un borrador, la trampa 10 solo
   * congela el slug después de publicar— y ese nombre liberado lo tomó **otra**
   * actividad, el `delete` de abajo borraría **la reserva de esa otra**. El índice
   * pasaría a decir «libre» sobre un nombre en uso, que es el estado exacto que
   * D-660 existe para que no pueda ocurrir.
   *
   * No hace falta mala intención: alcanzan dos pestañas del mismo panel. Es la
   * misma carrera que `slugRestaurable`/`comisionesRestaurables` ya blindan, y a
   * esta comparación se le escapó porque **no es una llamada a una guarda**: el
   * chequeo de clase de `tests/historial-restaurar.test.ts` busca
   * `*Restaurables(… actual …)` por regex y una comparación cruda no entra ahí.
   */
  if (typeof slugNuevo === 'string' && slugNuevo !== fresco.slug) {
    const batch = writeBatch(db());
    batch.set(refDeSlug(slugNuevo), reservaDeSlug(actual.id, uid));
    if (fresco.slug) batch.delete(refDeSlug(fresco.slug));
    batch.update(doc(db(), COL, actual.id), payload);
    await batch.commit();
    return;
  }

  await updateDoc(doc(db(), COL, actual.id), payload);
};
