/**
 * **El calendario se repara solo, y dos guardados fuera de orden convergen** —
 * B-2218 y B-2194.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { construirEvento, huellaDeEvento, planificar } from '../functions/calendario.js';
import { huellasDespues, llegoTarde } from '../functions/sincronizacion.js';
import { cicloDeOcho } from './fixtures/ciclo';

type Op = { tipo: string; id: string; huella?: string };

const huellasDe = (actividad: ReturnType<typeof cicloDeOcho>) =>
  Object.fromEntries(
    (actividad.sesiones as { id: string }[]).map((s) => [s.id, huellaDeEvento(construirEvento(actividad, s, {}))]),
  );

describe('la huella del evento — B-2218', () => {
  it('es estable y cambia si cambia el evento', () => {
    const a = cicloDeOcho();
    const s = (a.sesiones as { id: string }[])[0]!;
    const e = construirEvento(a, s, {});
    expect(huellaDeEvento(e)).toBe(huellaDeEvento(construirEvento(a, s, {})));
    expect(huellaDeEvento(e)).not.toBe(huellaDeEvento({ ...e, location: 'otra sede' }));
  });
});

describe('planificar contra lo que Calendar tiene — B-2218', () => {
  it('un update que falló se reenvía aunque la edición siguiente no cambie el evento', () => {
    // Calendar tiene la sede vieja (huella vieja); el documento ya dice la nueva,
    // y la edición siguiente toca otra cosa: antes y después dan el mismo evento.
    // Mutación probada: ignorar `huellas` en `planificar` deja cero operaciones.
    const viejo = cicloDeOcho();
    const nuevo = cicloDeOcho({ sede: { nombre: 'Otra casa', direccion: 'Corrientes 1', barrio: '', ciudad: 'CABA' } });
    const ops = planificar(nuevo, nuevo, {}, huellasDe(viejo)) as Op[];
    expect(ops.filter((o) => o.tipo === 'actualizar')).toHaveLength(8);
    // Y cada op lleva la huella de lo que manda, para guardarla si sale bien.
    expect(ops.every((o) => typeof o.huella === 'string')).toBe(true);
  });

  it('con la huella al día no manda nada, aunque el documento de antes fuera otro', () => {
    const viejo = cicloDeOcho({ titulo: 'Otro título' });
    const actual = cicloDeOcho();
    expect(planificar(viejo, actual, {}, huellasDe(actual))).toEqual([]);
  });

  it('sin huellas compara como siempre, contra el documento de antes', () => {
    const a = cicloDeOcho();
    expect(planificar(a, a, {}, {})).toEqual([]);
    expect(planificar(a, a, {})).toEqual([]);
    const b = cicloDeOcho({ titulo: 'Club de lectura: Saer' });
    expect((planificar(a, b, {}, {}) as Op[]).filter((o) => o.tipo === 'actualizar')).toHaveLength(8);
  });
});

describe('las huellas que quedan — B-2218', () => {
  it('lo aceptado se pone, lo borrado se saca, lo que falló queda como estaba', () => {
    const previas = { s1: 'vieja1', s2: 'vieja2', s3: 'vieja3' };
    const aceptadas = new Map<string, string | null>([
      ['s1', 'nueva1'],
      ['s2', null],
    ]);
    expect(huellasDespues(previas, aceptadas)).toEqual({ s1: 'nueva1', s3: 'vieja3' });
  });
});

describe('el sync que llegó tarde corta — B-2194', () => {
  const ts = (n: number) => ({ isEqual: (o: unknown) => (o as { n: number })?.n === n, n });

  it('si el documento cambió desde la foto del evento, llegó tarde', () => {
    expect(llegoTarde({ updateTime: ts(1) }, { exists: true, updateTime: ts(2) })).toBe(true);
    expect(llegoTarde({ updateTime: ts(1) }, { exists: true, updateTime: ts(1) })).toBe(false);
  });

  it('una reentrega del mismo evento no corta: trae el mismo updateTime', () => {
    expect(llegoTarde({ updateTime: ts(5) }, { exists: true, updateTime: ts(5) })).toBe(false);
  });

  it('si la actividad ya no existe, viene el borrado: corta', () => {
    expect(llegoTarde({ updateTime: ts(1) }, { exists: false })).toBe(true);
  });

  it('una actividad borrada nunca llega tarde, y sin updateTime no se corta', () => {
    expect(llegoTarde(null, { exists: false })).toBe(false);
    expect(llegoTarde({}, { exists: true, updateTime: ts(1) })).toBe(false);
  });
});

describe('el cableado en syncCalendar — B-2218, B-2194', () => {
  const src = readFileSync('functions/calendario-trigger.js', 'utf8');
  const cuerpo = src.slice(src.indexOf('async (event) => {'));

  it('lee el documento antes de cualquier escritura propia, y corta recién antes de planificar', () => {
    const lee = cuerpo.indexOf('llegoTarde(event.data?.after');
    const marcaPublicada = cuerpo.indexOf('await marcarPublicada(');
    const corrige = cuerpo.indexOf('await corregirDerivados(');
    const corta = cuerpo.indexOf('if (tarde) {');
    const planifica = cuerpo.indexOf('ops = planificar(');
    expect(lee).toBeGreaterThan(-1);
    expect(lee).toBeLessThan(marcaPublicada);
    expect(lee).toBeLessThan(corrige);
    expect(corta).toBeGreaterThan(corrige);
    expect(corta).toBeLessThan(planifica);
  });

  it('las huellas viven en una subcolección, se pasan a planificar y se escriben antes del write-back', () => {
    expect(cuerpo).toContain('db.doc(`actividades/${id}/sincronizacion/calendar`)');
    expect(cuerpo).toContain('labels, huellasPrevias)');
    expect(cuerpo.indexOf('huellasDespues(huellasPrevias, aceptadas)')).toBeLessThan(cuerpo.indexOf('reponerIds('));
    // Borrada la actividad, se va el documento de huellas.
    expect(cuerpo).toContain('if (!despues) await refHuellas.delete();');
  });
});
