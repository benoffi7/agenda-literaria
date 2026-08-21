import { describe, expect, it } from 'vitest';
import { formatearGeo, linkMapa, parsearCoordenadas } from '@/lib/coordenadas';

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
