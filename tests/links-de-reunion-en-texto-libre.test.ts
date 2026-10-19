/**
 * **El link de la reunión no viaja por ningún texto libre** — B-2219 (trampa 5).
 *
 * B-980/D-1036 sacaban el link pegado en la **descripción**; las indicaciones de
 * la sede, las notas del arancel y la bio del tallerista son tres textos más que
 * alguien escribe a mano y salen al sitio, al calendario público y al posteo. El
 * caso más probable es el de una fila híbrida: «si venís por compu, entrá a
 * meet…» en las indicaciones.
 *
 * Se prueba con los dos links: uno de Meet (lo agarra la lista de hosts) y uno
 * privado de una plataforma que la lista no conoce (lo agarra la coincidencia
 * exacta con el `online.url`, que solo ve quien tiene el documento entero).
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { construirTextoRedes, type ActividadParaRedes } from '@/lib/textoRedes';
import { construirDescripcion } from '../functions/calendario.js';
import { actividadCentinela } from './fixtures/centinelas';
import type { Actividad } from '@/types/actividad';

const PRIVADO = 'https://bbb.miescuela.edu.ar/b/tal-ler';
const MEET = 'https://meet.google.com/abc-defg-hij';
const TEXTO = `Si venís por compu, entrá a ${PRIVADO} o a ${MEET}.`;

const conLinks = (): Actividad => {
  const base = actividadCentinela();
  return {
    ...base,
    online: { ...base.online!, url: PRIVADO, urlPublica: false },
    sede: { ...base.sede!, indicaciones: TEXTO },
    modalidades: base.modalidades.map((m) => ({
      ...m,
      sede: m.sede ? { ...m.sede, indicaciones: TEXTO } : m.sede,
      online: m.online ? { ...m.online, url: PRIVADO, urlPublica: false } : m.online,
    })),
    arancel: { ...base.arancel, notas: TEXTO },
    tallerista: { ...base.tallerista!, bio: TEXTO },
  };
};

const sinNingunLink = (salida: string) => {
  expect(salida).not.toContain('bbb.miescuela');
  expect(salida).not.toContain('meet.google');
  expect(salida).not.toContain('abc-defg-hij');
};

describe('el link de la reunión no sale por las indicaciones, las notas ni la bio — B-2219', () => {
  it('control: el fixture sí los lleva en los tres campos', () => {
    // Sin esto, un fixture que dejara de sembrarlos pasaría todo en verde.
    const a = conLinks();
    expect(JSON.stringify([a.sede, a.modalidades, a.arancel, a.tallerista])).toContain('bbb.miescuela');
  });

  it('la proyección pública (sitio, índice, detalle)', () => {
    // Mutación probada: volver a `indicaciones: s.indicaciones` en `toPublic` lo pone rojo.
    const p = toPublic(conLinks(), 'act_1');
    sinNingunLink(JSON.stringify([p.sede, p.modalidades, p.arancel, p.tallerista]));
    // El texto alrededor sigue: se cambia el link, no se borra el campo.
    expect(p.arancel.notas).toContain('Si venís por compu');
  });

  it('el evento del calendario público', () => {
    const a = conLinks();
    sinNingunLink(construirDescripcion(a, a.sesiones[0], {}));
  });

  it('el texto para redes', () => {
    const r = construirTextoRedes(conLinks() as unknown as ActividadParaRedes, 'anuncio', new Date('2026-01-01T12:00:00Z'));
    sinNingunLink(JSON.stringify(r));
  });
});
