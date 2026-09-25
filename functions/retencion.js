/**
 * **B-838 / DEC-13 + B-844 — una propuesta no se guarda para siempre.**
 *
 * Es el paso 11 de la tajada 1, adelantado por decisión del dueño (B-843 punto
 * 1): la excepción del borrado tiene que existir **antes** que el dato, y una
 * propuesta lleva el mail o el WhatsApp de alguien que no está logueado —el
 * primer dato personal de un tercero que el proyecto guarda, y el que B-102 daba
 * por inexistente—.
 *
 * **Dos relojes, y el segundo es de B-844.** A los **30 días** de rechazada se va
 * el documento **y su imagen**, contados desde el rechazo (DEC-13). Y a los **30
 * días sin que nadie la toque** —el mismo número, otro reloj— se va también la
 * `nueva` o la `en-revision`, que es el caso que DEC-13
 * no contestó porque no se le preguntó: la que llegó, no interesó y quedó ahí
 * conservaba el mail o el WhatsApp de una persona **para siempre**, y el único
 * borrado que existía dependía de que un admin apretara «rechazar» —justo lo que
 * la retención automática vino a no depender—. La `aceptada` **no vence**, y eso
 * también es una decisión: ver `RETENCION_POR_ESTADO`.
 *
 * Las dos mitades —documento e imagen— se van juntas, y eso no es prolijidad: es
 * el punto 4 de «las nueve cosas que se rompen en silencio» del inventario. Un
 * objeto que sobrevive a su documento
 * es una foto de una persona **sin nada que la referencie**, así que no hay desde
 * dónde volver a encontrarla para borrarla; y un documento que sobrevive a su
 * objeto muestra un flyer roto en la bandeja.
 *
 * **Y no borra a ciegas** (B-864). El barrido decide al principio de la corrida y
 * borra segundos después; en el medio un admin puede tocar una vencida y ver el
 * plazo renovado. Desde B-864 la versión que la query vio viaja hasta el borrado
 * (`visto`) y el borrado la exige: una relectura de metadata antes de tocar
 * Storage, más `delete({ lastUpdateTime })` sobre el documento. El detalle —por
 * qué son dos guardas y por qué el orden de B-838 se queda como está— en
 * `borrarPropuesta`.
 *
 * **Y hay un flyer que este barrido no alcanza, y lo alcanza el de al lado**
 * (B-871). El original de una propuesta **aceptada** lo borra el trigger de
 * `propuestas-trigger.js` en la transición; si ese borrado no ocurre —no había
 * copia verificada, falló, o la propuesta ya estaba aceptada antes del deploy y
 * la transición no existió— el documento sigue sin vencer (el contacto sirve),
 * pero **la foto sí**: a los 30 días de aceptada la borra
 * `decidirFlyeresSinPlazo` + `borrarFlyer`, que recorren los objetos vivos de
 * `propuestas/` y se llevan también el que ningún documento nombra (D-1160,
 * D-1161). Corre en la misma Function, después de esta retención.
 *
 * ── Cómo está partido (B-1960, M-13 del PRD 6) ────────────────────────────
 * Este archivo es **la fachada y el porqué**: no tiene código, reexporta. Cada
 * ciclo de vida tiene su decisión pura y, al lado, lo que recibe el `db` o el
 * `bucket`:
 *
 *  - propuestas: `retencion-propuestas.js` + `retencion-propuestas-firestore.js`
 *    (`propuestasVencibles`, `borrarPropuesta`);
 *  - flyers de B-871: `retencion-flyers.js` + `retencion-flyers-firestore.js`
 *    (los lectores del bucket y `borrarFlyer`);
 *  - fichas de la Guía: `retencion-fichas.js` + `retencion-fichas-firestore.js`
 *    (`fichasVencibles`, `borrarFicha`).
 *
 * Los `-firestore.js` no importan `firebase-admin` ni `firebase-functions` —
 * mismo criterio que `subcoleccionesHuerfanas` en `limpieza-versiones.js` y
 * `referenciasEnUso` en `limpieza-imagenes.js`, y por el mismo motivo práctico:
 * así el test los importa sin el trigger, que arrastra
 * `firebase-functions/scheduler` (B-561). El pegamento vive en
 * `retencion-trigger.js`, que importa de cada módulo y no de esta fachada.
 *
 * ── Por qué NO es un trigger sobre el rechazo ─────────────────────────────
 * Porque el rechazo no es el borrado: DEC-13 pide **30 días**, que es el margen
 * para el «lo rechacé sin querer» —la bandeja ofrece reabrir— y para que quien
 * propuso pueda repreguntar. Un `onDocumentUpdated` que borrara en el acto haría
 * imposible las dos cosas. Es el mismo argumento del margen de rescate de
 * `limpieza-versiones.js`, con otro número.
 *
 * ── Y por qué esto no es la trampa 3 ni la 12 ─────────────────────────────
 * Este barrido corre por reloj y solo **borra**: en Firestore, un documento de
 * `/propuestas`; en Storage, un objeto bajo `propuestas/`, y un `delete()`
 * dispara `onObjectDeleted`, al que nada de este proyecto está suscripto
 * (`optimizarImagen` es `onObjectFinalized`).
 *
 * **Del lado de Firestore sí hay un trigger, y esto decía que no** (corregido
 * con B-871): desde B-863 `borrarImagenAlCerrar` es un
 * `onDocumentWritten` sobre `propuestas/{id}`, que se dispara también en un
 * `delete`. No encadena nada porque su decisión empieza por
 * `if (!after) return nada('propuesta-borrada')`: no borra ni escribe. Pero la
 * razón es ésa, no que la
 * colección esté sola — y la diferencia importa el día que alguien le agregue
 * algo a ese trigger. Mismo argumento que `limpieza-imagenes.js` para Storage.
 *
 * Está probado en `tests/retencion.test.ts` (la decisión) y en
 * `tests/retencion.integracion.test.ts` (las dos mitades del borrado, contra los
 * emuladores de Firestore y de Storage). Y lo que la **bandeja** dice sobre estos
 * plazos —«se borra en 6 días» en la ficha— se cruza contra esta misma decisión
 * en `tests/bandeja-de-propuestas.test.ts`: son dos implementaciones del mismo
 * plazo y no pueden separarse.
 */
export * from './retencion-propuestas.js';
export * from './retencion-propuestas-firestore.js';
export * from './retencion-flyers.js';
export * from './retencion-flyers-firestore.js';
export * from './retencion-fichas.js';
export * from './retencion-fichas-firestore.js';
