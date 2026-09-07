/**
 * Los destinos externos del sitio público: el calendario al que la gente se
 * suscribe, la cuenta de Instagram y la casilla de contacto — B-228.
 *
 * ── Por qué es un módulo y no tres constantes sueltas ─────────────────────
 * Porque son **datos con una regla adentro**, no strings. El `cid` de Google es
 * el ID del calendario en base64, la URL del ICS es el mismo ID escapado dentro
 * de otro path, y el `mailto:` lleva un asunto que decide de qué lado cae el
 * mensaje. Tres lugares distintos del sitio los van a necesitar —la home, la
 * página de ayuda y la de contacto— y derivarlos en cada uno es la clase de bug
 * que este repo ya tiene nombrada (B-72, B-88): la copia que se olvida de
 * actualizar publica un link roto mientras las otras dos andan, y nada falla.
 *
 * Así que **todo se deriva de `CALENDARIO_ID`**, que es el único dato crudo.
 *
 * ── La trampa que este módulo evita ───────────────────────────────────────
 * Google publica dos URLs de ICS para el mismo calendario:
 *
 *     .../ical/<id>/public/basic.ics       ← la pública
 *     .../ical/<id>/private-<token>/basic.ics   ← NUNCA
 *
 * La segunda **da acceso de lectura al calendario entero a quien la tenga**, y no
 * se puede revocar sin rotarla desde la configuración (está advertido en
 * `07-seguridad.md`). Son un carácter de diferencia en el path y se copian
 * igual de fácil. `tests/enlaces.test.ts` falla si alguna de estas URLs contiene
 * `private-`, y el barrido de datos personales cubre el resto.
 */

/**
 * El ID del calendario público. Es el mismo que documenta
 * `02-infraestructura.md` § "Google Calendar" y con el que está compartida
 * `calendar-sync@`: si algún día cambia, cambian los dos.
 *
 * No es un secreto — es la dirección de un calendario que existe para que la
 * gente se suscriba.
 */
export const CALENDARIO_ID =
  '68e6037bad1570002e484be4a5a21b6dd052afadef1af6c4cb99946b0d2aaea3@group.calendar.google.com';

/** La cuenta donde se anuncian las actividades. */
export const INSTAGRAM = 'librosdelatiahildita';

/**
 * La casilla de contacto del proyecto.
 *
 * Es un gmail y está versionada a propósito: **no es la casilla de una persona**,
 * es la dirección que el sitio publica para que le escriban. Por eso figura como
 * excepción explícita en `tests/sin-datos-personales.test.ts` — con su motivo al
 * lado, no como un patrón que apague el chequeo.
 */
export const CONTACTO = 'agendaleh@gmail.com';

/**
 * Los dos motivos por los que alguien escribe, y el asunto con el que llega.
 *
 * El prefijo va en el asunto para que se puedan separar en la bandeja sin
 * abrirlos: una sugerencia se lee cuando hay tiempo, un error roto se lee ya.
 * Es lo que pidió el dueño del proyecto.
 */
export const MOTIVOS_DE_CONTACTO = {
  sugerencia: {
    asunto: 'Sugerencia de actividad',
    etiqueta: 'Sugerir una actividad',
    ayuda: 'Contanos qué actividad falta: quién la da, cuándo y dónde.',
  },
  error: {
    asunto: 'Reporte de un error',
    etiqueta: 'Reportar un error',
    ayuda: 'Contanos qué viste mal y en qué página, así lo podemos encontrar.',
  },
} as const;

export type MotivoDeContacto = keyof typeof MOTIVOS_DE_CONTACTO;

/**
 * El asunto del mail de la sección comercial (`/anunciar`) — B-770.
 *
 * ── Por qué NO es un tercer `MOTIVO_DE_CONTACTO` ──────────────────────────
 * Porque `MOTIVOS_DE_CONTACTO` no es «la lista de asuntos del proyecto»: es **la
 * lista de motivos por los que un visitante escribe**, y `/contacto` **deriva sus
 * bloques recorriéndola** (`contactoDelSitio.ts`). Agregar acá el motivo
 * comercial le pondría a esa página una tercera tarjeta —«Anunciar en la
 * agenda»— sin que nadie lo decida, en una página cuyo `<title>` y cuya
 * `meta description` hablan de sugerir una actividad y de reportar un error, y
 * cuya forma es «una elección entre dos» (B-253). El público tampoco es el mismo:
 * `/contacto` le habla a quien busca talleres, y esto a quien tiene un local.
 *
 * Lo que **sí** se comparte es lo que importa, que es el mecanismo: la casilla
 * (`CONTACTO`), el armado del `mailto:` y la regla de que el asunto viaja para
 * poder separar el mensaje en la bandeja sin abrirlo. De eso se ocupa
 * `mailtoAlProyecto`, y por eso este asunto tiene que ser distinto de los otros
 * dos — lo verifica `tests/enlaces.test.ts`.
 */
export const ASUNTO_COMERCIAL = 'Publicidad en la agenda';

/**
 * El `mailto:` a la casilla del proyecto, con el asunto ya puesto.
 *
 * `cuerpo` es opcional y sirve para precargar el contexto. No se precarga nada
 * más: un `mailto:` largo se rompe en algunos clientes y, sobre todo, escribir
 * por adelantado lo que la persona quería decir hace que no lo diga.
 */
const mailtoAlProyecto = (asunto: string, cuerpo?: string): string => {
  const partes = [`subject=${encodeURIComponent(asunto)}`];
  if (cuerpo) partes.push(`body=${encodeURIComponent(cuerpo)}`);
  return `mailto:${CONTACTO}?${partes.join('&')}`;
};

/** El calendario en la web de Google, para "abrirlo y ver". */
export const urlDelCalendario = (): string =>
  `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(CALENDARIO_ID)}&ctz=America/Argentina/Buenos_Aires`;

/**
 * El botón "agregar a mi Google Calendar". El `cid` es el ID en base64 — así lo
 * espera Google, y por eso se deriva en vez de pegarse: un base64 pegado a mano
 * no se puede leer para verificar que apunta al calendario que uno cree.
 */
export const urlParaSuscribirseEnGoogle = (): string => {
  const cid =
    typeof btoa === 'function'
      ? btoa(CALENDARIO_ID)
      : Buffer.from(CALENDARIO_ID, 'utf8').toString('base64');
  return `https://calendar.google.com/calendar/u/0?cid=${cid}`;
};

/**
 * El ICS **público** — el que sirve para Apple Calendar, Outlook y cualquier otro
 * lector. Ver la advertencia de arriba: la variante `private-` no va nunca.
 */
export const urlDelIcs = (): string =>
  `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDARIO_ID)}/public/basic.ics`;

/**
 * El mismo ICS con esquema `webcal:`, que en iOS y en macOS abre la app de
 * calendario en vez de descargar un archivo que después hay que buscar.
 */
export const urlWebcal = (): string => urlDelIcs().replace(/^https:/, 'webcal:');

export const urlDeInstagram = (): string => `https://www.instagram.com/${INSTAGRAM}/`;

/**
 * El usuario de Cafecito donde se reciben los aportes — B-780.
 *
 * ── ⚠️ BLOQUEANTE DEL DEPLOY: el perfil todavía no está creado ────────────
 * Está puesto por coherencia con el dominio (`agendaleh.ar`) y con la casilla
 * (`agendaleh@gmail.com`), **pero nadie registró `agendaleh` en cafecito.app**.
 * Quien lo cree tiene que reservar ese nombre o cambiar esta línea.
 *
 * El 404 es la mitad menor del problema —el link se ve bien y el destino roto lo
 * ve solo quien hizo el click, o sea justo la persona que se decidió a aportar—.
 * La mitad grande la señaló el `auditor-privacidad`: `/apoyar` entra al
 * `sitemap.xml` **sin `noindex`** y se enlaza desde el pie de todas las páginas,
 * así que deployar así **publica e indexa un nombre de usuario de cobro que no
 * tiene dueño**. Cualquiera que lea la página puede registrarlo y quedarse con
 * los aportes dirigidos a la agenda, y eso no se deshace: la página ya está en
 * Google apuntando a un perfil ajeno.
 *
 * O sea que el orden importa: **primero se crea el perfil, después se deploya**.
 * Está anotado como bloqueante en `.estado/apoyo.md` para el `BACKLOG` (B-780).
 * No hay test que lo pueda cubrir: que un perfil exista del otro lado no se sabe
 * sin salir a la red, y lo que sí se verifica es la forma de la URL
 * (`tests/enlaces.test.ts`).
 *
 * ── Por qué es una constante y no la URL entera ───────────────────────────
 * Porque el nombre de usuario es el único dato crudo: la URL del perfil es
 * `cafecito.app/<usuario>` y nada más. Es el mismo criterio con el que
 * `CALENDARIO_ID` es el único dato del que salen las cuatro direcciones del
 * calendario — el día que el perfil se renombre, se cambia acá.
 */
export const CAFECITO = 'agendaleh';

/**
 * El perfil de Cafecito, y **la única forma en que el sitio toca Cafecito**.
 *
 * ── Es un enlace de salida, no un botón embebido ──────────────────────────
 * Cafecito ofrece un botón para pegar en un sitio: un `<img>` servido desde
 * `cdn.cafecito.app` envuelto en un `<a>`. **Acá no se usa.** Este sitio no
 * contacta ningún host de tercero en el load —lo verifica
 * `tests/terceros-antes-del-consentimiento.test.ts`, que nació justamente de un
 * `preconnect` a un tercero que nadie había decidido— y ese `<img>` sería un
 * pedido a un dominio ajeno en cuanto la página se abre, sin que la persona
 * haya hecho nada. El botón lo dibuja el sitio con sus propias clases
 * (`claseBotonPrimario`), que además es lo que hace que se vea como el resto.
 *
 * Rehospedar su SVG acá tampoco: sus términos dicen que las marcas y los signos
 * distintivos son de ellos y que acceder al sitio no da ningún derecho sobre
 * ellos. Nombrar «Cafecito» en una frase es otra cosa —es cómo se llama el
 * servicio— y es lo único que la página hace.
 *
 * Sin `?`, sin `utm_` y sin nada colgado: no hay nada que medir del otro lado,
 * y un parámetro puesto «por si acaso» es un dato más que viaja.
 */
export const urlDeCafecito = (): string => `https://cafecito.app/${CAFECITO}`;

/**
 * El `mailto:` con el asunto ya puesto.
 *
 * `cuerpo` es opcional y sirve para precargar el contexto —por ejemplo, en qué
 * página estaba quien reporta un error—. No se precarga nada más: un `mailto:`
 * largo se rompe en algunos clientes y, sobre todo, escribir por adelantado lo
 * que la persona quería decir hace que no lo diga.
 */
export const urlDeContacto = (motivo: MotivoDeContacto, cuerpo?: string): string =>
  mailtoAlProyecto(MOTIVOS_DE_CONTACTO[motivo].asunto, cuerpo);

/**
 * El mail de la sección comercial — B-770.
 *
 * Es el mismo mecanismo que `urlDeContacto` con otro asunto, y no una segunda
 * implementación: las dos salen de `mailtoAlProyecto`, o sea de la misma casilla
 * y del mismo armado. Un `mailto:` escrito a mano en la página comercial
 * funcionaría igual de bien hoy y dejaría de funcionar el día que la casilla
 * cambie, en una sola de las páginas y sin que nada falle (la clase B-72/B-88).
 */
export const urlDeContactoComercial = (cuerpo?: string): string =>
  mailtoAlProyecto(ASUNTO_COMERCIAL, cuerpo);
