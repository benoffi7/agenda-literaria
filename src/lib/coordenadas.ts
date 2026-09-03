/**
 * Coordenadas de la sede (`sede.geo` del §3.1) a partir de lo que pega quien
 * carga: un link de Google Maps, o un par "lat, lng".
 *
 * Por qué así y no geocoding: resolver una dirección a coordenadas es una API
 * paga, con otra key, y el proyecto tiene un budget de USD 5/mes. Lo natural
 * igual es que la persona ya tenga el lugar abierto en Maps, así que alcanza
 * con leer el link. Módulo puro, sin red (docs/05-patrones.md).
 *
 * Los links cortos (`maps.app.goo.gl`) **no** se pueden resolver: son un
 * redirect y desde el navegador lo bloquea CORS. Se detectan y se explican en
 * lugar de fallar en silencio.
 *
 * Cada fallo sale además con su `motivo`, del vocabulario cerrado de la
 * analítica (B-55). Vive **acá adentro y no en el componente** por la lección de
 * B-88 y de `MOTIVOS_IMAGEN`: el productor y el consumidor del vocabulario tienen
 * que ser el mismo. Clasificar el fallo mirando el texto del mensaje desde el
 * componente es la variante silenciosa del mismo bug — el día que se mejore una
 * redacción, el evento empieza a llegar como otra cosa y nada falla.
 */
import { FALLOS_COORDENADAS } from '@/lib/analytics-eventos';

export interface Geo {
  lat: number;
  lng: number;
}

export interface CoordenadasOk {
  ok: true;
  geo: Geo;
  /**
   * Aviso no bloqueante. El punto se guarda igual: el rango es válido pero cae
   * lejos del país, que casi siempre es un typo o un lat/lng al revés.
   */
  advertencia: string | null;
}

/**
 * Por qué falló, para la analítica. Es una etiqueta de la causa: **nunca** el
 * link pegado ni el mensaje, que son contenido (§9).
 *
 * `coordenadas-fallo` contesta una pregunta con consecuencia directa: si el 80 %
 * de los fallos es `coord-link-corto`, lo que hay que hacer es resolver los
 * links cortos y no explicar mejor el campo (B-45).
 */
export type FalloCoordenadas = (typeof FALLOS_COORDENADAS)[number];

export interface CoordenadasError {
  ok: false;
  error: string;
  motivo: FalloCoordenadas;
}

export type ResultadoCoordenadas = CoordenadasOk | CoordenadasError;

/**
 * Caja aproximada de Argentina continental. No es para validar —es para
 * avisar—: un punto afuera es legal, pero el caso normal es un error de tipeo.
 */
export const LIMITES_ARGENTINA = {
  latMin: -55,
  latMax: -21,
  lngMin: -74,
  lngMax: -53,
} as const;

/** 6 decimales son ~11 cm: más precisión que eso es ruido del link. */
const DECIMALES = 6;

const NUM = String.raw`-?\d{1,3}(?:\.\d+)?`;

/** Par pegado a mano: "-34.5989, -58.4392", con o sin paréntesis. */
const RE_PAR = new RegExp(String.raw`^\(?\s*(${NUM})\s*(?:,|;|\s)\s*(${NUM})\s*\)?$`);

/**
 * Par con **coma decimal** en lugar de punto: "-34,5989, -58,4392". Es lo que
 * copia un Windows o un Android configurado en español.
 *
 * **Exige la coma pegada a un dígito en los dos números**, y eso es lo que lo
 * mantiene disjunto de `RE_PAR`: para que `RE_PAR` matchee el string entero, la
 * única coma posible es la del separador —sus números no llevan coma adentro—,
 * así que un string que matchee los dos tendría que tener dos comas-con-dígito y
 * una sola coma a la vez. Un par de enteros legítimo ("-34, -58") no lo matchea,
 * y por eso el orden entre los dos es defensivo y no la garantía. La garantía es
 * el regex, y `tests/coordenadas.test.ts` la fija: un regex más flojo —
 * `-?\d{1,3},\s*-?\d{1,3}`— se comería ese par y lo volvería un fallo.
 */
const RE_COMA_DECIMAL = /^\(?\s*(-?\d{1,3},\d+)\s*[,;]?\s*(-?\d{1,3},\d+)\s*\)?$/;

/**
 * Las tres formas cortas que Google publica, **host y comienzo de camino**, en
 * un solo lugar del que se derivan el reconocedor y la lista blanca.
 *
 * El camino es parte de la forma y no un adorno: `goo.gl` y `g.co` son
 * acortadores **genéricos**, así que `goo.gl/loquesea` va a cualquier lado del
 * planeta. Lo que identifica un link de mapas es `goo.gl/maps/…`, no `goo.gl`.
 * Por eso no hay una lista de hosts escrita aparte: el `auditor-privacidad`
 * mostró que dos derivaciones de «esto es un link corto» —un regex de texto para
 * diagnosticar y una lista de hosts para habilitar— **no coinciden**, y que por
 * la grieta pasaba `https://goo.gl/XYZ#maps.app.goo.gl`. Es la clase de B-88 en
 * su forma más cara: la copia laxa decide qué se ofrece abrir.
 */
const FORMAS_CORTAS = ['maps.app.goo.gl', 'goo.gl/maps', 'g.co/kgs'] as const;

const ALTERNATIVA_CORTA = FORMAS_CORTAS.map((f) => f.replace(/\./g, String.raw`\.`)).join('|');

/** ¿`host/camino` es una de las formas cortas? Se aplica a la URL ya normalizada. */
const RE_CORTO = new RegExp(String.raw`^(?:${ALTERNATIVA_CORTA})(?:/|$)`, 'i');

/**
 * La URL corta **adentro** del texto pegado.
 *
 * No se exige que el texto entero sea la URL, y eso es el caso normal y no el
 * raro: la hoja de «Compartir» de Maps en el teléfono copia el **nombre del
 * lugar y después el link**, que es exactamente el escenario que hizo existir a
 * B-45. Exigir el texto completo dejaba sin botón justo a ese pegado, mientras
 * el mensaje de error nombraba el botón.
 *
 * `[^\s"'<>]+` corta en el primer espacio o salto de línea, así que el texto que
 * sobra alrededor no termina metido adentro del camino — que era la otra mitad
 * del mismo hallazgo: `…/aBc - el lugar` abría `…/aBc%20-%20el%20lugar`, un 404
 * que no es el link que la persona quiso abrir.
 */
const RE_CORTO_EN_TEXTO = new RegExp(
  String.raw`(?:https?://)?(?:${ALTERNATIVA_CORTA})/[^\s"'<>]+`,
  'i',
);

/**
 * Los hosts habilitados. Es una lista blanca de **host exacto** y no un
 * `includes` sobre el texto: `maps.app.goo.gl.ejemplo.com` es un host ajeno que
 * contiene el nuestro, y ofrecer abrirlo sería prestarle nuestra pantalla a un
 * link de cualquier lado. Se deriva de `FORMAS_CORTAS` para que agregar una
 * forma no deje la lista atrás.
 */
const HOSTS_CORTOS = new Set(FORMAS_CORTAS.map((f) => f.split('/')[0]!));

/**
 * El link corto pegado, saneado y listo para abrirlo en otra pestaña — o `null`
 * si lo que hay no es uno.
 *
 * ── B-45 · por qué esto y no resolver el redirect ─────────────────────────
 * Seguir el redirect **desde el navegador no se puede**, y no es que falle a
 * veces: en modo `cors` el host no manda `Access-Control-Allow-Origin` y el
 * `fetch` tira antes de ver el redirect; con `redirect: 'manual'` la respuesta
 * es un *opaque redirect* y el `Location` no se puede leer; en `no-cors` la
 * respuesta es opaca y `response.url` viene vacío. La única salida que funciona
 * es una Function que siga el redirect, y su costo no es «otro endpoint»: es un
 * fetcher de URLs arbitrarias, o sea superficie de SSRF, con lista blanca de
 * hosts, tope de saltos, timeout y sin devolver el body. Eso es diseño de
 * seguridad y está anotado como lo que queda de B-45.
 *
 * Lo que **sí** se puede hacer sin nada de eso es que el navegador siga el
 * redirect como sigue cualquier link: abriéndolo. Eso ya era lo que el mensaje
 * pedía a mano («abrilo y pegá el link largo»), y acá pasa a ser un toque en vez
 * de copiar, cambiar de pestaña, pegar y volver — que es justo el caso del
 * teléfono, donde el botón «Compartir» de Maps entrega este link y no otro.
 *
 * **El esquema se fuerza a `https` y no se conserva el pegado.** Lo que hay en
 * el campo es texto de un portapapeles, así que puede venir sin esquema
 * (`maps.app.goo.gl/abc`) o con uno hostil (`javascript:…`): quedarse con el que
 * traiga sería poner un `href` arbitrario en la pantalla del panel.
 *
 * **Y esta función es también el reconocedor**: `parsearCoordenadas` decide por
 * ella si el mensaje habla de un link corto. Una sola derivación, así que el
 * mensaje no puede volver a nombrar un botón que no está.
 */
export const linkCortoParaAbrir = (entrada: string): string | null => {
  const encontrado = RE_CORTO_EN_TEXTO.exec((entrada ?? '').trim());
  if (!encontrado) return null;
  const sinEsquema = encontrado[0].replace(/^https?:\/\//i, '');
  let url: URL;
  try {
    url = new URL(`https://${sinEsquema}`);
  } catch {
    return null;
  }
  /*
   * No hace falta un chequeo de credenciales, y vale decir por qué en vez de
   * dejar un `if` que no puede fallar: un `usuario:clave@` vive **entre** el
   * esquema y el host, y la extracción de arriba arranca *en* el host (con a lo
   * sumo un `https://` pegado justo antes), así que nunca queda adentro de lo
   * que se sanea. `https://usuario:clave@maps.app.goo.gl/x` no devuelve `null`:
   * devuelve el link limpio, sin las credenciales, que es mejor. Y
   * `https://maps.app.goo.gl@otro.sitio/x` no matchea —después del host viene un
   * `@` y no un `/`—, así que sigue dando `null`.
   */
  if (!HOSTS_CORTOS.has(url.hostname.toLowerCase())) return null;
  // El host solo no alcanza: se vuelve a verificar la forma completa sobre la
  // URL **ya normalizada** por el parser, que es donde `hostname` y `pathname`
  // significan lo que parecen y no lo que un `#` o un `?` hagan parecer.
  if (!RE_CORTO.test(`${url.hostname}${url.pathname}`)) return null;
  return url.toString();
};

/** `?q=lat,lng`, `?query=lat,lng`, `?ll=`, `?destination=`, `?q=loc:lat,lng`. */
const RE_PARAM = new RegExp(
  String.raw`[?&](?:q|query|ll|center|daddr|destination|sll)=(?:loc:)?(${NUM})\s*,\s*(${NUM})(?:[&#]|$)`,
  'i',
);

/**
 * `!3d<lat>!4d<lng>` del blob `data=` de un link de lugar. Es el punto del
 * lugar; el `@` de la URL es el centro de la cámara, que puede estar corrido.
 * Por eso este tiene prioridad.
 */
const RE_DATA = new RegExp(String.raw`!3d(${NUM})!4d(${NUM})`);

/** `/maps/@lat,lng,17z` y `/maps/place/Nombre/@lat,lng,17z`. */
const RE_AT = new RegExp(String.raw`@(${NUM}),(${NUM})`);

const pareceLink = (t: string) =>
  /^[a-z]+:\/\//i.test(t) || /google\.[a-z.]+|goo\.gl|\/maps|maps\./i.test(t);

const decodificar = (t: string) => {
  try {
    return decodeURIComponent(t);
  } catch {
    // Un `%` suelto rompe decodeURIComponent. Se sigue con el texto crudo.
    return t;
  }
};

const redondear = (n: number) => Number(n.toFixed(DECIMALES));

const dentroDeArgentina = (lat: number, lng: number) =>
  lat >= LIMITES_ARGENTINA.latMin &&
  lat <= LIMITES_ARGENTINA.latMax &&
  lng >= LIMITES_ARGENTINA.lngMin &&
  lng <= LIMITES_ARGENTINA.lngMax;

const advertir = (lat: number, lng: number): string | null => {
  if (dentroDeArgentina(lat, lng)) return null;
  // Si dadas vuelta caen dentro del país, es lo que pasó el 99% de las veces.
  if (dentroDeArgentina(lng, lat)) {
    return 'Ese punto cae fuera de Argentina, pero invirtiendo los valores caería dentro: revisá el orden, primero va la latitud.';
  }
  return 'Ese punto cae lejos de Argentina. Se guarda igual, pero verificá que sea el lugar correcto.';
};

const validar = (lat: number, lng: number): ResultadoCoordenadas => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: 'No pude leer las coordenadas.', motivo: 'coord-formato' };
  }
  // Fuera de rango no es un punto del planeta: confundir lat con lng manda el
  // evento al otro lado del mundo, y una latitud de 200 no existe.
  if (Math.abs(lat) > 90) {
    return {
      ok: false,
      error: `La latitud tiene que estar entre -90 y 90, y llegó ${lat}.`,
      motivo: 'coord-formato',
    };
  }
  if (Math.abs(lng) > 180) {
    return {
      ok: false,
      error: `La longitud tiene que estar entre -180 y 180, y llegó ${lng}.`,
      motivo: 'coord-formato',
    };
  }
  const geo = { lat: redondear(lat), lng: redondear(lng) };
  return { ok: true, geo, advertencia: advertir(geo.lat, geo.lng) };
};

/**
 * Formas soportadas:
 *
 * - par pegado a mano: `-34.5989, -58.4392`
 * - `.../maps/place/Nombre/@-34.59,-58.43,17z/data=...!3d-34.59!4d-58.43`
 * - `.../maps/@-34.59,-58.43,17z`
 * - `.../maps/search/?api=1&query=-34.59,-58.43` (y `q=`, `ll=`, `destination=`)
 *
 * Todo lo demás falla con un mensaje que dice qué hacer. Nunca en silencio.
 */
export const parsearCoordenadas = (entrada: string): ResultadoCoordenadas => {
  const texto = (entrada ?? '').trim();
  if (!texto) {
    return {
      ok: false,
      error: 'Pegá el link de Google Maps del lugar, o un par "lat, lng".',
      // El campo vacío no es un fallo de nadie, y el componente ni llega acá:
      // corta antes. Lleva motivo igual porque el tipo lo exige, y que no se
      // emita es lo correcto (ver `CoordenadasSede`).
      motivo: 'coord-formato',
    };
  }

  const par = RE_PAR.exec(texto);
  if (par) return validar(Number(par[1]), Number(par[2]));

  if (RE_COMA_DECIMAL.test(texto)) {
    /*
     * B-55 — la coma decimal de la configuración regional en español. Ya se
     * rechazaba, pero caía en «no parece un link ni un par de coordenadas», que
     * es falso y no dice qué corregir: el par **está**, con el separador de otro
     * idioma. No se adivina a propósito —"-34,5989 -58,4392" podría ser dos
     * números o cuatro, y equivocarse manda el evento a otro lado del planeta—,
     * así que se nombra y se pide el punto.
     */
    return {
      ok: false,
      error:
        'Eso parece un par de coordenadas con coma decimal ("-34,5989"), y así es ambiguo: no se sabe si son dos números o cuatro. Escribilo con punto: -34.5989, -58.4392.',
      motivo: 'coord-coma-decimal',
    };
  }

  if (!pareceLink(texto)) {
    return {
      ok: false,
      error:
        'No parece un link de Google Maps ni un par de coordenadas. Buscá el lugar en Maps, copiá el link de la barra de direcciones y pegalo acá.',
      motivo: 'coord-formato',
    };
  }

  // El mismo reconocedor que arma el botón, y no un regex propio: el mensaje
  // nombra el botón, así que si el mensaje puede aparecer sin él, miente. Ver
  // `linkCortoParaAbrir`.
  if (linkCortoParaAbrir(texto)) {
    return {
      ok: false,
      error:
        'Ese es un link corto (el del botón "Compartir") y no trae las coordenadas: hay que abrirlo primero. Tocá "Abrir el link" y, en la pestaña que se abre, copiá el link largo de la barra de direcciones.',
      motivo: 'coord-link-corto',
    };
  }

  const url = decodificar(texto);
  const encontrado = RE_PARAM.exec(url) ?? RE_DATA.exec(url) ?? RE_AT.exec(url);
  if (encontrado) return validar(Number(encontrado[1]), Number(encontrado[2]));

  return {
    ok: false,
    error:
      'Ese link no trae coordenadas. En Google Maps hacé clic derecho sobre el punto exacto → la primera opción copia "lat, lng", y eso se puede pegar acá.',
    motivo: 'coord-sin-coordenadas',
  };
};

/** Para mostrar la coordenada cargada. */
export const formatearGeo = (geo: Geo) => `${geo.lat}, ${geo.lng}`;

/**
 * Link idéntico al que `construirLinkMapa` de `functions/calendario.js` va a
 * poner en el evento (§7.4, D-10) — sin espacio en la coma, como lo arma la
 * Function. Lo que se verifica desde el formulario es exactamente lo que va a
 * ver la gente.
 */
export const linkMapa = (geo: Geo) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${geo.lat},${geo.lng}`)}`;
