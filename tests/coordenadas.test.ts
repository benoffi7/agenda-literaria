import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FALLOS_COORDENADAS } from '@/lib/analytics-eventos';
import {
  formatearGeo,
  linkCortoParaAbrir,
  linkMapa,
  parsearCoordenadas,
} from '@/lib/coordenadas';

/** Atajo: en los casos felices solo interesa el punto. */
const geoDe = (entrada: string) => {
  const r = parsearCoordenadas(entrada);
  if (!r.ok) throw new Error(`esperaba coordenadas y falló: ${r.error}`);
  return r.geo;
};

describe('parsearCoordenadas — par pegado a mano', () => {
  it('lee el par que copia el clic derecho de Google Maps', () => {
    expect(geoDe('-34.5989, -58.4392')).toEqual({ lat: -34.5989, lng: -58.4392 });
  });

  it('tolera sin espacio, con espacio como separador y con paréntesis', () => {
    const esperado = { lat: -34.5989, lng: -58.4392 };
    expect(geoDe('-34.5989,-58.4392')).toEqual(esperado);
    expect(geoDe('-34.5989 -58.4392')).toEqual(esperado);
    expect(geoDe('(-34.5989, -58.4392)')).toEqual(esperado);
    expect(geoDe('  -34.5989 , -58.4392  ')).toEqual(esperado);
  });

  it('redondea a 6 decimales: más precisión que eso es ruido', () => {
    expect(geoDe('-34.59891234567, -58.43924567891')).toEqual({
      lat: -34.598912,
      lng: -58.439246,
    });
  });
});

describe('parsearCoordenadas — links de Google Maps soportados', () => {
  it('link de lugar: usa el punto del lugar (!3d/!4d), no el centro de la cámara (@)', () => {
    const url =
      'https://www.google.com/maps/place/Casa+Brandon/@-34.5980,-58.4380,17z/data=!3m1!4b1!4m6!3m5!1s0x95bccb1234:0xabc!8m2!3d-34.5989!4d-58.4392!16s%2Fg%2F11abc?entry=ttu';
    expect(geoDe(url)).toEqual({ lat: -34.5989, lng: -58.4392 });
  });

  it('link de mapa sin lugar: /maps/@lat,lng,zoom', () => {
    expect(geoDe('https://www.google.com/maps/@-34.6037,-58.3816,15z')).toEqual({
      lat: -34.6037,
      lng: -58.3816,
    });
  });

  it('link de búsqueda con api=1&query=lat,lng — el mismo que arma la Function', () => {
    expect(geoDe('https://www.google.com/maps/search/?api=1&query=-34.6037,-58.3816')).toEqual({
      lat: -34.6037,
      lng: -58.3816,
    });
  });

  it('lee la coma URL-encodeada del parámetro', () => {
    expect(geoDe('https://www.google.com/maps/search/?api=1&query=-34.6037%2C-58.3816')).toEqual({
      lat: -34.6037,
      lng: -58.3816,
    });
  });

  it('?q=lat,lng y ?q=loc:lat,lng', () => {
    expect(geoDe('https://maps.google.com/?q=-34.6037,-58.3816')).toEqual({
      lat: -34.6037,
      lng: -58.3816,
    });
    expect(geoDe('https://maps.google.com/maps?q=loc:-34.6037,-58.3816&z=17')).toEqual({
      lat: -34.6037,
      lng: -58.3816,
    });
  });

  it('el link con @ pero sin data= también sirve', () => {
    expect(geoDe('https://www.google.com/maps/place/Drago+236/@-34.5989,-58.4392,19z')).toEqual({
      lat: -34.5989,
      lng: -58.4392,
    });
  });
});

describe('parsearCoordenadas — lo que NO se soporta falla visible', () => {
  it('link corto: no se puede seguir el redirect por CORS, y se dice cómo salir', () => {
    const r = parsearCoordenadas('https://maps.app.goo.gl/aBcDeF123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/link corto/i);
  });

  it('link corto viejo goo.gl/maps', () => {
    const r = parsearCoordenadas('https://goo.gl/maps/aBcDeF123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/link corto/i);
  });

  it('el mensaje del link corto nombra el botón que lo resuelve (B-45)', () => {
    // Sin esto, el mensaje puede volver a pedir "abrilo en el navegador" a mano
    // mientras el botón ya está en pantalla: la instrucción y la salida real se
    // separan y nada falla.
    const r = parsearCoordenadas('https://maps.app.goo.gl/aBcDeF123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Abrir el link');
  });

  it('link de Maps sin coordenadas: solo el nombre del lugar', () => {
    const r = parsearCoordenadas(
      'https://www.google.com/maps/place/Librer%C3%ADa+Not%C3%A1n/data=!4m2!3m1!1s0x95bccb1234',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no trae coordenadas/i);
  });

  it('texto cualquiera: no es link ni par', () => {
    const r = parsearCoordenadas('Casa Brandon, Villa Crespo');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no parece un link/i);
  });

  it('un solo número no alcanza', () => {
    expect(parsearCoordenadas('-34.5989').ok).toBe(false);
  });

  it('el string vacío no es un error del usuario, pero tampoco una coordenada', () => {
    expect(parsearCoordenadas('').ok).toBe(false);
    expect(parsearCoordenadas('   ').ok).toBe(false);
    const r = parsearCoordenadas('');
    if (!r.ok) expect(r.error).toMatch(/pegá el link/i);
  });

  it('la coma decimal de la configuración regional es ambigua y no se adivina', () => {
    // "-34,5989 -58,4392" podría ser dos números o cuatro. Se rechaza.
    expect(parsearCoordenadas('-34,5989 -58,4392').ok).toBe(false);
  });
});

describe('parsearCoordenadas — rango', () => {
  it('una latitud de 200 no existe', () => {
    const r = parsearCoordenadas('200, -58.4392');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/latitud/i);
  });

  it('rechaza la latitud apenas pasado 90 y la longitud apenas pasado 180', () => {
    expect(parsearCoordenadas('90.5, 0').ok).toBe(false);
    expect(parsearCoordenadas('0, -180.5').ok).toBe(false);
  });

  it('acepta los bordes exactos del planeta', () => {
    expect(geoDe('90, 180')).toEqual({ lat: 90, lng: 180 });
    expect(geoDe('-90, -180')).toEqual({ lat: -90, lng: -180 });
  });
});

describe('parsearCoordenadas — avisos, que no bloquean', () => {
  it('un punto en Argentina no genera aviso', () => {
    const r = parsearCoordenadas('-34.5989, -58.4392');
    expect(r.ok && r.advertencia).toBe(null);
  });

  it('lat y lng invertidas: se guarda, pero avisa que revise el orden', () => {
    const r = parsearCoordenadas('-58.4392, -34.5989');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.geo).toEqual({ lat: -58.4392, lng: -34.5989 });
      expect(r.advertencia).toMatch(/invirtiendo|orden/i);
    }
  });

  it('un punto lejano avisa sin adivinar la causa', () => {
    const r = parsearCoordenadas('48.8584, 2.2945'); // Torre Eiffel
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.advertencia).toMatch(/lejos de Argentina/i);
  });

  it('(0, 0) es el caso clásico de campo a medio cargar y también avisa', () => {
    const r = parsearCoordenadas('0, 0');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.advertencia).not.toBe(null);
  });

  it('Ushuaia y Jujuy caen dentro del país, sin aviso', () => {
    expect(parsearCoordenadas('-54.8019, -68.3030')).toEqual({
      ok: true,
      geo: { lat: -54.8019, lng: -68.303 },
      advertencia: null,
    });
    expect(parsearCoordenadas('-24.1858, -65.2995')).toEqual({
      ok: true,
      geo: { lat: -24.1858, lng: -65.2995 },
      advertencia: null,
    });
  });
});

describe('formateo y link', () => {
  it('formatearGeo muestra el par tal como se pega en Maps', () => {
    expect(formatearGeo({ lat: -34.5989, lng: -58.4392 })).toBe('-34.5989, -58.4392');
  });

  it('linkMapa arma el mismo link que la Function pone en el evento (D-10)', () => {
    // El formato tiene que coincidir con `construirLinkMapa` de
    // functions/calendario.js, que está fijado en tests/calendario.test.ts:
    // "query=-34.5989%2C-58.4392". Verificar desde el formulario un link
    // distinto al del evento no verificaría nada.
    expect(linkMapa({ lat: -34.5989, lng: -58.4392 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=-34.5989%2C-58.4392',
    );
  });

  it('ida y vuelta: lo que muestra el formulario se puede volver a pegar', () => {
    const geo = { lat: -34.5989, lng: -58.4392 };
    expect(geoDe(formatearGeo(geo))).toEqual(geo);
  });
});


/**
 * B-55 — el `motivo` con el que cada fallo llega a la analítica.
 *
 * ── Por qué el motivo lo pone el módulo puro y no el componente ────────────
 * Es la lección de B-88, la misma por la que `MOTIVOS_IMAGEN` vive en
 * `analytics-eventos.ts` y no en el subidor: el productor y el consumidor del
 * vocabulario tienen que ser el mismo. La alternativa —que `CoordenadasSede`
 * clasifique el fallo mirando el texto del mensaje— es la variante silenciosa
 * del bug: el día que se mejore una redacción, el evento empieza a llegar como
 * otra cosa, nada falla, y el número que decide B-45 queda mal para siempre.
 */
describe('parsearCoordenadas — el motivo de cada fallo (B-55)', () => {
  const motivoDe = (entrada: string) => {
    const r = parsearCoordenadas(entrada);
    if (r.ok) throw new Error(`esperaba un fallo y resolvió: ${JSON.stringify(r.geo)}`);
    return r.motivo;
  };

  it('el link corto se distingue de todo lo demás: es el que decide B-45', () => {
    expect(motivoDe('https://maps.app.goo.gl/aBcDeF123')).toBe('coord-link-corto');
    expect(motivoDe('https://goo.gl/maps/aBcDeF123')).toBe('coord-link-corto');
    expect(motivoDe('https://g.co/kgs/aBcDeF')).toBe('coord-link-corto');
  });

  it('un link de Maps que no trae el punto es su propio modo de fallo', () => {
    // Se arregla distinto que el link corto: acá el link está bien, lo que falta
    // es el punto. Contarlos juntos borraría la diferencia.
    expect(
      motivoDe(
        'https://www.google.com/maps/place/Librer%C3%ADa+Not%C3%A1n/data=!4m2!3m1!1s0x95bccb1234',
      ),
    ).toBe('coord-sin-coordenadas');
  });

  it('la coma decimal tiene motivo propio, y ya no cae en «no parece un link»', () => {
    // Antes de B-55 esto respondía «No parece un link de Google Maps ni un par
    // de coordenadas», que es falso: el par está, con el separador de otro
    // idioma. Se sigue rechazando (es ambiguo), pero se nombra.
    expect(motivoDe('-34,5989 -58,4392')).toBe('coord-coma-decimal');
    expect(motivoDe('-34,5989, -58,4392')).toBe('coord-coma-decimal');
    expect(motivoDe('(-34,5989; -58,4392)')).toBe('coord-coma-decimal');
  });

  it('y el mensaje de la coma decimal dice qué corregir', () => {
    const r = parsearCoordenadas('-34,5989, -58,4392');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/coma decimal/i);
      // Muestra la forma que sí funciona: sin eso, «es ambiguo» no es accionable.
      expect(r.error).toContain('-34.5989, -58.4392');
    }
  });

  it('el par de enteros sigue leyéndose como par, no como coma decimal', () => {
    /*
     * El regex de la coma decimal exige la coma **pegada a un dígito en los dos
     * números**, y eso es lo que lo mantiene disjunto del par: el orden entre
     * los dos es defensivo, no la garantía. Escrito más flojo
     * —`-?\d{1,3},\s*-?\d{1,3}`, que es la primera versión que a uno se le
     * ocurre— se comería «-34, -58» y volvería un fallo un par legítimo.
     */
    const r = parsearCoordenadas('-34, -58');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.geo).toEqual({ lat: -34, lng: -58 });
    // Y con decimales de punto, que es la forma que el campo recomienda.
    const p = parsearCoordenadas('-34.5, -58.4');
    expect(p.ok).toBe(true);
  });

  it('lo demás cae en el formato, incluido el rango imposible', () => {
    expect(motivoDe('Casa Brandon, Villa Crespo')).toBe('coord-formato');
    expect(motivoDe('-34.5989')).toBe('coord-formato');
    expect(motivoDe('200, -58.4392')).toBe('coord-formato');
    expect(motivoDe('0, -180.5')).toBe('coord-formato');
  });

  it('todo motivo que se devuelve está en el vocabulario de la analítica', () => {
    // Un motivo fuera del enum lo reemplaza el sanitizador de `detalle` por
    // `otro`, y ahí los cuatro modos llegan indistinguibles a GA4 — con el
    // agravante de que no rompe nada.
    const entradas = [
      'https://maps.app.goo.gl/x',
      'https://www.google.com/maps/place/X/data=!4m2',
      '-34,5989 -58,4392',
      'cualquier cosa',
      '200, 0',
    ];
    for (const e of entradas) {
      expect(FALLOS_COORDENADAS).toContain(motivoDe(e));
    }
  });

  it('ningún valor del vocabulario quedó sin poder ocurrir', () => {
    // La otra mitad: un `detalle` declarado que ninguna rama produce es un
    // cruce vacío en GA4 que se lee como «no pasa nunca» cuando en realidad
    // nadie lo emite. `coord-coma-decimal` era exactamente eso hasta B-55.
    const alcanzados = new Set(
      [
        'https://maps.app.goo.gl/x',
        'https://www.google.com/maps/place/X/data=!4m2',
        '-34,5989 -58,4392',
        'cualquier cosa',
      ].map(motivoDe),
    );
    expect([...FALLOS_COORDENADAS].filter((f) => !alcanzados.has(f))).toEqual([]);
  });
});

/**
 * B-55 — que el campo **emita** los dos eventos.
 *
 * El vocabulario estaba desde antes y el componente se mergeó después, así que
 * lo que faltaba no era el enum: era la llamada. Se lee el fuente porque el
 * panel no tiene tests de componentes (B-08, `docs/05-patrones.md`).
 */
describe('el campo de coordenadas se mide (B-55)', () => {
  const FUENTE = readFileSync('src/components/admin/CoordenadasSede.tsx', 'utf8');

  it('emite el denominador: un intento, salga o no', () => {
    // Sin `coordenadas-pegar` la pregunta de B-45 no se contesta: «el 80 % de
    // los fallos es un link corto» no dice nada sin el total de intentos.
    expect(FUENTE).toContain("medirFuncion('coordenadas-pegar')");
  });

  it('emite el fallo con el motivo que devuelve el parseo', () => {
    expect(FUENTE).toContain("medirFuncion('coordenadas-fallo', r.motivo)");
  });

  it('no clasifica el fallo por su cuenta', () => {
    // El bug de B-88 con otra cara: deducir el motivo del texto del mensaje.
    // Cualquier literal `coord-*` acá adentro sería una segunda fuente de
    // verdad del vocabulario.
    expect(FUENTE).not.toMatch(/'coord-[a-z-]+'/);
  });

  it('no cuenta dos veces el mismo intento', () => {
    // Pegar aplica y deja el texto en el campo, así que salir del campo vuelve a
    // aplicarlo: son cuatro disparadores sobre el mismo texto. Sin la guarda, un
    // link corto pegado llega como dos o tres fallos y la proporción sale
    // inflada justo en el modo más frecuente.
    expect(FUENTE).toContain('const yaMedido = medido.current === entrada');
    expect(FUENTE).toMatch(/if \(!yaMedido\) medirFuncion\('coordenadas-pegar'\)/);
    expect(FUENTE).toMatch(/if \(!yaMedido\) medirFuncion\('coordenadas-fallo'/);
  });

  it('nunca manda lo pegado, ni el mensaje, ni la coordenada', () => {
    /*
     * El link es contenido: lleva el nombre del lugar **y** la ubicación física
     * de un taller que muchas veces pasa en una casa particular. `detalle` es un
     * enum cerrado de cuatro etiquetas de causa.
     *
     * La lista la amplió el `auditor-privacidad`: la primera versión barría
     * `entrada|texto|pegado` y dejaba afuera los dos candidatos **más a mano**.
     * `r.error` es el hermano de `r.motivo` en el mismo `if (!r.ok)`, y dos de
     * sus ramas **interpolan la coordenada de la persona** («…y llegó -34.5»).
     * Un `medirFuncion('coordenadas-fallo', r.error)` pasaba el test anterior
     * sin chistar.
     *
     * Hoy no filtraría igual —el sanitizador de `detalle` reemplaza por `otro`
     * cualquier cosa fuera del vocabulario, y `valor` es un entero acotado— pero
     * eso es la red del runtime. Lo que este test verifica es el criterio en el
     * productor, que es lo que dice hacer.
     */
    expect(FUENTE).not.toMatch(
      /medirFuncion\([^)]*\b(entrada|texto|pegado|error|geo|lat|lng|clipboardData)\b/,
    );
  });
});

/**
 * B-45 — la salida del link corto.
 *
 * Seguir el redirect desde el navegador **no se puede** (CORS y respuestas
 * opacas: el razonamiento completo está en `linkCortoParaAbrir`), así que lo
 * único que se puede hacer sin una Function que sea un fetcher de URLs
 * arbitrarias es abrirlo. Y abrirlo significa poner un `href` en la pantalla del
 * panel con texto que salió de un portapapeles, así que lo que estos casos fijan
 * no es la comodidad: es que ese `href` no pueda ser cualquier cosa.
 */
describe('linkCortoParaAbrir — el href sale saneado o no sale (B-45)', () => {
  it('devuelve el link corto de la app de Maps, que es el caso del teléfono', () => {
    expect(linkCortoParaAbrir('https://maps.app.goo.gl/aBcDeF123')).toBe(
      'https://maps.app.goo.gl/aBcDeF123',
    );
  });

  it('y las otras dos formas cortas que el campo reconoce', () => {
    expect(linkCortoParaAbrir('https://goo.gl/maps/aBcDeF123')).toBe(
      'https://goo.gl/maps/aBcDeF123',
    );
    expect(linkCortoParaAbrir('https://g.co/kgs/aBcDeF')).toBe('https://g.co/kgs/aBcDeF');
  });

  it('completa el esquema cuando se pegó el link sin él', () => {
    // Copiar desde la app deja a veces el host pelado, y sin esquema el `href`
    // se resolvería relativo a /admin en vez de salir del sitio.
    expect(linkCortoParaAbrir('maps.app.goo.gl/aBcDeF123')).toBe(
      'https://maps.app.goo.gl/aBcDeF123',
    );
  });

  it('fuerza https y no conserva el esquema pegado', () => {
    // `http` degradado no; y esto es lo que impide que un `javascript:` pegado
    // llegue al atributo.
    expect(linkCortoParaAbrir('http://maps.app.goo.gl/aBcDeF123')).toBe(
      'https://maps.app.goo.gl/aBcDeF123',
    );
    expect(linkCortoParaAbrir('javascript:alert(1)//maps.app.goo.gl')).toBeNull();
  });

  /**
   * El hallazgo del `auditor-privacidad`: reconocer con un regex de **texto** y
   * habilitar con una lista de **hosts** son dos derivaciones de la misma idea, y
   * no coincidían. Con la cadena de señuelo en el fragmento o en la query, el
   * panel ofrecía abrir un `goo.gl/<lo que sea>` — que es un acortador genérico y
   * va a cualquier lado.
   *
   * Hoy las dos salen de `FORMAS_CORTAS`, y el chequeo corre sobre la URL ya
   * normalizada: `hostname` y `pathname`, no el texto crudo.
   */
  it('el link que se ofrece abrir es corto por host Y por camino, no por una cadena suelta (B-88)', () => {
    expect(linkCortoParaAbrir('https://goo.gl/XYZ#maps.app.goo.gl')).toBeNull();
    expect(linkCortoParaAbrir('https://goo.gl/phish?x=g.co/kgs')).toBeNull();
    // `goo.gl` y `g.co` sin su camino son acortadores genéricos: el host solo no
    // alcanza para decir que es un mapa.
    expect(linkCortoParaAbrir('https://goo.gl/aBcDeF')).toBeNull();
    expect(linkCortoParaAbrir('https://g.co/aBcDeF')).toBeNull();
  });

  /**
   * El otro lado del mismo hallazgo, y es el caso **normal**: la hoja de
   * «Compartir» de Maps en el teléfono copia el nombre del lugar y después el
   * link. Es el escenario que hizo existir a B-45, y exigir que el texto entero
   * fuera la URL lo dejaba sin botón mientras el mensaje lo nombraba.
   */
  it('el pegado del botón Compartir trae el nombre del lugar antes del link (B-45)', () => {
    expect(linkCortoParaAbrir('Librería Notán\nhttps://maps.app.goo.gl/aBcDeF123')).toBe(
      'https://maps.app.goo.gl/aBcDeF123',
    );
  });

  it('el texto que sobra no se mete en el camino del link que se abre (B-45)', () => {
    // Sin cortar en el espacio, esto abría `…/aBc%20-%20el%20lugar`: un 404 que
    // no es el link que la persona quiso abrir, y sin nada que lo dijera.
    expect(linkCortoParaAbrir('https://maps.app.goo.gl/aBc - el lugar')).toBe(
      'https://maps.app.goo.gl/aBc',
    );
    expect(linkCortoParaAbrir('maps.app.goo.gl/x\nhttps://ejemplo.com')).toBe(
      'https://maps.app.goo.gl/x',
    );
  });

  /**
   * El mensaje y el botón son **la misma decisión**, no dos que hoy coinciden.
   * Sin esto vuelve la grieta: un reconocedor laxo para el texto del error y uno
   * estricto para el `href` dejan un mensaje que manda a tocar un botón que no
   * está.
   */
  it('el mensaje del link corto y el botón salen del mismo reconocedor (B-88)', () => {
    const dicaLinkCorto = (t: string) => {
      const r = parsearCoordenadas(t);
      return !r.ok && r.motivo === 'coord-link-corto';
    };
    for (const t of [
      'https://maps.app.goo.gl/aBcDeF123',
      'Librería Notán\nhttps://maps.app.goo.gl/aBcDeF123',
      'https://goo.gl/XYZ#maps.app.goo.gl',
      'https://goo.gl/aBcDeF',
      'https://www.google.com/maps/@-34.59,-58.43,17z',
    ]) {
      expect(dicaLinkCorto(t), `desalineados sobre «${t}»`).toBe(linkCortoParaAbrir(t) !== null);
    }
  });

  it('un host ajeno que CONTIENE el nuestro no es el nuestro', () => {
    // Es la diferencia entre la lista blanca y un `includes` sobre el texto: el
    // regex de detección mira el texto entero, así que sin el chequeo de host
    // exacto este link se ofrecería para abrir.
    expect(linkCortoParaAbrir('https://maps.app.goo.gl.ejemplo.com/x')).toBeNull();
  });

  it('ni con el host nuestro puesto donde parece el host', () => {
    // `https://maps.app.goo.gl@otro.sitio/` tiene hostname `otro.sitio`: es el
    // truco clásico de leer una URL a ojo. Acá ni siquiera llega al parser —
    // después del host viene un `@` y no un `/`, así que no matchea.
    expect(linkCortoParaAbrir('https://maps.app.goo.gl@otro.sitio/x')).toBeNull();
  });

  it('las credenciales no viajan: se caen con el resto del texto de alrededor', () => {
    // No hay un chequeo de `username`/`password` porque no hace falta: la
    // extracción arranca en el host, así que un `usuario:clave@` queda afuera del
    // match. Sale el link limpio, que es mejor que no salir.
    expect(linkCortoParaAbrir('https://usuario:clave@maps.app.goo.gl/x')).toBe(
      'https://maps.app.goo.gl/x',
    );
  });

  it('lo que no es un link corto no devuelve nada', () => {
    expect(linkCortoParaAbrir('')).toBeNull();
    expect(linkCortoParaAbrir('-34.5989, -58.4392')).toBeNull();
    expect(linkCortoParaAbrir('https://www.google.com/maps/@-34.59,-58.43,17z')).toBeNull();
  });

  it('el componente pone en el href lo saneado y nunca el texto del campo', () => {
    const COMPONENTE = readFileSync('src/components/admin/CoordenadasSede.tsx', 'utf8');
    // El único `href` del bloque del link corto es el estado que llenó
    // `linkCortoParaAbrir`. Un `href={texto}` acá es un link arbitrario puesto
    // por un pegado, y el typecheck no lo ve.
    expect(COMPONENTE).toContain('setLinkCorto(linkCortoParaAbrir(entrada))');
    expect(COMPONENTE).toContain('href={linkCorto}');
    expect(COMPONENTE).not.toMatch(/href=\{(texto|entrada|pegado)\}/);
  });

  /**
   * B-45, lo que señaló el `auditor-privacidad`: hoy el `rel` está bien y **nada
   * lo fijaba**.
   *
   * `target="_blank"` implica `noopener` por su cuenta en los navegadores
   * actuales, pero **no** implica `noreferrer`: perder el `rel` en un reordenado
   * del JSX no rompe nada visible y empieza a mandarle a Google la URL del panel
   * en el `Referer`. En todo el repo no había ningún test que atara un `rel` a un
   * `_blank`, así que el hueco es del repo; este archivo es el que lo introduce y
   * el que ya lee el fuente.
   */
  it('el link corto se abre en otra pestaña sin opener ni referrer (B-45)', () => {
    const COMPONENTE = readFileSync('src/components/admin/CoordenadasSede.tsx', 'utf8');
    expect(COMPONENTE).toMatch(/href=\{linkCorto\}[\s\S]{0,160}rel="noopener noreferrer"/);
  });
});
