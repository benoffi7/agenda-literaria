/**
 * **El reporte de «no pudimos verificar tu navegador»** — B-930 paso 3.
 *
 * ── Qué problema cierra ───────────────────────────────────────────────────
 * Con App Check exigido en Firestore, un navegador que no consigue token no
 * puede leer ni guardar nada. Desde el paso 1 el panel se lo dice a la persona
 * (`src/lib/verificacionDelNavegador.ts`, `AvisoVerificacion.tsx`), pero **nadie
 * más se enteraba**: el token que no llega pasa en el navegador y no deja ningún
 * log en el servidor, así que la alerta de GCP de las `alerta` (B-871,
 * `docs/08-operacion.md`) no lo podía ver. Con dos personas cargando, el reclamo
 * puede tardar un día, o no llegar.
 *
 * Esta Function es lo mínimo para que llegue: recibe **un motivo** de una lista
 * cerrada y lo loguea con `alerta: 'verificacion-del-navegador'`. La alerta que
 * ya existe manda el mail sin tocar la consola.
 *
 * ── Por qué una `onRequest` y no una callable — D-1225 ────────────────────
 * Lo que falta es justamente el token de App Check, así que el endpoint **no
 * puede** exigirlo. Y una callable tampoco sirve sin exigirlo: el SDK de
 * Functions le pide el token a App Check antes de mandar la petición, y con el
 * script de reCAPTCHA bloqueado ese pedido **no vuelve nunca** (el mismo motivo
 * del umbral de D-820). El reporte se quedaría colgado del mismo cuelgue que
 * viene a reportar. Un `fetch` plano no pasa por ningún SDK.
 *
 * ── Por qué no hace falta sesión del lado del servidor — D-1226 ───────────
 * Lo que **esta Function** loguea no tiene nada de la persona —ni uid, ni mail,
 * ni IP, ni user agent—, así que no hay dato que proteger con un login. (Cloud
 * Run escribe aparte su log de cada pedido, con IP y user agent, y el `warn` lleva
 * la traza que lleva a ese log: eso es de la plataforma y está dicho en
 * `docs/02-infraestructura.md` § «El reporte al servidor».) Lo único que alguien
 * puede hacer pegándole a mano es **ruido**: un mail de más. Eso lo acota esto:
 *
 * 1. `motivo` de una lista cerrada, y nada más en el cuerpo: no se puede meter
 *    texto propio en el log ni en el mail.
 * 2. Solo `POST`, cuerpo de a lo sumo `LARGO_MAXIMO_DEL_CUERPO` bytes.
 * 3. `Origin` de los cuatro nombres del sitio (el resto se descarta sin `warn`).
 *    Un script lo puede falsificar; lo que frena es a otra página web que
 *    mande el pedido desde el navegador de sus visitas.
 * 4. Un tope de `TOPE_POR_MINUTO` logs por minuto por instancia, y
 *    `maxInstances: 1` en el trigger: un spam deja como mucho un puñado de
 *    líneas por minuto.
 * 5. Y la política de GCP manda **como mucho un mail por hora**.
 *
 * El filtro de que la persona esté logueada existe igual, pero **en el panel**
 * (`src/lib/reporteDeVerificacion.ts`): no es seguridad —el servidor no lo puede
 * verificar sin otro token— sino que filtra el ruido legítimo, como un crawler
 * que renderiza `/admin` con reCAPTCHA bloqueado.
 *
 * ── Qué hay acá ───────────────────────────────────────────────────────────
 * Todo puro: la decisión (`decidirReporte`) y el manejador con el log y el reloj
 * inyectados (`crearManejador`). El `onRequest` está en
 * `verificacion-del-navegador-trigger.js` y no decide nada. No importa
 * `firebase-functions` ni `firebase-admin`.
 */

/** El valor de `alerta` que engancha la política de GCP de B-871. */
export const ALERTA = 'verificacion-del-navegador';

/**
 * **Por qué el navegador quedó sin verificar.** Es el vocabulario de
 * `CausaSinVerificar` en `src/lib/verificacionDelNavegador.ts`: productor y
 * consumidor en dos runtimes, atados por `tests/verificacion-del-navegador-reporte.test.ts`
 * (clase de B-88).
 *
 * - `no-se-activo`: `initializeAppCheck` tiró, o no hubo quién pida el token.
 * - `token-rechazado`: `getToken` rechazó — un 403 o la red en el intercambio.
 * - `sin-respuesta`: `getToken` no volvió dentro del umbral. Es el caso de la
 *   extensión que bloquea reCAPTCHA.
 * - `renovacion-fallida`: había token y una renovación a mitad de sesión se
 *   quedó sin ninguno válido (B-1250).
 *
 * No son los de `MotivoSinAppCheck`: de esos, el único que termina en el cartel
 * es `fallo`, que acá es `no-se-activo`. Los otros tres (`sin-navegador`,
 * `emuladores`, `sin-clave`) no avisan, así que tampoco reportan.
 */
export const MOTIVOS_DE_VERIFICACION = Object.freeze([
  'no-se-activo',
  'token-rechazado',
  'sin-respuesta',
  'renovacion-fallida',
]);

/**
 * Los orígenes que pueden reportar: los cuatro nombres que sirven el panel, que
 * son los cuatro dominios de la clave de reCAPTCHA (`docs/02-infraestructura.md`
 * § «Los dominios permitidos»). Un nombre nuevo del sitio va acá **y** en la
 * clave; sin lo segundo el panel ni siquiera consigue token.
 */
export const ORIGENES_PERMITIDOS = Object.freeze([
  'https://agendaleh.ar',
  'https://agendaleh.com.ar',
  'https://agenda-literaria.web.app',
  'https://agenda-literaria.firebaseapp.com',
]);

/**
 * `{"motivo":"renovacion-fallida"}` son 31 bytes. 200 deja margen para un
 * espacio o un salto de línea sin dejar lugar para nada que valga la pena.
 */
export const LARGO_MAXIMO_DEL_CUERPO = 200;

/**
 * Cuántos reportes se loguean por minuto y por instancia. Con dos personas
 * cargando, más de cinco en un minuto no es un problema real sino un loop o
 * alguien pegándole a mano; lo que pase de ahí se descarta **sin `warn`**, así
 * que no llega al mail. El pedido igual deja el log de plataforma de Cloud Run:
 * el tope frena la alerta, no el tráfico.
 */
export const TOPE_POR_MINUTO = 5;

const MINUTO_MS = 60_000;

/** La ventana del tope, vacía. Se guarda afuera de la decisión, en la instancia. */
export const ventanaVacia = () => ({ inicio: 0, cuenta: 0 });

/**
 * Lee el motivo de un cuerpo crudo. Devuelve `null` para todo lo que no sea
 * exactamente `{ motivo: <uno de la lista> }`: otro campo, otro tipo, JSON roto.
 * Una clave de más se rechaza, y no se ignora, para que nadie empiece a mandar
 * algo «que igual no se loguea» y un día sí.
 */
export const leerMotivo = (crudo) => {
  if (typeof crudo !== 'string') return null;
  let datos;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return null;
  }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null;
  const claves = Object.keys(datos);
  if (claves.length !== 1 || claves[0] !== 'motivo') return null;
  return MOTIVOS_DE_VERIFICACION.includes(datos.motivo) ? datos.motivo : null;
};

/**
 * **La decisión entera**, pura: qué contestar, si se loguea, y cómo queda la
 * ventana del tope.
 *
 * Las respuestas no le dicen nada útil a quien prueba: el panel no las lee
 * (manda y se olvida), así que el único que las ve es alguien probando a mano, y
 * a ése un `204` en el descarte por tope no le cuenta que llegó al tope.
 *
 * @param {{ metodo: string, origen: string | undefined, cuerpo: string | undefined,
 *           ahora: number, ventana: { inicio: number, cuenta: number } }} p
 * @returns {{ estado: number, motivo: string | null, ventana: { inicio: number, cuenta: number } }}
 */
export const decidirReporte = ({ metodo, origen, cuerpo, ahora, ventana }) => {
  const nada = (estado) => ({ estado, motivo: null, ventana });
  if (metodo !== 'POST') return nada(405);
  if (!origen || !ORIGENES_PERMITIDOS.includes(origen)) return nada(403);
  if (typeof cuerpo !== 'string') return nada(400);
  // Largo en bytes y no en caracteres: el tope es sobre lo que viaja.
  if (Buffer.byteLength(cuerpo, 'utf8') > LARGO_MAXIMO_DEL_CUERPO) return nada(413);
  const motivo = leerMotivo(cuerpo);
  if (!motivo) return nada(400);

  const vigente = ahora - ventana.inicio < MINUTO_MS ? ventana : { inicio: ahora, cuenta: 0 };
  if (vigente.cuenta >= TOPE_POR_MINUTO) return { estado: 204, motivo: null, ventana: vigente };
  return { estado: 204, motivo, ventana: { inicio: vigente.inicio, cuenta: vigente.cuenta + 1 } };
};

/**
 * El cuerpo crudo del pedido, como texto. `rawBody` es lo que deja el framework
 * de Functions; `body` en string es el caso `text/plain` sin `rawBody`. Un
 * cuerpo ya parseado a objeto se vuelve a serializar, para que la decisión vea
 * siempre lo mismo.
 */
const cuerpoComoTexto = (req) => {
  if (req.rawBody && typeof req.rawBody.length === 'number') {
    return Buffer.from(req.rawBody).toString('utf8');
  }
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return undefined;
};

/**
 * El manejador HTTP, con el log y el reloj inyectados para testearlo con
 * dobles. La ventana del tope vive en el cierre: una por instancia, que con
 * `maxInstances: 1` es una sola.
 *
 * **Lo único que esta Function loguea es el motivo.** Ni la IP, ni el user
 * agent, ni el `Origin` (los de la plataforma, ver la cabecera): para el triaje alcanza con saber que pasó y por cuál de los cuatro
 * caminos (`docs/08-operacion.md` § «Un navegador sin verificar»).
 *
 * @param {{ avisar: (mensaje: string, campos: { alerta: string, motivo: string }) => void, ahora?: () => number }} deps
 */
export const crearManejador = ({ avisar, ahora = () => Date.now() }) => {
  let ventana = ventanaVacia();
  return (req, res) => {
    const d = decidirReporte({
      metodo: req.method,
      origen: req.get ? req.get('origin') : req.headers?.origin,
      cuerpo: cuerpoComoTexto(req),
      ahora: ahora(),
      ventana,
    });
    ventana = d.ventana;
    if (d.motivo) {
      avisar('un navegador del panel no pudo verificarse con App Check', {
        alerta: ALERTA,
        motivo: d.motivo,
      });
    }
    res.status(d.estado).end();
  };
};
