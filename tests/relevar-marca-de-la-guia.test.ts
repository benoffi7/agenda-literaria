/**
 * `scripts/relevar-marca-de-la-guia.mjs` — B-1420. La clasificación es pura y se
 * prueba sin red; del fuente se ata que el script **no puede escribir**, que es
 * la condición con la que se corre contra producción.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { COLECCIONES_DE_DIRECTORIO } from '../functions/directorios.js';
import {
  CASOS,
  RUTAS_QUE_NO_SON_FICHA,
  agruparPorCaso,
  clasificarFichas,
  fichaDeRuta,
  huellasHuerfanas,
  juntarHuellas,
} from '../scripts/relevar-marca-de-la-guia.mjs';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';

const ficha = (extra: Record<string, unknown> = {}) => ({
  coleccion: 'librerias',
  id: 'l1',
  nombre: 'Lugar del Libro',
  slug: 'lugar-del-libro',
  estado: 'pendiente',
  ...extra,
});

describe('fichaDeRuta — B-1420', () => {
  it('reconoce la ficha en las tres formas en que aparece: URL del sitemap, ruta y archivo de Hosting', () => {
    const esperado = { coleccion: 'librerias', slug: 'jb-libros' };
    expect(fichaDeRuta('https://agendaleh.ar/guia/librerias/jb-libros/')).toEqual(esperado);
    expect(fichaDeRuta('/guia/librerias/jb-libros/')).toEqual(esperado);
    expect(fichaDeRuta('/guia/librerias/jb-libros/index.html')).toEqual(esperado);
  });

  it('cubre las cuatro colecciones de la Guía, derivadas y no escritas a mano', () => {
    expect(COLECCIONES_DE_DIRECTORIO.length).toBeGreaterThanOrEqual(4);
    for (const c of COLECCIONES_DE_DIRECTORIO) {
      expect(fichaDeRuta(`/guia/${c}/x/index.html`)).toEqual({ coleccion: c, slug: 'x' });
    }
  });

  it('no confunde con una ficha el listado, `sumar`, una actividad ni un asset', () => {
    for (const r of [
      '/guia/',
      '/guia/librerias/',
      '/guia/librerias/index.html',
      '/guia/librerias/sumar/',
      '/guia/librerias/sumar/index.html',
      '/actividad/club-x/index.html',
      '/guia/librerias/x/foto.jpg',
      '/guia/otra-cosa/x/',
      '/librerias.json',
      'no es una url',
    ]) {
      expect(fichaDeRuta(r), r).toBeNull();
    }
  });

  it('las rutas que no son ficha son exactamente las páginas hermanas de `[slug].astro`', () => {
    /*
     * Si mañana aparece `src/pages/guia/librerias/mapa.astro`, su ruta se leería
     * como la ficha `mapa` y contaría de más. Este caso lo pone en rojo el día
     * que se agrega, en vez de dejar al relevamiento contando mal.
     */
    const hermanas = new Set<string>();
    for (const c of COLECCIONES_DE_DIRECTORIO) {
      for (const f of readdirSync(`src/pages/guia/${c}`)) {
        const nombre = f.replace(/\.astro$/, '');
        if (nombre !== '[slug]' && nombre !== 'index') hermanas.add(nombre);
      }
    }
    expect([...hermanas].sort()).toEqual([...RUTAS_QUE_NO_SON_FICHA].sort());
  });
});

describe('juntarHuellas — B-1420', () => {
  it('agrupa por colección y slug, con cada fuente una sola vez', () => {
    const h = juntarHuellas({
      sitemap: ['https://agendaleh.ar/guia/librerias/a/', 'https://agendaleh.ar/guia/'],
      hosting: ['/guia/librerias/a/index.html', '/guia/librerias/a/index.html', '/guia/bibliotecas/b/index.html'],
    });
    expect(h).toEqual({ 'librerias/a': ['sitemap', 'hosting'], 'bibliotecas/b': ['hosting'] });
  });

  it('el mismo slug en dos colecciones son dos fichas distintas', () => {
    const h = juntarHuellas({ json: ['/guia/librerias/x/', '/guia/lugares/x/'] });
    expect(Object.keys(h).sort()).toEqual(['librerias/x', 'lugares/x']);
  });
});

describe('clasificarFichas — B-1420', () => {
  const huellas = { 'librerias/lugar-del-libro': ['hosting'] };

  it('no publicada, sin marca y con huella: el hueco que se vino a buscar', () => {
    const [f] = clasificarFichas({ fichas: [ficha()], huellas });
    expect(f).toMatchObject({ caso: 'hueco', fuentes: ['hosting'], nombre: 'Lugar del Libro' });
  });

  it('`rechazado` con huella también es el hueco', () => {
    expect(clasificarFichas({ fichas: [ficha({ estado: 'rechazado' })], huellas })[0].caso).toBe('hueco');
  });

  it('la marca gana siempre, aunque no esté publicada', () => {
    const [f] = clasificarFichas({ fichas: [ficha({ publicadaAlgunaVez: true })], huellas });
    expect(f.caso).toBe('marcada');
  });

  it('la marca es estricta: un `false` no es la marca', () => {
    const [f] = clasificarFichas({ fichas: [ficha({ publicadaAlgunaVez: false })], huellas });
    expect(f.caso).toBe('hueco');
  });

  it('publicada sin marca va aparte: no está en el hueco hoy', () => {
    const [f] = clasificarFichas({ fichas: [ficha({ estado: 'publicado' })], huellas: {} });
    expect(f.caso).toBe('publicada-sin-marca');
  });

  it('sin huella y no publicada: nunca lo estuvo', () => {
    expect(clasificarFichas({ fichas: [ficha()], huellas: {} })[0].caso).toBe('nunca-publicada');
  });

  it('la huella de otra colección con el mismo slug no cuenta', () => {
    const [f] = clasificarFichas({ fichas: [ficha()], huellas: { 'lugares/lugar-del-libro': ['hosting'] } });
    expect(f.caso).toBe('nunca-publicada');
  });

  it('cada caso que clasifica tiene título y qué hacer, y agruparPorCaso sigue ese orden', () => {
    const filas = clasificarFichas({
      fichas: [ficha({ id: 'a', estado: 'publicado' }), ficha({ id: 'b' })],
      huellas,
    });
    expect(agruparPorCaso(filas).map((g) => g.caso)).toEqual(['hueco', 'publicada-sin-marca']);
    for (const c of Object.values(CASOS)) {
      expect(c.titulo.length).toBeGreaterThan(0);
      expect(c.accion.length).toBeGreaterThan(0);
    }
  });
});

describe('huellasHuerfanas — B-1420', () => {
  it('lista las URLs publicadas que no son de ninguna ficha de hoy', () => {
    const r = huellasHuerfanas({
      fichas: [ficha()],
      huellas: { 'librerias/lugar-del-libro': ['hosting'], 'librerias/se-borro': ['hosting'] },
    });
    expect(r).toEqual([{ clave: 'librerias/se-borro', fuentes: ['hosting'] }]);
  });
});

describe('el script no puede escribir — B-1420', () => {
  const codigo = sinComentarios(readFileSync('scripts/relevar-marca-de-la-guia.mjs', 'utf8'));

  it('no llama a nada que escriba en Firestore', () => {
    for (const verbo of [
      /\.set\(/,
      /\.update\(/,
      /\.delete\(/,
      /\.create\(/,
      /\.add\(/,
      /\.batch\(/,
      /runTransaction/,
      /bulkWriter/,
      /\.recursiveDelete\(/,
    ]) {
      expect(codigo, `aparece ${verbo}`).not.toMatch(verbo);
    }
  });

  it('a la red solo le hace GET, y por un solo lugar', () => {
    // Un único `fetch`, y con el método escrito: así un POST/PATCH/DELETE a la
    // API de Hosting (que sí los tiene: releases, versiones) no entra sin que
    // este caso lo vea.
    expect(codigo.match(/\bfetch\(/g)).toHaveLength(1);
    expect(codigo).toContain("method: 'GET'");
    expect(codigo).not.toMatch(/method:\s*'(POST|PUT|PATCH|DELETE)'/);
  });

  it('no acepta --aplicar (no entra entre los scripts que escriben)', () => {
    expect(codigo).not.toContain('--aplicar');
  });

  it('control positivo: el detector ve las lecturas que sí hace', () => {
    expect(codigo).toMatch(/\.select\(/);
    expect(codigo).toMatch(/\.get\(\)/);
  });
});
