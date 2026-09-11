/**
 * **El flyer de una propuesta, saneado del lado del servidor** — B-896 paso 1.
 *
 * ── Por qué esto existe, que es todo el punto del ítem ─────────────────────
 * Hasta acá la subida anónima de `/proponer` iba **directo a Storage** con el
 * SDK del navegador, y el saneado —sacarle a la foto el EXIF con las
 * coordenadas de la casa donde se hace el taller— corría **solo en el cliente**
 * (`src/lib/subir-imagen.ts` + `imagenes-archivo.ts`). Eso es un falso verde de
 * manual: **un cliente se puede saltear el saneado del cliente** abriendo la
 * consola del navegador, así que el chequeo no podía fallar nunca y era peor que
 * no tenerlo — daba la garantía sin poder darla.
 *
 * Y no alcanzaba con exigir App Check en Storage para tapar el agujero del
 * endpoint anónimo: **el enforcement de App Check es por servicio y no por
 * path**, así que exigirlo en `firebasestorage` arriesga **todas** las lecturas
 * de imagen del sitio (B-872). El enforcement de **Functions** es independiente
 * y no toca ninguna lectura. De ahí la forma: una callable con
 * `enforceAppCheck: true` recibe la imagen, la sanea acá, y escribe el objeto
 * con el Admin SDK — y `storage.rules` para `propuestas/` se queda con el
 * `create` **cerrado a todo cliente**, que es más fuerte que abrirlo.
 *
 * ── Este archivo es la decisión; el pegamento está en el `-trigger` ────────
 * Mismo corte que el resto de `functions/` (`docs/05-patrones.md`): acá no se
 * importa `firebase-admin` ni `firebase-functions`, no se toca el bucket y no se
 * lee el reloj. Entra un Buffer y sale un Buffer, así que **se prueba con vitest
 * sin emuladores** — que es lo único que hace verificable este frente, porque el
 * CI **no levanta el emulador de Functions** (D-660).
 *
 * ── Y el saneado no se reimplementa: se reusa el de la Function ───────────
 * La pregunta «¿este bloque es metadato, o hace falta para ver la imagen?» ya
 * tiene una sola respuesta en este repo, y son las dos tablas compartidas por
 * alias con el panel: `jpeg-appn-seguros.js` (B-869) y `png-chunks-seguros.js`
 * (B-323). `estructuraConocida` y `traeMetadatos` —de `imagenes-optimizar.js`—
 * las usan, y acá se usan **esas**, no una copia. Escribir un tercer recorrido
 * de marcadores sería la clase de B-88 con tres cabezas.
 */
import sharp from 'sharp';
import { estructuraConocida, optimizar, traeMetadatos } from './imagenes-optimizar.js';

/**
 * Dónde vive el flyer. **Tiene que coincidir con `PREFIJO_PROPUESTAS` de
 * `src/lib/imagenes-archivo.ts`, con `storage.rules`, con `firestore.rules` y
 * con `functions/retencion.js`**, y los ata `tests/propuestas-imagen.test.ts`
 * leyendo los fuentes.
 */
export const PREFIJO_PROPUESTAS = 'propuestas/';

/**
 * DEC-7b — 3 MB, el mismo número que `MAXIMO_BYTES` de `src/lib/imagenes.ts` y
 * que `tamanoAceptado()` de `storage.rules`.
 *
 * **Se mide sobre el archivo tal como lo eligió la persona**, igual que
 * `validarArchivo` del panel: si se midiera después del saneado, una foto de
 * 5 MB pasaría por poco y el tope dejaría de significar lo que DEC-7b decidió —
 * «menos que una foto de celular sin recortar».
 */
export const MAXIMO_BYTES = 3 * 1024 * 1024;

/** Los dos tipos que este pipeline sabe abrir. Los mismos que `TIPOS_SUBIBLES`. */
export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png'];

/**
 * Lo que `sharp` tiene que reconocer **adentro** del archivo. No es lo mismo que
 * `TIPOS_ACEPTADOS`: ése es el tipo **declarado**, que lo pone quien manda el
 * pedido y por lo tanto no se puede creer (es la misma lección que
 * `esDelTipoDeclarado` en el panel — un WebP renombrado `.jpg` engañaba a las
 * tres capas porque las tres miraban el mismo dato).
 */
export const FORMATOS_DE_ENTRADA = ['jpeg', 'png'];

/** Extensión del objeto según el formato que produjo el saneado. */
const EXTENSION = { jpeg: 'jpg', png: 'png' };

/**
 * La forma del nombre del objeto. **Es el mismo alfabeto que tenía
 * `storage.rules`**, y se mudó acá con B-896: la regla dejó de tener un cliente
 * al que chequearle la forma —`create` está en `false`—, así que el único que
 * decide el nombre es esta callable. Lo ata `tests/propuestas-imagen.test.ts`,
 * que además verifica que siga siendo más angosto que el `matches` de
 * `firestore.rules` (que acepta `jpeg` y `webp`).
 */
export const NOMBRE_DE_FLYER = /^prop_[A-Za-z0-9_-]+[.](jpg|png)$/;

/**
 * **El límite de tamaño del request de la callable** — la segunda cosa que
 * B-896 pedía medir, y está medida en `tests/flyer-por-callable.test.ts`.
 *
 * Una imagen de 3 MB viaja en base64 y **crece un tercio**: 3.145.728 bytes dan
 * exactamente 4.194.304 caracteres, y el cuerpo JSON entero del protocolo de
 * callables (`{"data":{"contentType":…,"datos":…}}`) mide **4.194.352 bytes =
 * 4,00 MiB** (medido, no estimado).
 *
 * El número de acá es el **más chico de los dos límites que documenta Google**
 * —10 MB para una función HTTP de 1ª gen; 32 MiB para una de 2ª, que es lo que
 * despliega este proyecto— a propósito: si el tope entra contra el límite
 * estricto, entra contra los dos, y no depende de que nadie se acuerde de qué
 * generación es esta Function el día que se mude. Margen real: **2,5×**.
 */
export const LIMITE_REQUEST_CALLABLE = 10 * 1024 * 1024;

/** Cuánto ocupa en base64 un blob de N bytes (sin contar el envoltorio JSON). */
export const bytesEnBase64 = (n) => Math.ceil(n / 3) * 4;

/**
 * Cuántos bytes hay adentro de una cadena base64, **sin decodificarla**.
 *
 * Se mide así y no sobre el Buffer decodificado porque el rechazo por tamaño
 * tiene que ocurrir **antes** de reservar la memoria: decodificar para después
 * decir «es muy grande» es hacer el trabajo que el límite existe para evitar.
 */
export const bytesDeBase64 = (s = '') => {
  const relleno = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  return Math.max(0, (s.length / 4) * 3 - relleno);
};

/**
 * `7654321` → `7,3 MB`. Coma decimal, que es como se escribe en español.
 *
 * ⚠️ **Es una copia de `enBytesLegibles` de `src/lib/imagenes-archivo.ts`, y la
 * copia está declarada.** No se puede compartir por alias como las dos tablas de
 * bloques: aquel archivo es TypeScript y arrastra medio módulo de imágenes del
 * panel, mientras que esto son seis líneas de formato. Lo que sí se ata es la
 * salida: `tests/flyer-por-callable.test.ts` corre las dos contra la misma tabla
 * de tamaños y falla si se separan. El dato que de verdad no puede tener dos
 * valores —`MAXIMO_BYTES`— está atado leyendo los fuentes.
 */
export const enBytesLegibles = (bytes) => {
  if (bytes < 1024) return `${bytes} bytes`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  const redondeado = Math.round(mb * 10) / 10;
  return `${String(redondeado).replace('.', ',')} MB`;
};

/**
 * Un rechazo con un motivo que se le puede mostrar a una persona, y con el
 * código de error de callable que le corresponde.
 *
 * Es una clase y no un string por lo mismo que `ImagenRechazada` en el panel:
 * el pegamento tiene que poder distinguir «el archivo no sirve y ya sabemos por
 * qué» —que se dice tal cual— de «se rompió algo», que no se le cuenta a nadie.
 */
export class FlyerRechazado extends Error {
  constructor(codigo, causa, mensaje) {
    super(mensaje);
    this.name = 'FlyerRechazado';
    /** El código de error del protocolo de callables: `invalid-argument` | `failed-precondition`. */
    this.codigo = codigo;
    /**
     * Para la analítica del cliente: enum cerrado, nunca el nombre del archivo
     * (§9). **Viaja en el `details` del `HttpsError`** porque el que mide es el
     * navegador y el que sabe por qué rechazó es esta Function; sin esto el
     * cliente tendría que adivinar la causa desde el texto del mensaje, que es
     * exactamente la clase de acople que este repo no deja pasar.
     *
     * El vocabulario lo define `MOTIVOS_IMAGEN` (`src/lib/analytics-eventos.ts`)
     * y no se puede importar desde acá —es TypeScript del panel—, así que lo ata
     * `tests/flyer-por-callable.test.ts`: las causas que esta Function emite
     * tienen que estar todas en esa lista. Es la lección de B-88: un motivo que
     * el vocabulario no conoce llega a GA4 como `otro` y nadie se entera.
     */
    this.causa = causa;
  }
}

/** Las causas que esta Function puede emitir. Atadas a `MOTIVOS_IMAGEN` por test. */
export const CAUSAS_DEL_FLYER = ['tipo', 'tamano', 'metadatos'];

/**
 * ¿El pedido tiene forma de pedido? Puro y sin `sharp`: es lo barato, y corre
 * **antes** de decodificar nada.
 *
 * Devuelve `{ bytes }` cuando está bien, o `{ rechazo }` con el mensaje ya
 * redactado. El orden de los chequeos es el mismo que el de `validarArchivo` en
 * el panel, para que la persona lea lo mismo del lado del que venga el rechazo.
 *
 * **El mensaje del tope dice el tamaño real y el máximo**, que es lo que DEC-7b
 * pide y lo que el camino de hoy ya hace: «es muy grande» no le dice a nadie
 * cuánto tiene que recortar.
 */
export const validarPedido = (pedido = {}) => {
  const { contentType, datos } = pedido;

  if (typeof datos !== 'string' || datos.length === 0) {
    return {
      rechazo: new FlyerRechazado('invalid-argument', 'tipo', 'El pedido no trae la imagen.'),
    };
  }
  if (datos.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(datos)) {
    return {
      rechazo: new FlyerRechazado(
        'invalid-argument',
        'tipo',
        'La imagen no llegó entera. Probá de nuevo.',
      ),
    };
  }
  if (!TIPOS_ACEPTADOS.includes(contentType)) {
    return {
      rechazo: new FlyerRechazado(
        'invalid-argument',
        'tipo',
        'Por ahora solo se pueden subir imágenes JPG o PNG. ' +
          (contentType ? `Ese archivo es ${contentType}.` : 'Ese archivo no parece una imagen.'),
      ),
    };
  }

  const bytes = bytesDeBase64(datos);
  if (bytes > MAXIMO_BYTES) {
    return {
      rechazo: new FlyerRechazado(
        'invalid-argument',
        'tamano',
        `La imagen pesa ${enBytesLegibles(bytes)} y el máximo es ` +
          `${enBytesLegibles(MAXIMO_BYTES)}. Una foto de celular sin recortar casi siempre lo ` +
          'pasa: recortala o bajale la calidad y volvé a intentar.',
      ),
    };
  }
  if (bytes === 0) {
    return { rechazo: new FlyerRechazado('invalid-argument', 'tamano', 'El archivo está vacío.') };
  }
  return { bytes };
};

/**
 * **El barrido del §5 sobre una salida binaria, del lado del servidor.**
 *
 * Es el mismo movimiento que `quedanMetadatos` hace en el panel: en vez de
 * confiar en que el pipeline sacó todo, **se mira el resultado**. Y las dos
 * mitades son las mismas que usa `optimizarImagen` para decidir si un original
 * trae metadatos, con las mismas tablas compartidas:
 *
 *  - `traeMetadatos` — lo que `sharp` sí reporta (EXIF, XMP, IPTC, comentarios).
 *    El perfil **ICC** no cuenta, misma decisión declarada de siempre (D-620).
 *  - `estructuraConocida` — lo que `sharp` **no** reporta: una cola pegada
 *    después del EOI (la imagen secundaria MPF de un Samsung, con su propio GPS),
 *    un APPn que la lista blanca no reconozca, un chunk PNG de texto.
 *
 * **Falla cerrado**, igual que las dos capas que copia: una foto que hoy no se
 * puede mandar es un problema de una tarde; una foto con las coordenadas de una
 * casa particular guardada en el bucket no se despublica.
 */
export const salidaLimpia = async (bytes) => {
  const meta = await sharp(bytes, { failOn: 'none' }).metadata();
  return !traeMetadatos(meta) && estructuraConocida(bytes, meta.format);
};

/**
 * Sanea el flyer y devuelve los bytes que se van a escribir.
 *
 * Los tres pasos, y cada uno es una capa que el cliente no puede saltear:
 *
 * 1. **Qué es el archivo por dentro.** Lo dice `sharp`, no el `contentType` que
 *    mandó quien pide: un WebP o un HEIC renombrado `.jpg` se rechaza acá. Es el
 *    `esDelTipoDeclarado` del panel hecho del lado bueno del cable.
 * 2. **El saneado.** Se reusa `optimizar()` —el pipeline de píxeles de DEC-7d,
 *    B-220— que es el saneador **que este repo ya tiene del lado del servidor**:
 *    `sharp` descarta todos los metadatos por defecto, `.rotate()` aplica la
 *    orientación **antes** de tirar el EXIF (si no, la foto sacada de costado se
 *    publica girada) y `.keepIccProfile()` conserva el perfil de color.
 *
 *    Que recomprima —en vez del recorrido quirúrgico de `sinMetadatos`, que es
 *    lo que hace el panel— es estrictamente más fuerte para lo que importa acá:
 *    lo que sale son bytes que produjo `sharp`, no bytes que venían con bloques
 *    que decidimos conservar.
 *
 *    El precio, dicho: `optimizar()` produce también la miniatura de 480 px, que
 *    acá se descarta. Es un encode de más por flyer y no vale reescribir el
 *    pipeline para ahorrarlo — un flyer por propuesta, y la alternativa es una
 *    segunda idea de «cómo se sanea una imagen en el servidor» (clase de B-88).
 * 3. **El barrido sobre la salida** (`salidaLimpia`).
 *
 * @returns `{ datos, contentType, formato, formatoOriginal, bytesAntes, bytesDespues }`
 */
export const sanearFlyer = async (bytes) => {
  let formatoOriginal;
  try {
    formatoOriginal = (await sharp(bytes, { failOn: 'none' }).metadata()).format;
  } catch {
    formatoOriginal = null;
  }
  if (!FORMATOS_DE_ENTRADA.includes(formatoOriginal)) {
    throw new FlyerRechazado(
      'invalid-argument',
      'tipo',
      'Ese archivo tiene nombre de imagen pero adentro es otra cosa, así que no le ' +
        'podemos sacar los datos ocultos. Abrila y volvé a exportarla como JPG o PNG.',
    );
  }

  const salida = await optimizar(bytes);
  const datos = salida.principal.datos;

  if (!(await salidaLimpia(datos))) {
    throw new FlyerRechazado(
      'failed-precondition',
      'metadatos',
      'Esta foto tiene adentro un bloque de datos ocultos que no supimos sacar, así ' +
        'que no la guardamos: esos bloques pueden llevar la ubicación donde se sacó. ' +
        'Volvé a guardarla o exportarla desde un editor de fotos y probá de nuevo; si ' +
        'vuelve a pasar, avisanos así lo revisamos.',
    );
  }

  return {
    datos,
    contentType: salida.principal.contentType,
    formato: salida.principal.formato,
    formatoOriginal,
    bytesAntes: bytes.length,
    bytesDespues: datos.length,
  };
};

/** `prop_<uuid>`. Mismo patrón que `nuevaImagenPropuestaId()` del cliente. */
export const nuevoIdDeFlyer = () => `prop_${crypto.randomUUID()}`;

/**
 * Dónde queda el objeto. **El id lo genera el servidor, no el cliente**, y esa
 * es una diferencia con el camino viejo que conviene tener escrita: antes el
 * nombre lo elegía el navegador y `storage.rules` le chequeaba la forma; ahora
 * el nombre no llega del otro lado del cable, así que no hay forma que chequear
 * — un cliente no puede ni siquiera intentar pisar el objeto de otro.
 *
 * **La extensión sale del formato de SALIDA**, no del declarado: `optimizar()`
 * pasa un PNG opaco a JPEG, y un `.png` con bytes de JPEG adentro sería un path
 * que miente.
 */
export const rutaDeFlyer = (id, formato) => `${PREFIJO_PROPUESTAS}${id}.${EXTENSION[formato]}`;

/**
 * Los `customMetadata` del objeto que escribe la callable.
 *
 * Dos cosas, y las dos importan:
 *
 *  - **`firebaseStorageDownloadTokens`, puesto a mano.** El camino viejo subía
 *    con el SDK del navegador, que acuña el token solo; el Admin SDK **no**. Sin
 *    esto, `urlDeImagenDePropuesta()` —lo que la bandeja usa para que el admin
 *    mire el flyer antes de decidir— se queda sin URL, y el modo de falla sería
 *    «la foto no se ve» sin ninguna pista de por qué.
 *  - **NO se escribe `optimizada`**, que es la marca anti-recursión de B-220, y
 *    la ausencia es deliberada (trampa 12). `propuestas/` está fuera del prefijo
 *    de `optimizarImagen`, así que la marca no haría falta hoy; ponerla sería
 *    cargar el objeto con un «ya pasó por el pipeline de la galería» que viajaría
 *    con él si algún día se lo copiara a `imagenes/` en vez de re-subirlo — y ahí
 *    sí se saltearía el trigger. `saneada` dice lo que de verdad pasó y ninguna
 *    guarda la mira. Lo fija `tests/flyer-por-callable.test.ts`.
 */
export const VERSION_SANEADO = '1';

/**
 * @param {{ token?: string | null, version?: string }} _
 * @returns {Record<string, string>}
 */
export const metadatosDelFlyer = ({ token = null, version = VERSION_SANEADO } = {}) => ({
  saneada: version,
  ...(token ? { firebaseStorageDownloadTokens: token } : {}),
});
