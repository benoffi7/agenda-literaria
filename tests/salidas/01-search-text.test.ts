/**
 * Salida 1, por la puerta de atrás: el searchText (§6).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { buildSearchText } from '@/lib/normalize';
import { actividadCentinela } from '../fixtures/centinelas';
import { barrer } from '../fixtures/barrido';
import { PERMITIDO_EN_SEARCH_TEXT } from '../fixtures/barrido-de-salidas';

describe('barrido del searchText (§6 — salida pública por la puerta de atrás)', () => {
  it('sobreviven exactamente los centinelas permitidos', () => {
    // Se normaliza a minúsculas y sin acentos, así que el barrido compara
    // insensible: si no, cualquier fuga pasaría por ausente.
    const actividad = actividadCentinela();
    barrer('searchText', buildSearchText(actividad), PERMITIDO_EN_SEARCH_TEXT, {
      insensible: true,
    });
  });

  it('un link de reunión pegado en la descripción no llega al índice (B-2185, trampa 5)', () => {
    // El `searchText` sale entero a `/events.json`. Mutación probada: volver a
    // meter `a.descripcion` crudo en `buildSearchText` lo pone rojo.
    const privado = 'https://bbb.miescuela.edu.ar/b/tal-ler';
    const texto = buildSearchText({
      titulo: 'Taller',
      descripcion: `Nos vemos en https://meet.google.com/abc-defg-hij o en ${privado}.`,
      modalidades: [{ online: { url: privado } }],
    });
    expect(texto).not.toContain('meet.google');
    expect(texto).not.toContain('abc-defg-hij');
    expect(texto).not.toContain('bbb.miescuela');
    expect(texto).not.toContain('link de la reunion');
    expect(texto).toContain('nos vemos en');
  });
});
