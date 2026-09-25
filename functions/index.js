/**
 * El punto de entrada del deploy: inicializa el Admin SDK y publica las
 * Functions. **Nada más.**
 *
 * ── B-77 ──────────────────────────────────────────────────────────────────
 * Hasta acá este era el único archivo de `functions/` sin el corte puro/trigger
 * que prescribe `docs/05-patrones.md`: 542 LOC con seis responsabilidades —init
 * de `db`, auth de Calendar, carga de labels, marcado de rebuild, tres triggers
 * y un cliente HTTP de GitHub— y sin ningún test. Ya se había cobrado una: el
 * cliente de GitHub se duplicó sin el timeout (B-74), que es lo que pasa cuando
 * el pegamento y la decisión viven en el mismo lugar.
 *
 * Ahora cada pieza está en su archivo, y este quedó como lo que tiene que ser:
 *
 * | Archivo | Qué es |
 * |---|---|
 * | `calendario.js`, `sincronizacion.js`, `rebuild.js`, `historial.js`, … | puro, sin red ni Firebase |
 * | `despliegue.js`, `etiquetas.js`, `github.js`, `marca-de-rebuild.js`, `calendario-api.js` | infraestructura, con la dependencia inyectada donde se puede |
 * | `*-trigger.js` | los wrappers de Cloud Functions |
 * | este archivo | init + re-exports |
 *
 * ── Por qué `setGlobalOptions` sigue acá y no gobierna nada ────────────────
 * En ESM los módulos importados se evalúan **antes** que el cuerpo del
 * importador, así que cuando los `*-trigger.js` de arriba se cargan, esta llamada
 * todavía no corrió: ninguna Function de este proyecto hereda de acá, y por eso
 * cada una declara sus opciones (D-35, `despliegue.js`). Queda igual, y a
 * propósito: es la red para el día en que alguien defina una Function en este
 * archivo sin acordarse de D-35 — que es exactamente el error que el comentario
 * de arriba describe.
 */
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { OPCIONES_BASE } from './despliegue.js';

initializeApp();
setGlobalOptions(OPCIONES_BASE);

export { syncCalendar } from './calendario-trigger.js';
export { rebuildPorOpciones } from './opciones-trigger.js';
// B-901 — el rebuild cuando cambia una librería. Es la trampa 8 con otra cara:
// sin esto se publica una ficha y el sitio estático no la muestra nunca.
export { rebuildPorLibrerias } from './directorios-trigger.js';
// B-832 — y el de las suscripciones literarias. Uno por colección: Firestore no
// matchea un comodín en el segmento de colección, así que cada directorio nuevo
// se ve acá o no existe.
export { rebuildPorSuscripciones } from './directorios-trigger.js';
// B-833 — y el de los lugares para eventos, el tercero y último directorio de la
// Guía. Acá el rebuild además es lo que hace efectivo apagar `direccionPublica`:
// sin él, la dirección de una casa seguiría publicada después de bajar la
// casilla (§ 6 del PRD 4).
export { rebuildPorLugares } from './directorios-trigger.js';
// B-960 — y el de las bibliotecas, el cuarto directorio de la Guía. Va acá y no
// se deriva por el mismo motivo que los tres de arriba: `onDocumentWritten` no
// matchea un comodín en el segmento de colección, así que cada directorio nuevo
// necesita su propio trigger exportado.
export { rebuildPorBibliotecas } from './directorios-trigger.js';
// B-959 — el de las efemérides. Es el único trigger de esa colección: no hay
// sync a Calendar para ellas, porque no son actividades (D-1170).
export { rebuildPorEfemerides } from './efemerides-trigger.js';
export { dispararRebuild } from './rebuild-trigger.js';
export { guardarVersion, guardarVersionAlBorrar } from './historial-trigger.js';
export { limpiarVersionesHuerfanas } from './versiones-limpieza-trigger.js';
export { reporteAIssue } from './reportes-trigger.js';
export { optimizarImagen } from './imagenes-trigger.js';
export { limpiarImagenesHuerfanas } from './imagenes-limpieza-trigger.js';
export { borrarPropuestasVencidas } from './retencion-trigger.js';
// B-904 / B-912 / B-917 — la misma promesa de DEC-13 para las tres guías: una
// ficha descartada, o que nadie miró, no se queda con el contacto de quien la
// cargó para siempre. Una Function para las tres, con la lista derivada de
// `COLECCIONES_DE_DIRECTORIO`.
export { borrarFichasVencidas } from './retencion-trigger.js';
export { borrarImagenAlCerrar } from './propuestas-trigger.js';
// B-896 — la primera callable del proyecto, con `enforceAppCheck: true`: recibe
// el flyer de `/proponer`, lo sanea del lado del servidor y lo escribe con el
// Admin SDK. Es lo que deja `storage.rules` con el `create` de `propuestas/`
// cerrado a todo cliente.
export { subirFlyerDePropuesta } from './flyer-de-propuesta-trigger.js';
// B-893 — la segunda, también con `enforceAppCheck: true`: el publicador crea
// una etiqueta con «Otro…» sin tener `write` sobre `/opciones/*`. La Function
// verifica que lo único que cambia del array es ese elemento, nacido sin
// aprobar — lo que las reglas no pueden verificar (D-810).
export { crearOpcionDelPanel } from './alta-de-opcion-trigger.js';
export { traerAnaliticaDelSitio } from './analitica-trigger.js';
export { verificarFrescuraDelSitio } from './frescura-trigger.js';
// B-930 paso 3 — la primera `onRequest`: el panel avisa que un navegador no
// consiguió token de App Check, y el `logger.warn` con `alerta` le llega al
// dueño por la política de GCP de B-871. Sin `enforceAppCheck`, porque lo que
// reporta es justamente que no hay token (D-1225).
export { reportarVerificacionDelNavegador } from './verificacion-del-navegador-trigger.js';
