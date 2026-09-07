/**
 * **Cuando una parte del panel no llega, saber por qué** — reporte del dueño
 * (2026-09-07): «me siguen diciendo que no se pueden subir imágenes y dice "no se
 * pudo subir la imagen, volvé a intentarlo…", que creo que es algo que ya
 * arreglamos».
 *
 * Y tenía razón en las dos mitades: **algo ya se había arreglado** —B-590 tradujo
 * los códigos de Storage, así que un permiso o una cuota hoy se dicen por su
 * nombre— y **ese mensaje seguía apareciendo**, porque es el genérico del `catch`
 * y solo se muestra cuando el error **no** es un rechazo conocido. Del flujo de
 * subida, lo único que puede fallar así es lo primero que hace: el
 * `import('@/lib/subir-imagen')`.
 *
 * ── Por qué ese import falla, y por qué justo a quien tiene el panel abierto ──
 * El SDK de Storage se carga diferido para no arrastrarlo al chunk inicial (B-09,
 * D-51), o sea que el código de la subida vive en un archivo aparte con el hash
 * del build en el nombre. `firebase.json` sirve `/_astro/**` con
 * `immutable, max-age=31536000` y el HTML con `no-cache`: **la pestaña abierta se
 * queda con el HTML viejo hasta que se recargue**, y ese HTML apunta a un chunk
 * que el deploy siguiente ya borró de Hosting. El `import()` se lleva un 404.
 *
 * Es decir: **le pasa exactamente a quien dejó el panel abierto y está cargando
 * una actividad**, que es cuando se suben las imágenes. Y no lo arregla reintentar
 * —el archivo no existe más— así que «volvé a intentar en un momento» es el peor
 * mensaje posible: manda a repetir lo único que no puede funcionar.
 *
 * ── La detección, y lo que NO se afirma ───────────────────────────────────
 * Los tres motores dicen esto distinto y ninguno expone un código, así que se
 * reconoce por el texto —con las tres formas nombradas— más el `SyntaxError` del
 * caso en que un rewrite devuelve HTML donde iba JavaScript.
 *
 * **No se afirma que la pestaña esté vieja.** Sin red, Chrome tira *el mismo*
 * `TypeError`: quedarse sin conexión y tener el chunk borrado son indistinguibles
 * desde acá. Por eso el mensaje nombra las dos causas y ofrece la única acción que
 * sirve para las dos —recargar—, en vez de elegir una y acertar la mitad de las
 * veces. Es la misma honestidad que `motivoDeSubidaFallida`: decir lo que se sabe.
 */

/**
 * Las formas en que cada motor cuenta que un `import()` no llegó.
 *
 * Escritas con el navegador al lado porque son cadenas de otro y pueden cambiar:
 * si alguna se renombra, este módulo deja de reconocer ese caso y hay que
 * agregarla — el costo es volver al mensaje genérico, no un error nuevo.
 */
const FORMAS = [
  // Chromium: `Failed to fetch dynamically imported module: https://…`
  /failed to fetch dynamically imported module/i,
  // Firefox: `error loading dynamically imported module`
  /error loading dynamically imported module/i,
  // Safari: `Importing a module script failed.`
  /importing a module script failed/i,
  // Vite/Rollup, cuando el preload del chunk falla antes del import.
  /failed to (?:load|import) module script/i,
] as const;

/**
 * ¿Este error es «no llegó el módulo»?
 *
 * El `SyntaxError` es el caso del rewrite: si un día `/admin/**` empezara a
 * atrapar también los assets, el navegador recibiría el HTML del panel con
 * `Content-Type` de JavaScript y lo que falla es el parseo, no la red. Se
 * reconoce igual porque para quien lo sufre es lo mismo y la acción también.
 */
export const esFalloDeCarga = (e: unknown): boolean => {
  if (!e || typeof e !== 'object') return false;
  const { name, message } = e as { name?: unknown; message?: unknown };
  const texto = typeof message === 'string' ? message : '';
  if (name === 'SyntaxError' && /unexpected token|module script/i.test(texto)) return true;
  return FORMAS.some((forma) => forma.test(texto));
};

/**
 * Qué se le dice a la persona, y la única acción que sirve.
 *
 * Nombra **las dos** causas posibles porque no se pueden distinguir (ver el
 * encabezado): la conexión y la pestaña vieja se ven igual desde acá, y elegir una
 * sería acertar la mitad de las veces.
 *
 * **No promete nada sobre el borrador**, y eso está partido a propósito: ver
 * `PROMESA_DEL_BORRADOR`.
 */
export const MENSAJE_PESTANIA_VIEJA =
  'No se pudo cargar esa parte del panel. Puede ser la conexión, o que esta ' +
  'pestaña haya quedado abierta desde antes de la última actualización. ' +
  'Conviene recargar.';

/**
 * **La frase que hace que alguien recargue** — y está aparte porque solo es
 * cierta en un lugar.
 *
 * Sin ella, «recargá» se lee como «perdé lo que estabas haciendo» y nadie lo
 * hace: es exactamente por eso que el reporte de B-805 llegó dos veces, con el
 * aviso de versión diciendo lo contrario.
 *
 * **Se agrega solo donde el borrador existe**, que es el formulario de actividad
 * (`useAutoguardado`, D-122). Lo señaló el `auditor-privacidad`: el formulario de
 * **reportes** no tiene autoguardado —y es el origen de B-191, «reporté algo y
 * todo lo que escribí se borró»— así que pegarle esta frase a un mensaje genérico
 * la convertiría en una promesa falsa justo ahí.
 *
 * **Dice «queda guardado» y nada sobre que se lo vayan a ofrecer**, y eso es una
 * corrección del `auditor-privacidad` sobre su propio hallazgo anterior: lo
 * segundo depende del build **siguiente**. Si el deploy que hace aparecer el
 * mensaje —que es el que borró el chunk— subió `VERSION_BORRADOR`,
 * `leerBorradorLocal` descarta el borrador al leerlo, así que «te lo va a
 * ofrecer» habría sido falso justo en el caso que el mensaje describe. La
 * escritura ya ocurrió; el ofrecimiento no se puede prometer desde acá, y el aviso
 * de recuperación del formulario lo anuncia solo cuando de verdad hay algo.
 *
 * El par con la versión del borrador queda atado igual
 * (`VERSION_BORRADOR_DE_ESTA_PROMESA`, abajo): sirve para que el próximo bump sea
 * un punto de decisión y no un silencio.
 */
export const PROMESA_DEL_BORRADOR =
  ' Lo que estabas cargando queda guardado en este navegador.';

/**
 * **La versión del borrador contra la que se escribió `PROMESA_DEL_BORRADOR`.**
 *
 * `leerBorradorLocal` **descarta** el borrador cuando su `version` no es la
 * actual, y esa versión se sube justamente «cuando el formulario cambia de forma».
 * O sea que **el deploy que hace aparecer el mensaje puede ser el que borró el
 * borrador**, en silencio: la promesa nace falsa el día que alguien sube el
 * número, y nada la ataba.
 *
 * Lo encontró el `auditor-privacidad` sobre B-805. `tests/carga-diferida.test.ts`
 * compara este número con el de verdad: subir uno sin el otro deja el par en rojo,
 * y ahí hay que decidir qué dice el mensaje en **ese** deploy —lo razonable es
 * acotarlo por una vez— en vez de descubrirlo por un reporte.
 */
export const VERSION_BORRADOR_DE_ESTA_PROMESA = 3;
