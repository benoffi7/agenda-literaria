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
 */

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

export interface CoordenadasError {
  ok: false;
  error: string;
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

/** Links cortos y de app: redirigen, y el redirect no se puede seguir por CORS. */
const RE_CORTO = /(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i;

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
    return { ok: false, error: 'No pude leer las coordenadas.' };
  }
  // Fuera de rango no es un punto del planeta: confundir lat con lng manda el
  // evento al otro lado del mundo, y una latitud de 200 no existe.
  if (Math.abs(lat) > 90) {
    return { ok: false, error: `La latitud tiene que estar entre -90 y 90, y llegó ${lat}.` };
  }
  if (Math.abs(lng) > 180) {
    return { ok: false, error: `La longitud tiene que estar entre -180 y 180, y llegó ${lng}.` };
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
    return { ok: false, error: 'Pegá el link de Google Maps del lugar, o un par "lat, lng".' };
  }

  const par = RE_PAR.exec(texto);
  if (par) return validar(Number(par[1]), Number(par[2]));

  if (!pareceLink(texto)) {
    return {
      ok: false,
      error:
        'No parece un link de Google Maps ni un par de coordenadas. Buscá el lugar en Maps, copiá el link de la barra de direcciones y pegalo acá.',
    };
  }

  if (RE_CORTO.test(texto)) {
    return {
      ok: false,
      error:
        'Ese es un link corto (el del botón "Compartir") y no trae las coordenadas: hay que abrirlo primero. Abrilo en el navegador y pegá el link largo que queda en la barra de direcciones.',
    };
  }

  const url = decodificar(texto);
  const encontrado = RE_PARAM.exec(url) ?? RE_DATA.exec(url) ?? RE_AT.exec(url);
  if (encontrado) return validar(Number(encontrado[1]), Number(encontrado[2]));

  return {
    ok: false,
    error:
      'Ese link no trae coordenadas. En Google Maps hacé clic derecho sobre el punto exacto → la primera opción copia "lat, lng", y eso se puede pegar acá.',
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
