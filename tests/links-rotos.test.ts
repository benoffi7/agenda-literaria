import { describe, expect, it } from 'vitest';
import {
  informe,
  linksDeLaPagina,
  motivo,
  paginasDelSitemap,
  veredicto,
} from '../scripts/links-rotos.mjs';

/**
 * `scripts/links-rotos.mjs` — roadmap 5.5. La mitad que decide: qué link se
 * prueba, cómo se lee la respuesta y qué dice el informe. La que toca la red no
 * se prueba acá (B-180): depende de sitios ajenos.
 */

describe('linksDeLaPagina — qué se prueba', () => {
  const html = `
    <a href="https://casabrandon.com/talleres">web</a>
    <a class="x" href="https://casabrandon.com/talleres#arriba">la misma, con ancla</a>
    <a href="https://forms.gle/abc?x=1&amp;y=2">inscripción</a>
    <a href="https://agendaleh.ar/actividad/otra/">nuestra</a>
    <a href="https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg">el flyer</a>
    <a href="https://www.google.com/maps/search/?api=1&amp;query=x">el mapa</a>
    <a href="https://wa.me/?text=hola">compartir</a>
    <a href="https://www.instagram.com/casabrandon/">ig</a>
    <a href="mailto:hola@ejemplo.com">mail</a>
    <a href="/relativo/">relativo</a>
  `;

  it('prueba los links de afuera una sola vez, sin el ancla y desescapados', () => {
    expect(linksDeLaPagina(html).aProbar.sort()).toEqual([
      'https://casabrandon.com/talleres',
      'https://forms.gle/abc?x=1&y=2',
    ]);
  });

  it('no prueba lo nuestro ni lo que arma el sitio, y aparta Instagram sin veredicto', () => {
    const { aProbar, noVerificables } = linksDeLaPagina(html);
    expect(aProbar.join(' ')).not.toMatch(/agendaleh|firebasestorage|google\.com|wa\.me|instagram|mailto/);
    expect(noVerificables).toEqual(['https://www.instagram.com/casabrandon/']);
  });
});

describe('paginasDelSitemap', () => {
  const xml = `<urlset>
    <url><loc>https://agendaleh.ar/</loc></url>
    <url><loc>https://agendaleh.ar/actividad/a/</loc></url>
    <url><loc> https://agendaleh.ar/guia/librerias/b/ </loc></url>
  </urlset>`;

  it('lee todas las páginas, o solo las de una sección', () => {
    expect(paginasDelSitemap(xml)).toHaveLength(3);
    expect(paginasDelSitemap(xml, 'actividad')).toEqual(['https://agendaleh.ar/actividad/a/']);
  });
});

describe('veredicto — tres y no dos', () => {
  const error = (code: string) => ({ error: Object.assign(new TypeError('fetch failed'), { cause: { code } }) });

  it('lo que seguro no anda es roto: 404, 410, un dominio que no existe', () => {
    expect(veredicto({ status: 404 })).toBe('roto');
    expect(veredicto({ status: 410 })).toBe('roto');
    // Es el caso real del 2026-09-28: un handle de Instagram publicado como web.
    expect(veredicto(error('ENOTFOUND'))).toBe('roto');
  });

  it('lo que puede ser del robot es dudoso: 403, 429, 5xx, timeout', () => {
    for (const status of [401, 403, 429, 500, 503]) expect(veredicto({ status })).toBe('dudoso');
    expect(veredicto({ error: Object.assign(new Error('x'), { name: 'TimeoutError' }) })).toBe('dudoso');
    expect(veredicto(error('ECONNRESET'))).toBe('dudoso');
  });

  it('2xx y 3xx andan', () => {
    expect(veredicto({ status: 200 })).toBe('ok');
    expect(veredicto({ status: 301 })).toBe('ok');
  });

  it('el motivo dice el código HTTP o el de la red', () => {
    expect(motivo({ status: 404 })).toBe('HTTP 404');
    expect(motivo(error('ENOTFOUND'))).toBe('ENOTFOUND');
  });
});

describe('informe', () => {
  it('lista lo roto y lo dudoso con sus páginas, y lo que anda solo lo cuenta', () => {
    const texto = informe({
      sitio: 'https://agendaleh.ar',
      fecha: '2026-09-28',
      paginas: 3,
      noVerificables: ['https://instagram.com/x'],
      resultados: [
        { url: 'https://roto.test/', veredicto: 'roto', motivo: 'HTTP 404', paginas: ['https://agendaleh.ar/actividad/a/'] },
        { url: 'https://anda.test/', veredicto: 'ok', motivo: 'HTTP 200', paginas: ['https://agendaleh.ar/'] },
      ],
    });
    expect(texto).toContain('## Rotos (1)');
    expect(texto).toContain('- https://roto.test/ — **HTTP 404**');
    expect(texto).toContain('  - en /actividad/a/');
    expect(texto).not.toContain('https://anda.test/');
    expect(texto).toContain('1 andan');
    expect(texto).toMatch(/## Dudosos[^\n]*\n\nNinguno\./);
  });
});
