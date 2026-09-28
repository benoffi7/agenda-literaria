import { beforeEach, describe, expect, it, vi } from 'vitest';
import { estadoDelCatalogo, type EstadoDelCatalogo } from '@/lib/estadoDelCatalogo';
import {
  catalogoDeLaFoto,
  idDeFoto,
  olvidarMesConfirmado,
  sacarFotoSiToca,
} from '@/lib/fotoDelCatalogo';
import type { ActividadConId } from '@/types/actividad';
import { ts } from './fixtures/tiempo';

/**
 * La foto mensual del tablero — B-378. La mitad pura: qué se guarda y con qué id.
 * Lo que la regla deja escribir está en `foto-del-catalogo.integracion.test.ts`.
 */

describe('idDeFoto', () => {
  it('es el mes en la hora del proyecto y no en UTC (trampa 1)', () => {
    // 31 de octubre a las 22:30 en Buenos Aires: en UTC ya es noviembre.
    expect(idDeFoto(new Date('2026-11-01T01:30:00Z'))).toBe('2026-10');
    expect(idDeFoto(new Date('2026-11-01T03:30:00Z'))).toBe('2026-11');
  });
});

describe('catalogoDeLaFoto', () => {
  const estado = (avisos: EstadoDelCatalogo['avisos']): EstadoDelCatalogo => ({
    ...estadoDelCatalogo([], new Date('2026-10-01T12:00:00Z')),
    avisos,
  });

  it('reduce cada aviso a su cantidad: ninguna actividad nombrada llega a la foto', () => {
    const r = catalogoDeLaFoto(
      estado([
        {
          clase: 'sin-flyer',
          titulo: 'Sin flyer',
          porque: '…',
          actividades: [
            { id: 'x', titulo: 'CENTINELA uno' },
            { id: 'y', titulo: 'CENTINELA dos' },
          ] as EstadoDelCatalogo['avisos'][number]['actividades'],
        },
      ]),
    );
    expect(r.avisos).toEqual([{ clase: 'sin-flyer', cantidad: 2 }]);
    expect(JSON.stringify(r)).not.toContain('CENTINELA');
  });

  it('guarda todos los conteos del tablero, con la misma forma', () => {
    const e = estado([]);
    const { avisos: _a, ...conteos } = e;
    const { avisos: _b, ...deLaFoto } = catalogoDeLaFoto(e);
    expect(deLaFoto).toEqual(conteos);
  });

  it('no deja ningún undefined, que Firestore rechaza al escribir', () => {
    const recorrer = (v: unknown): boolean =>
      v === undefined ||
      (typeof v === 'object' && v !== null && Object.values(v).some(recorrer));
    expect(recorrer(catalogoDeLaFoto(estado([])))).toBe(false);
  });
});

/**
 * Un catálogo que puebla cada reparto y cada aviso, con un centinela en cada texto
 * libre y en cada dato privado. Sobre uno vacío el barrido no probaría nada: los
 * repartos saldrían vacíos (lo señaló el `auditor-privacidad`).
 */
const poblado = (): ActividadConId[] => {
  const sede = {
    nombre: 'CENTINELA-sede',
    direccion: 'CENTINELA-direccion 123',
    provincia: 'caba',
    barrio: 'almagro',
    ciudad: 'caba',
    indicaciones: 'CENTINELA-timbre',
    geo: null,
  };
  const base = (id: string, over: Record<string, unknown> = {}) =>
    ({
      id,
      titulo: `CENTINELA-titulo-${id}`,
      descripcion: 'CENTINELA-descripcion',
      tipo: 'taller',
      estado: 'publicado',
      esCiclo: true,
      modalidad: 'hibrido',
      modalidades: [
        { id: 'm1', modalidad: 'presencial', inicio: null, fin: null, sede, online: null },
        {
          id: 'm2',
          modalidad: 'virtual',
          inicio: null,
          fin: null,
          sede: null,
          online: { plataforma: 'zoom', url: 'https://CENTINELA-zoom.test', urlPublica: false },
        },
      ],
      sede,
      online: null,
      sesiones: [
        { id: 'ses_1', inicio: ts('2026-10-05T22:00:00Z'), fin: ts('2026-10-06T00:00:00Z'), tema: 'CENTINELA-tema', lectura: null, cancelada: false, calendarEventId: null },
      ],
      tags: [],
      imagenes: [],
      organizador: { nombre: 'CENTINELA-org', instagram: '', web: 'no es una url CENTINELA' },
      tallerista: { nombre: 'CENTINELA-tallerista', bio: '', instagram: '' },
      arancel: { tipo: 'arancelado', notas: 'CENTINELA-notas' },
      inscripcion: { requiere: true, via: 'mail', destino: 'CENTINELA@mail.test', cupo: 10, cierra: ts('2026-09-01T00:00:00Z'), completo: true },
      difusion: { arrobar: ['@CENTINELA'], notas: 'CENTINELA' },
      createdBy: 'CENTINELA-uid',
      updatedAt: ts('2026-01-01T00:00:00Z'),
      ...over,
    }) as unknown as ActividadConId;
  return [base('a'), base('b', { estado: 'borrador', tipo: 'club-lectura' }), base('c', { estado: 'cancelado' })];
};

describe('la foto solo guarda números y slugs (B-378)', () => {
  it('un campo nuevo del tablero con títulos no entra a una serie que no se corrige', () => {
    const foto = catalogoDeLaFoto(estadoDelCatalogo(poblado(), new Date('2026-10-01T12:00:00Z')));
    // Que el fixture pueble lo que dice poblar: sin esto el barrido pasa en vacío.
    expect(foto.porBarrio.length).toBeGreaterThan(0);
    expect(foto.avisos.length).toBeGreaterThan(0);

    const hojasRaras: string[] = [];
    const recorrer = (v: unknown, camino: string, clave: string) => {
      if (typeof v === 'number') return;
      if (typeof v === 'string') {
        if (clave !== 'valor' && clave !== 'clase') hojasRaras.push(`${camino} = ${v}`);
        return;
      }
      if (Array.isArray(v)) return v.forEach((x, i) => recorrer(x, `${camino}[${i}]`, clave));
      if (v && typeof v === 'object')
        return Object.entries(v).forEach(([k, x]) => recorrer(x, `${camino}.${k}`, k));
      hojasRaras.push(`${camino} = ${String(v)}`);
    };
    recorrer(foto, 'catalogo', '');
    expect(hojasRaras).toEqual([]);
    expect(JSON.stringify(foto)).not.toContain('CENTINELA');
  });
});

describe('sacarFotoSiToca — cuántas veces se intenta (auditor-trampas)', () => {
  beforeEach(() => olvidarMesConfirmado());
  const OCTUBRE = new Date('2026-10-15T12:00:00Z');
  const NOVIEMBRE = new Date('2026-11-01T12:00:00Z');

  it('una vez por mes si sale bien', async () => {
    const sacar = vi.fn().mockResolvedValue('sacada');
    await sacarFotoSiToca([], OCTUBRE, sacar);
    expect(await sacarFotoSiToca([], OCTUBRE, sacar)).toBe('ya-confirmada');
    expect(sacar).toHaveBeenCalledTimes(1);
  });

  it('con el panel abierto de un mes al otro, saca la del mes nuevo', async () => {
    const sacar = vi.fn().mockResolvedValue('sacada');
    await sacarFotoSiToca([], OCTUBRE, sacar);
    await sacarFotoSiToca([], NOVIEMBRE, sacar);
    expect(sacar).toHaveBeenCalledTimes(2);
  });

  it('si falla, la próxima carga del mismo mes reintenta', async () => {
    const sacar = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('sacada');
    await expect(sacarFotoSiToca([], OCTUBRE, sacar)).rejects.toThrow('offline');
    expect(await sacarFotoSiToca([], OCTUBRE, sacar)).toBe('sacada');
  });
});
