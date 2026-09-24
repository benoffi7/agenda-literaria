/**
 * `scripts/flyeres-de-propuestas-aceptadas.mjs` — B-1322. La clasificación es
 * pura y se prueba sin red; del fuente se ata que el script **no puede
 * escribir**, que es la condición con la que se corre contra producción.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  CASOS,
  EN_ORDEN,
  agruparPorCaso,
  clasificarAceptadas,
} from '../scripts/flyeres-de-propuestas-aceptadas.mjs';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';

const ORIGINAL = 'propuestas/prop_1.jpg';
const COPIA = 'imagenes/img_1.jpg';

const aceptada = (extra: Record<string, unknown> = {}) => ({
  id: 'p1',
  estado: 'aceptada',
  revision: { actividadId: 'a1' },
  imagen: { storagePath: ORIGINAL },
  ...extra,
});

const caso = (args: {
  propuesta?: Record<string, unknown>;
  vivo?: boolean;
  actividad?: Record<string, unknown> | null;
  copiaViva?: boolean;
}) => {
  const { propuesta = aceptada(), vivo = true, actividad = { titulo: 'Club X', estado: 'publicado', imagenes: [] }, copiaViva = true } = args;
  const filas = clasificarAceptadas({
    propuestas: [propuesta],
    originalesVivos: new Set(vivo ? [ORIGINAL] : []),
    actividades: new Map(actividad ? [['a1', actividad]] : []),
    copiasVivas: new Set(copiaViva ? [COPIA] : []),
  });
  return filas;
};

describe('clasificarAceptadas — B-1322', () => {
  it('actividad sin imágenes y original vivo: el caso que se vino a buscar, con título', () => {
    const [f] = caso({});
    expect(f).toMatchObject({
      caso: 'sin-foto-con-original',
      titulo: 'Club X',
      actividadId: 'a1',
      estadoActividad: 'publicado',
      imagenes: 0,
      original: ORIGINAL,
      propuesta: 'p1',
    });
  });

  it('sin imágenes y sin original: la foto se perdió', () => {
    expect(caso({ vivo: false })[0].caso).toBe('sin-foto-sin-original');
  });

  it('con su copia viva y sin original: en orden', () => {
    const actividad = { titulo: 'T', imagenes: [{ url: 'u', storagePath: COPIA }] };
    expect(caso({ actividad, vivo: false })[0].caso).toBe(EN_ORDEN);
  });

  it('con su copia viva y el original todavía: duplicado de más', () => {
    const actividad = { titulo: 'T', imagenes: [{ url: 'u', storagePath: COPIA }] };
    expect(caso({ actividad })[0].caso).toBe('con-copia-con-original');
  });

  it('la galería nombra una copia que ya no existe: copia rota', () => {
    const actividad = { titulo: 'T', imagenes: [{ url: 'u', storagePath: COPIA }] };
    expect(caso({ actividad, copiaViva: false })[0].caso).toBe('copia-rota-con-original');
    expect(caso({ actividad, copiaViva: false, vivo: false })[0].caso).toBe('sin-foto-sin-original');
  });

  it('solo imágenes externas: no prueban nada sobre la promoción', () => {
    const actividad = { titulo: 'T', imagenes: [{ url: 'https://afuera/x.jpg' }] };
    expect(caso({ actividad })[0].caso).toBe('solo-externas-con-original');
    expect(caso({ actividad, vivo: false })[0].caso).toBe(EN_ORDEN);
  });

  it('una copia que apunta a propuestas/ no cuenta como copia (no se verifica contra sí misma)', () => {
    const actividad = { titulo: 'T', imagenes: [{ url: 'u', storagePath: ORIGINAL }] };
    const filas = clasificarAceptadas({
      propuestas: [aceptada()],
      originalesVivos: new Set([ORIGINAL]),
      actividades: new Map([['a1', actividad]]),
      copiasVivas: new Set([ORIGINAL]),
    });
    expect(filas[0].caso).toBe('solo-externas-con-original');
  });

  it('actividad inexistente o sin actividadId', () => {
    expect(caso({ actividad: null })[0]).toMatchObject({ caso: 'sin-actividad-con-original', titulo: null });
    expect(caso({ actividad: null, vivo: false })[0].caso).toBe('sin-actividad-sin-original');
    const sinId = aceptada({ revision: { actividadId: null } });
    expect(caso({ propuesta: sinId })[0]).toMatchObject({ caso: 'sin-actividad-con-original', actividadId: null });
  });

  it('foto descartada: solo pide algo si el original quedó', () => {
    const descartada = aceptada({ revision: { actividadId: 'a1', fotoDescartada: true } });
    expect(caso({ propuesta: descartada })[0].caso).toBe('descartada-con-original');
    expect(caso({ propuesta: descartada, vivo: false })[0].caso).toBe(EN_ORDEN);
    // Un truthy que no es `true` no cuenta como descarte.
    const rara = aceptada({ revision: { actividadId: 'a1', fotoDescartada: 'si' } });
    expect(caso({ propuesta: rara })[0].caso).toBe('sin-foto-con-original');
  });

  it('ignora las que no están aceptadas, las sin foto y los paths fuera del prefijo', () => {
    const filas = clasificarAceptadas({
      propuestas: [
        aceptada({ id: 'rechazada', estado: 'rechazada' }),
        aceptada({ id: 'sin-foto', imagen: null }),
        aceptada({ id: 'ajena', imagen: { storagePath: 'imagenes/img_9.jpg' } }),
        aceptada({ id: 'anidada', imagen: { storagePath: 'propuestas/a/b.jpg' } }),
      ],
      originalesVivos: new Set(),
      actividades: new Map(),
      copiasVivas: new Set(),
    });
    expect(filas).toEqual([]);
  });

  it('agruparPorCaso sigue el orden de CASOS y no lista los en orden', () => {
    const filas = [
      { caso: 'con-copia-con-original' },
      { caso: EN_ORDEN },
      { caso: 'sin-foto-con-original' },
    ] as never[];
    expect(agruparPorCaso(filas).map((g: { caso: string }) => g.caso)).toEqual([
      'sin-foto-con-original',
      'con-copia-con-original',
    ]);
  });

  it('todo caso que la clasificación puede devolver tiene su qué hacer', () => {
    for (const c of Object.values(CASOS) as { titulo: string; accion: string }[]) {
      expect(c.titulo.length).toBeGreaterThan(0);
      expect(c.accion.length).toBeGreaterThan(0);
    }
  });
});

describe('el script no puede escribir — B-1322', () => {
  const codigo = sinComentarios(
    readFileSync('scripts/flyeres-de-propuestas-aceptadas.mjs', 'utf8'),
  );

  it('no llama a nada que escriba en Firestore ni en Storage', () => {
    for (const verbo of [
      /\.set\(/,
      /\.update\(/,
      /\.delete\(/,
      /\.create\(/,
      /\.add\(/,
      /\.save\(/,
      /\.upload\(/,
      /createWriteStream/,
      /\.batch\(/,
      /runTransaction/,
      /bulkWriter/,
      /\.move\(/,
      /\.copy\(/,
      /setMetadata/,
      /makePublic/,
    ]) {
      expect(codigo, `aparece ${verbo}`).not.toMatch(verbo);
    }
  });

  it('no acepta --aplicar (no entra entre los scripts que escriben)', () => {
    expect(codigo).not.toContain('--aplicar');
  });

  it('control positivo: el detector ve las lecturas que sí hace', () => {
    expect(codigo).toMatch(/\.getFiles\(/);
    expect(codigo).toMatch(/\.getAll\(/);
  });
});
