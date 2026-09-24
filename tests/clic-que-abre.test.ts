import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { abreElEnlace, alAbrirEnlace } from '@/lib/clicQueAbre';

import { sinComentarios } from '../scripts/sin-comentarios.mjs';

/**
 * El criterio único de «este gesto abre el enlace» — B-1501. Lo usan
 * `clic_triptico`, `clic_banner_ciudad` y `clic_inscripcion`, y el punto es que
 * los tres midan igual.
 */
describe('abreElEnlace', () => {
  it('cuenta el clic principal y el del medio', () => {
    expect(abreElEnlace({ type: 'click', button: 0 })).toBe(true);
    expect(abreElEnlace({ type: 'auxclick', button: 1 })).toBe(true);
  });

  it('no cuenta el derecho, ni atrás/adelante, ni un `click` de otro botón', () => {
    expect(abreElEnlace({ type: 'auxclick', button: 2 })).toBe(false);
    expect(abreElEnlace({ type: 'auxclick', button: 3 })).toBe(false);
    expect(abreElEnlace({ type: 'auxclick', button: 4 })).toBe(false);
    expect(abreElEnlace({ type: 'click', button: 1 })).toBe(false);
    expect(abreElEnlace({ type: 'contextmenu', button: 2 })).toBe(false);
  });

  it('`alAbrirEnlace` devuelve las dos props con el mismo criterio', () => {
    const alAbrir = vi.fn();
    const { onClick, onAuxClick } = alAbrirEnlace(alAbrir);
    onClick({ type: 'click', button: 0 });
    onAuxClick({ type: 'auxclick', button: 1 });
    onAuxClick({ type: 'auxclick', button: 2 });
    expect(alAbrir).toHaveBeenCalledTimes(2);
  });
});

describe('los tres eventos de enlace usan el mismo criterio — B-1501', () => {
  const leer = (ruta: string) =>
    sinComentarios(readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8'));

  it('el tríptico y el banner esparcen `alAbrirEnlace`, sin `onClick` propio en el enlace', () => {
    for (const ruta of [
      'src/components/publico/PanelesDeAhora.tsx',
      'src/components/publico/BannerDeCiudad.tsx',
    ]) {
      const src = leer(ruta);
      expect(src, ruta).toMatch(/\{\.\.\.\(?[^}]*alAbrirEnlace\(/);
      expect(src, `${ruta}: un onClick suelto mediría con otro criterio`).not.toMatch(/\sonClick=/);
    }
  });

  it('la inscripción del detalle escucha `click` y `auxclick` con `abreElEnlace`', () => {
    /* MUTACIÓN PROBADA: sacar el listener de `auxclick` deja este caso en rojo. */
    const src = leer('src/pages/actividad/[slug].astro');
    expect(src).toContain("from '@/lib/clicQueAbre'");
    expect(src).toMatch(/if \(!abreElEnlace\(evento\)\) return;/);
    expect(src).toContain("document.addEventListener('click', medirInscripcion)");
    expect(src).toContain("document.addEventListener('auxclick', medirInscripcion)");
  });
});
