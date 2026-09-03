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
export { dispararRebuild } from './rebuild-trigger.js';
export { guardarVersion, guardarVersionAlBorrar } from './historial-trigger.js';
export { limpiarVersionesHuerfanas } from './versiones-limpieza-trigger.js';
export { reporteAIssue } from './reportes-trigger.js';
export { optimizarImagen } from './imagenes-trigger.js';
export { limpiarImagenesHuerfanas } from './imagenes-limpieza-trigger.js';
