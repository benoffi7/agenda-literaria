import { describe, expect, it } from 'vitest';
import {
  paginaDeOrganizador,
  paginasDeOrganizador,
  slugsConPaginaDeOrganizador,
  contactoDeOrganizador,
  indiceDeOrganizadores,
} from '@/lib/organizadorPublico';
import { RUTA_ORGANIZADORES, rutaDeOrganizador } from '@/lib/rutasPublicas';
import { rutasDelSitemap } from '@/lib/sitemap';
import type { ValorOpcion } from '@/types/actividad';
import { entradaDePrueba } from './fixtures/indice';

/**
 * Roadmap 1.5, B-2172 paso 4 — las páginas `/organiza/{slug}`.
 *
 * Las dos defensas que heredan de los hubs son lo que este archivo fija: se
 * emiten solo para una opción **aprobada** con alguna actividad publicada, y
 * entran al sitemap **si y solo si** se indexan (tienen algo por venir).
 */
const AHORA = new Date('2026-09-10T15:00:00Z');
const PROXIMA = '2026-09-24T22:00:00Z';
const OTRA_PROXIMA = '2026-09-17T22:00:00Z';
const PASADA = '2026-07-24T22:00:00Z';

const opcion = (slug: string, label: string, extra: Partial<ValorOpcion> = {}): ValorOpcion => ({
  slug,
  label,
  orden: 99,
  fijo: false,
  usos: 1,
  ...extra,
});

const ENTRADAS = [
  entradaDePrueba({ id: 'a', slug: 'a', organizador: 'Casa Brandon', fechas: [PROXIMA] }),
  entradaDePrueba({ id: 'b', slug: 'b', organizador: 'casa brandon', fechas: [OTRA_PROXIMA] }),
  entradaDePrueba({ id: 'c', slug: 'c', organizador: 'Casa Brandon', fechas: [PASADA] }),
  entradaDePrueba({ id: 'd', slug: 'd', organizador: 'Hormiga', fechas: [PASADA] }),
  entradaDePrueba({ id: 'e', slug: 'e', organizador: 'A conf', fechas: [PROXIMA] }),
];

const OPCIONES = [
  opcion('casa-brandon', 'Casa Brandon'),
  opcion('hormiga', 'Hormiga'),
  // Pendiente: tipeado y sin aprobar. No tiene página (B-2178).
  opcion('a-conf', 'A conf', { aprobada: false }),
  // Aprobada pero sin actividad publicada: tampoco.
  opcion('nadie', 'Nadie'),
];

describe('slugsConPaginaDeOrganizador', () => {
  it('solo aprobados y con alguna actividad publicada, vigente o pasada', () => {
    // Mutación: sacar `estaAprobada` le da página a «A conf».
    expect(slugsConPaginaDeOrganizador(ENTRADAS, OPCIONES)).toEqual(['casa-brandon', 'hormiga']);
  });

  it('una opción marcada «sin página» no tiene página, aunque esté aprobada y en uso (B-2179)', () => {
    // Mutación: sacar el `!o.sinPagina` del filtro le devuelve la página.
    const conMarca = OPCIONES.map((o) => (o.slug === 'casa-brandon' ? { ...o, sinPagina: true } : o));
    expect(slugsConPaginaDeOrganizador(ENTRADAS, conMarca)).toEqual(['hormiga']);
  });

  it('sin la lista no hay ninguna: el lado inofensivo del error', () => {
    expect(slugsConPaginaDeOrganizador(ENTRADAS, [])).toEqual([]);
  });
});

describe('paginaDeOrganizador', () => {
  it('junta las variantes de tipeo por slug y parte entre lo que viene y lo que pasó', () => {
    const p = paginaDeOrganizador('casa-brandon', ENTRADAS, AHORA)!;
    expect(p.ruta).toBe(rutaDeOrganizador('casa-brandon'));
    // Lo que viene, por próxima fecha: «b» (el 17) antes que «a» (el 24).
    expect(p.proximas.map((e) => e.slug)).toEqual(['b', 'a']);
    expect(p.pasadas.map((e) => e.slug)).toEqual(['c']);
    expect(p.indexable).toBe(true);
    expect(p.descripcion).toContain('2 actividades de');
  });

  it('con solo pasado se emite igual, pero sin indexar y sin cuenta de próximas', () => {
    const p = paginaDeOrganizador('hormiga', ENTRADAS, AHORA)!;
    expect(p.proximas).toEqual([]);
    expect(p.indexable).toBe(false);
    expect(p.descripcion).not.toMatch(/\b0 actividades/);
    expect(p.avisoSinProximas).toContain('Hormiga');
  });

  it('el nombre sale de la entrada, que es lo que el detalle ya muestra', () => {
    const p = paginaDeOrganizador('hormiga', ENTRADAS, AHORA)!;
    expect(p.nombre).toBe('Hormiga');
    expect(p.titulo).toBe('Actividades de Hormiga');
  });

  it('un slug sin entradas no tiene página', () => {
    expect(paginaDeOrganizador('nadie', ENTRADAS, AHORA)).toBeNull();
  });
});

describe('el sitemap y las páginas de organizador', () => {
  const rutas = rutasDelSitemap({
    entradas: ENTRADAS,
    canceladas: [],
    organizadores: OPCIONES,
    ahora: AHORA,
  });

  it('entra la que tiene algo por venir, y no la que solo tiene pasado', () => {
    expect(rutas).toContain(rutaDeOrganizador('casa-brandon'));
    expect(rutas).not.toContain(rutaDeOrganizador('hormiga'));
  });

  it('ni la de un organizador sin aprobar', () => {
    expect(rutas).not.toContain(rutaDeOrganizador('a-conf'));
  });

  it('el invariante: en el sitemap si y solo si se indexa', () => {
    for (const p of paginasDeOrganizador(ENTRADAS, OPCIONES, AHORA)) {
      expect(rutas.includes(p.ruta), p.slug).toBe(p.indexable);
    }
  });
});

describe('la plantilla de /organiza — B-237', () => {
  it('getStaticPaths está envuelta y no aliasada', async () => {
    /*
     * Astro llama a `getStaticPaths` con un argumento propio (`{ paginate, rss }`);
     * aliasada, `caminosDeOrganizador` lo recibiría como `ahora`. Es la misma red
     * que `/agenda/[mes]` (`mesPublico.test.ts`), por página. Lo señaló el
     * `auditor-trampas`.
     *
     * MUTACIÓN PROBADA: `export const getStaticPaths = caminosDeOrganizador;`
     * pone esto en rojo.
     */
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/pages/organiza/[slug].astro', 'utf8');
    expect(src).toMatch(/getStaticPaths = \(\) =>/);
    expect(src).not.toMatch(/getStaticPaths = caminosDeOrganizador\s*;/);
  });
});

describe('contactoDeOrganizador — la página como ficha', () => {
  const act = (slug: string, instagram = '', web = '') => ({ organizador: { slug, instagram, web } });

  it('el Instagram más repetido, comparando el handle y no lo tipeado', () => {
    const c = contactoDeOrganizador('casa', [
      act('casa', 'https://instagram.com/casa.brandon/'),
      act('casa', '@casa.brandon'),
      act('casa', 'otra.cuenta'),
      act('otra', 'otra.cuenta'),
      act('otra', 'otra.cuenta'),
    ]);
    expect(c.instagram).toEqual({ texto: '@casa.brandon', href: 'https://instagram.com/casa.brandon' });
  });

  it('la web solo si se puede enlazar con seguridad', () => {
    expect(contactoDeOrganizador('casa', [act('casa', '', 'https://casa.com.ar')]).web).toEqual({
      texto: 'https://casa.com.ar',
      href: 'https://casa.com.ar/',
    });
    expect(contactoDeOrganizador('casa', [act('casa', '', 'javascript:alert(1)')]).web).toBeNull();
  });

  it('sin datos, nada; y no toma los de otro organizador', () => {
    expect(contactoDeOrganizador('casa', [act('otra', 'otra', 'https://otra.com')])).toEqual({
      instagram: null,
      web: null,
    });
  });
});

describe('«Quién organiza» — el índice /organiza/', () => {
  it('en orden alfabético en castellano, con cuántas por venir', () => {
    const paginas = paginasDeOrganizador(ENTRADAS, OPCIONES, AHORA);
    expect(indiceDeOrganizadores(paginas)).toEqual([
      { nombre: 'Casa Brandon', ruta: rutaDeOrganizador('casa-brandon'), porVenir: 2 },
      { nombre: 'Hormiga', ruta: rutaDeOrganizador('hormiga'), porVenir: 0 },
    ]);
  });

  it('las mayúsculas y los acentos no desordenan', () => {
    const p = (nombre: string) => ({ nombre, ruta: '/', proximas: [] }) as never;
    expect(indiceDeOrganizadores([p('Ñandú'), p('álamo'), p('Nube'), p('Zeta')]).map((o) => o.nombre)).toEqual([
      'álamo',
      'Nube',
      'Ñandú',
      'Zeta',
    ]);
  });

  it('el sitemap lo pide si y solo si alguna página de organizador se indexa', () => {
    const con = rutasDelSitemap({ entradas: ENTRADAS, canceladas: [], organizadores: OPCIONES, ahora: AHORA });
    expect(con).toContain(RUTA_ORGANIZADORES);
    const soloPasado = [opcion('hormiga', 'Hormiga')];
    const sin = rutasDelSitemap({ entradas: ENTRADAS, canceladas: [], organizadores: soloPasado, ahora: AHORA });
    expect(sin).not.toContain(RUTA_ORGANIZADORES);
  });
});
