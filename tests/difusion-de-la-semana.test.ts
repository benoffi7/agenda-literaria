import { describe, expect, it } from 'vitest';
import { boletinSemanal } from '@/lib/boletinSemanal';
import {
  LIMITE_DEL_POSTEO,
  posteoDeLaSemana,
  recordatorioDeEncuentro,
  recordatoriosDeLaSemana,
} from '@/lib/difusionDeLaSemana';
import { construirIndice, type Indice } from '@/lib/eventsJson';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import { DOMINIO } from '@/lib/rutasPublicas';
import type { ActividadParaRedes } from '@/lib/textoRedes';
import { toPublic } from '@/lib/toPublic';
import { actividadDePrueba, type OpcionesDeEntrada } from './fixtures/indice';

/**
 * «El lunes de difusión» — roadmap 4.1. El posteo semanal y los recordatorios
 * salen del mismo borrador que el correo (D-801); el texto de cada recordatorio,
 * de la función del formulario.
 */

const ETIQUETAS = mapaDeEtiquetas({});
const indice = (actividades: readonly OpcionesDeEntrada[]): Indice =>
  construirIndice({
    actividades: actividades.map((o, i) => toPublic(actividadDePrueba(o), o.id ?? `act_${i}`)),
    opciones: {},
    version: '1.8.0+abc1234',
    generadoEn: '2026-09-01T00:00:00.000Z',
  });
const LUNES = new Date('2026-09-14T14:00:00Z');
const encuentro = (i: number, iso: string, over: OpcionesDeEntrada = {}): OpcionesDeEntrada => ({
  id: `act_${i}`,
  slug: `actividad-${i}`,
  titulo: `Actividad ${i}`,
  fechas: [iso],
  ...over,
});

describe('el posteo de la semana', () => {
  it('dice cuántos, las recomendadas arriba, el resto por día y la agenda al final', () => {
    const b = boletinSemanal(
      indice([encuentro(1, '2026-09-15T22:00:00Z'), encuentro(2, '2026-09-17T22:00:00Z', { destacado: true })]),
      LUNES,
      ETIQUETAS,
    )!;
    const p = posteoDeLaSemana(b);
    expect(p.startsWith('Esta semana en la agenda: 2 encuentros.')).toBe(true);
    expect(p.indexOf('RECOMENDADAS')).toBeLessThan(p.indexOf('Actividad 1'));
    expect(p.trim().endsWith(DOMINIO)).toBe(true);
    // Sin links por fila: en una caption no se pueden tocar.
    expect(p).not.toContain('/actividad/');
  });

  it(`si no entra en ${LIMITE_DEL_POSTEO} caracteres, se corta al final y dice cuántos faltan`, () => {
    const muchas = Array.from({ length: 60 }, (_, i) =>
      encuentro(i, `2026-09-1${5 + (i % 5)}T22:00:00Z`, { titulo: `Un título bastante largo número ${i} para llenar` }),
    );
    const b = boletinSemanal(indice(muchas), LUNES, ETIQUETAS)!;
    const p = posteoDeLaSemana(b);
    expect(p.length).toBeLessThanOrEqual(LIMITE_DEL_POSTEO);
    const faltan = Number(/…y (\d+) más en la agenda\./.exec(p)?.[1]);
    const mostradas = p.split('\n').filter((l) => l.startsWith('· ')).length;
    expect(mostradas + faltan).toBe(b.total);
    // Un rótulo de día sin filas abajo no queda colgado al final.
    const lineas = p.split('\n');
    const antesDelCorte = lineas[lineas.findIndex((l) => l.startsWith('…y')) - 2]!;
    expect(antesDelCorte.startsWith('· ')).toBe(true);
  });
});

const publicada = (o: OpcionesDeEntrada) =>
  ({ ...actividadDePrueba(o), estado: 'publicado' }) as unknown as ActividadParaRedes;

describe('los recordatorios', () => {
  it('lista todos los encuentros por día, con las recomendadas de vuelta en el suyo', () => {
    const b = boletinSemanal(
      indice([encuentro(1, '2026-09-15T22:00:00Z'), encuentro(2, '2026-09-15T20:00:00Z', { destacado: true })]),
      LUNES,
      ETIQUETAS,
    )!;
    const r = recordatoriosDeLaSemana(b);
    expect(r.map((d) => d.dia)).toEqual(['2026-09-15']);
    expect(r[0]!.encuentros.map((e) => e.titulo)).toEqual(['Actividad 2', 'Actividad 1']);
    expect(r[0]!.encuentros[0]!.slug).toBe('actividad-2');
  });

  it('el texto es el de ESE encuentro de un ciclo, no el del próximo desde hoy', () => {
    const doc = publicada({
      titulo: 'Ciclo',
      esCiclo: true,
      fechas: ['2026-09-15T22:00:00Z', '2026-09-17T22:00:00Z'],
    }) as unknown as ActividadParaRedes;
    const jueves = doc.sesiones[1]!;
    const r = recordatorioDeEncuentro(doc, jueves.id, {}, doc.slug);
    expect(r.ok).toBe(true);
    // El recordatorio del jueves nombra el tema del jueves (el fixture numera los temas).
    expect(r.ok && r.texto).toContain('Tema: Tema 2');
    expect(r.ok && r.texto).not.toContain('Tema: Tema 1');
  });

  it('un encuentro que ya no está en la actividad lo dice, en vez de armar otro', () => {
    const doc = publicada({});
    expect(recordatorioDeEncuentro(doc, 'ses_inexistente', {}, doc.slug).ok).toBe(false);
  });
});

describe('lo que cambió entre el build y el clic (auditor-privacidad)', () => {
  const ciclo = () =>
    publicada({ titulo: 'Ciclo', esCiclo: true, slug: 'ciclo', fechas: ['2026-09-15T22:00:00Z', '2026-09-17T22:00:00Z'] });

  it('una actividad despublicada o cancelada no se recuerda', () => {
    for (const estado of ['borrador', 'cancelado'] as const) {
      const doc = { ...ciclo(), estado } as ActividadParaRedes;
      expect(recordatorioDeEncuentro(doc, doc.sesiones[0]!.id, {}, 'ciclo').ok).toBe(false);
    }
  });

  it('sin link si el slug ya no es el que tiene página (B-312)', () => {
    const doc = ciclo();
    const conLink = recordatorioDeEncuentro(doc, doc.sesiones[0]!.id, {}, doc.slug);
    const sinLink = recordatorioDeEncuentro(doc, doc.sesiones[0]!.id, {}, 'otro-slug');
    expect(conLink.ok && conLink.texto).toContain('/actividad/');
    expect(sinLink.ok && sinLink.texto).not.toContain('/actividad/');
  });

  it('un encuentro cancelado después del build no arma el recordatorio de otro', () => {
    const doc = ciclo();
    doc.sesiones[0]!.cancelada = true;
    expect(recordatorioDeEncuentro(doc, doc.sesiones[0]!.id, {}, doc.slug).ok).toBe(false);
  });

  it('es el de ESE encuentro aunque el anterior termine justo cuando empieza', () => {
    // 18 a 20 y 20 a 22: con solo el instante, el de las 20 elegía el de las 18.
    const doc = publicada({ titulo: 'Pegados', esCiclo: true, fechas: ['2026-09-15T21:00:00Z', '2026-09-15T23:00:00Z'] });
    const r = recordatorioDeEncuentro(doc, doc.sesiones[1]!.id, {}, doc.slug);
    expect(r.ok && r.texto).toContain('Tema: Tema 2');
    // La numeración cuenta los cancelados (D-95): sigue siendo «2 de 2».
    expect(r.ok && r.texto).toContain('Encuentro 2 de 2');
  });
});
