/**
 * Salida 1, por la puerta de atrás: el searchText (§6).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, it } from 'vitest';
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
});
