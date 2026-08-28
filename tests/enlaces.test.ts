import { describe, expect, it } from 'vitest';

import {
  CALENDARIO_ID,
  CONTACTO,
  MOTIVOS_DE_CONTACTO,
  urlDeContacto,
  urlDeInstagram,
  urlDelCalendario,
  urlDelIcs,
  urlParaSuscribirseEnGoogle,
  urlWebcal,
} from '@/lib/enlaces';

/**
 * Los destinos externos del sitio — B-228.
 *
 * Todos salen de `CALENDARIO_ID`, así que lo que hay que verificar no es que las
 * cadenas sean las esperadas (eso sería copiar la implementación al test), sino
 * las **propiedades** que las hacen correctas: que apunten al calendario que
 * decimos, que ninguna sea la variante privada, y que el asunto del mail
 * distinga los dos motivos.
 */

/** Todas las URLs que este módulo produce, para las propiedades transversales. */
const TODAS = (): string[] => [
  urlDelCalendario(),
  urlParaSuscribirseEnGoogle(),
  urlDelIcs(),
  urlWebcal(),
  urlDeInstagram(),
  urlDeContacto('sugerencia'),
  urlDeContacto('error'),
];

describe('los enlaces externos del sitio', () => {
  it('el barrido mira todas las salidas del módulo', () => {
    // Control positivo: las tres afirmaciones de abajo recorren esta lista, y una
    // lista corta las dejaría pasar sin haber mirado nada.
    expect(TODAS()).toHaveLength(7);
    expect(new Set(TODAS()).size, 'dos salidas devuelven la misma URL').toBe(7);
  });

  it('ninguna es la URL privada del ICS', () => {
    /*
     * La trampa que este test existe para frenar. `.../private-<token>/basic.ics`
     * da acceso de lectura al calendario entero a quien la tenga y no se revoca
     * sin rotarla (`07-seguridad.md`). Está a un path de distancia de la pública.
     */
    for (const url of TODAS()) expect(url, url).not.toContain('private-');
  });

  it('las de calendario apuntan al calendario documentado', () => {
    // El `cid` es base64: se decodifica y tiene que dar el mismo ID, no otro.
    const cid = new URL(urlParaSuscribirseEnGoogle()).searchParams.get('cid')!;
    expect(Buffer.from(cid, 'base64').toString('utf8')).toBe(CALENDARIO_ID);

    expect(urlDelCalendario()).toContain(encodeURIComponent(CALENDARIO_ID));
    expect(urlDelIcs()).toContain(encodeURIComponent(CALENDARIO_ID));
  });

  it('el ICS es público y el webcal es el mismo con otro esquema', () => {
    expect(urlDelIcs()).toMatch(/\/public\/basic\.ics$/);
    expect(urlWebcal()).toBe(urlDelIcs().replace(/^https:/, 'webcal:'));
    expect(urlWebcal().startsWith('webcal://')).toBe(true);
  });

  it('el calendario se abre en la zona horaria del proyecto', () => {
    // Sin esto, quien lo abre desde otro huso ve los horarios corridos — que es
    // la trampa 1 del §13 con otra cara.
    expect(new URL(urlDelCalendario()).searchParams.get('ctz')).toBe(
      'America/Argentina/Buenos_Aires',
    );
  });

  it('cada motivo de contacto llega con su propio asunto', () => {
    const asunto = (m: 'sugerencia' | 'error') =>
      new URL(urlDeContacto(m)).searchParams.get('subject');

    expect(asunto('sugerencia')).toBe(MOTIVOS_DE_CONTACTO.sugerencia.asunto);
    expect(asunto('error')).toBe(MOTIVOS_DE_CONTACTO.error.asunto);
    // La propiedad que importa: se pueden separar en la bandeja sin abrirlos.
    expect(asunto('sugerencia')).not.toBe(asunto('error'));
  });

  it('el mailto va a la casilla del proyecto y precarga el cuerpo si se lo pasan', () => {
    expect(urlDeContacto('error').startsWith(`mailto:${CONTACTO}?`)).toBe(true);

    const conCuerpo = urlDeContacto('error', 'Pasó en /actividad/taller-de-cronica');
    expect(new URL(conCuerpo).searchParams.get('body')).toBe(
      'Pasó en /actividad/taller-de-cronica',
    );
    // Y sin cuerpo no manda un `body=` vacío, que en algunos clientes abre el
    // mail con una línea en blanco arriba de todo.
    expect(urlDeContacto('error')).not.toContain('body=');
  });
});
