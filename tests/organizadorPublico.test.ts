import { describe, expect, it } from 'vitest';
import {
  paginaDeOrganizador,
  paginasDeOrganizador,
  slugsConPaginaDeOrganizador,
} from '@/lib/organizadorPublico';
import { rutaDeOrganizador } from '@/lib/rutasPublicas';
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
