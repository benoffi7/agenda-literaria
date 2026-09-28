import { describe, expect, it } from 'vitest';
import { CAMPANAS, campanaDe, conCampana, ubicacionAMedir, ubicacionSinQuery } from '@/lib/analyticsSitio';

/**
 * Las etiquetas de campaña — roadmap 3.8. El recorte de la query es el invariante
 * del §5.3 (lo que alguien tipeó nunca viaja a GA4); esto deja pasar **solo** la
 * pareja fuente/medio de una lista cerrada, y todo lo demás se sigue recortando.
 */

const SITIO = 'https://agendaleh.ar';

describe('qué deja pasar', () => {
  it('una pareja de la lista pasa, y nada más de la query viaja con ella', () => {
    const href = `${SITIO}/actividad/x/?q=CENTINELA_BUSQUEDA&utm_source=correo&utm_medium=semanal&utm_campaign=CENTINELA`;
    expect(ubicacionAMedir(href)).toBe(`${SITIO}/actividad/x/?utm_source=correo&utm_medium=semanal`);
  });

  it('una pareja que no está en la lista se descarta entera, aunque cada valor exista suelto', () => {
    // `correo` y `bio` existen, pero no juntos: no es ningún link que armemos.
    expect(campanaDe(`${SITIO}/?utm_source=correo&utm_medium=bio`)).toBeNull();
    expect(ubicacionAMedir(`${SITIO}/?utm_source=correo&utm_medium=bio`)).toBe(`${SITIO}/`);
  });

  it('lo escrito a mano en la barra no llega nunca', () => {
    for (const q of ['utm_source=CENTINELA&utm_medium=posteo', 'utm_source=instagram&utm_medium=CENTINELA', 'utm_source=instagram', 'q=hola']) {
      expect(ubicacionAMedir(`${SITIO}/?${q}`)).toBe(`${SITIO}/`);
    }
  });

  it('el recorte de siempre no cambia: ubicacionSinQuery sigue cortando todo', () => {
    expect(ubicacionSinQuery(`${SITIO}/?utm_source=correo&utm_medium=semanal`)).toBe(`${SITIO}/`);
  });

  it('la página de error no lleva campaña: su ruta es la fija', () => {
    expect(ubicacionAMedir(`${SITIO}/lo-que-sea?utm_source=correo&utm_medium=semanal`, '/404/')).toBe(`${SITIO}/404/`);
  });
});

describe('los links que armamos llevan una pareja que el recorte deja pasar', () => {
  it('conCampana y campanaDe son inversos para cada pareja de la lista', () => {
    for (const [fuente, medios] of Object.entries(CAMPANAS)) {
      for (const medio of medios) {
        const url = conCampana(`${SITIO}/actividad/x/`, { fuente, medio } as never);
        expect(campanaDe(url)).toEqual({ fuente, medio });
      }
    }
  });

  it('el correo y el texto para redes los usan', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/lib/boletinSemanal.ts', 'utf8')).toContain("{ fuente: 'correo', medio: 'semanal' }");
    expect(readFileSync('src/lib/textoRedes.ts', 'utf8')).toContain("{ fuente: 'instagram', medio: 'posteo' }");
  });
});

describe('venga lo que venga en la query, lo que se agrega es una pareja de la lista (§5.3, D-1272)', () => {
  const PAREJAS = new Set(
    Object.entries(CAMPANAS).flatMap(([f, ms]) => ms.map((m) => `?utm_source=${f}&utm_medium=${m}`)),
  );
  const HOSTILES = [
    'utm_source=toString&utm_medium=x',
    'utm_source=__proto__&utm_medium=posteo',
    'utm_source=constructor&utm_medium=bio',
    'utm_source=hasOwnProperty&utm_medium=semanal',
    'utm_source=CORREO&utm_medium=semanal',
    'utm_source=correo+&utm_medium=semanal',
    'utm_source=%63orreo&utm_medium=semanal',
    'utm_source=correo&utm_source=x&utm_medium=semanal',
    'utm_source=x&utm_source=correo&utm_medium=semanal',
    'utm_source=instagram&utm_medium=posteo%0Autm_campaign=CENTINELA',
    'utm_source=instagram&utm_medium=posteo&utm_medium=CENTINELA',
    'q=CENTINELA&utm_source=instagram&utm_medium=bio',
  ];

  it.each(HOSTILES)('%s', (q) => {
    // No tira: una URL armada no puede apagar la medición.
    const salida = ubicacionAMedir(`${SITIO}/x/?${q}`);
    const cola = salida.slice(`${SITIO}/x/`.length);
    expect(cola === '' || PAREJAS.has(cola), `${q} → ${salida}`).toBe(true);
    expect(salida).not.toContain('CENTINELA');
  });
});
