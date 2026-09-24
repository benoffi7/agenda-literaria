/**
 * **B-1370 — el original de una aceptada que sobra porque la foto se subió
 * después**, probado sin emuladores.
 *
 * El barrido (`borrarOriginalesConCopia`, `functions/propuestas.js`) lo llama
 * `borrarPropuestasVencidas` todos los días. Lo que este archivo fija:
 *
 *  - que borra **un solo caso** —`con-copia-con-original`— y ninguno de los
 *    otros que `clasificarAceptadas` distingue, aunque en todos el original esté
 *    vivo;
 *  - que el borrado pasa por la verificación de B-863 (`borrarOriginalAlAceptar`)
 *    y no por un `delete` propio, y que esa verificación ocurre **antes**;
 *  - que relee la propuesta y no borra si cambió en el medio;
 *  - que el informe del script y la Function usan **la misma** clasificación
 *    (D-88).
 *
 * Los dobles son un Firestore y un bucket en memoria con lo justo que el código
 * usa. El pegamento (`retencion-trigger.js`) no se importa —arrastra
 * `firebase-functions/scheduler`, B-561— y se afirma sobre el fuente.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  CASO_QUE_SE_BORRA_SOLO,
  MAX_ORIGINALES_POR_CORRIDA,
  borrarOriginalesConCopia,
  clasificarAceptadas,
} from '../functions/propuestas.js';
import { clasificarAceptadas as delScript } from '../scripts/flyeres-de-propuestas-aceptadas.mjs';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';

type Doc = Record<string, unknown>;

const leer = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Doc)[k] : undefined), obj);

/**
 * Firestore y Storage en memoria. `relectura` deja que un caso cambie la
 * propuesta **entre** la query y el `getAll` del borrado, que es la carrera que
 * la relectura existe para cubrir.
 */
const mundo = ({
  propuestas = {} as Record<string, Doc>,
  actividades = {} as Record<string, Doc>,
  objetos = [] as string[],
  relectura = {} as Record<string, Doc>,
  fallaAlBorrar = [] as string[],
} = {}) => {
  const vivos = new Set(objetos);
  const pasos: string[] = [];
  const consultas: { valores: string[]; campos: string[] }[] = [];
  const mascaras: Record<string, unknown[]> = {};

  const snap = (coleccion: string, id: string, datos: Doc | undefined) => ({
    id,
    exists: datos !== undefined,
    data: () => datos,
    get: (path: string) => leer(datos, path),
    coleccion,
  });

  const db = {
    collection: (coleccion: string) => ({
      doc: (id: string) => ({ coleccion, id }),
      where: (campo: string, op: string, valores: string[]) => {
        expect(campo).toBe('imagen.storagePath');
        expect(op).toBe('in');
        expect(valores.length).toBeLessThanOrEqual(30);
        return {
          select: (...campos: string[]) => ({
            get: async () => {
              consultas.push({ valores, campos });
              const docs = Object.entries(propuestas)
                .filter(([, p]) => valores.includes(leer(p, 'imagen.storagePath') as string))
                .map(([id, p]) => snap(coleccion, id, p));
              return { docs, size: docs.length };
            },
          }),
        };
      },
    }),
    getAll: async (...args: unknown[]) => {
      const opciones = args.at(-1) as { fieldMask?: string[] };
      const refs = args.slice(0, -1) as { coleccion: string; id: string }[];
      return refs.map((r) => {
        (mascaras[r.coleccion] ??= []).push(opciones?.fieldMask);
        pasos.push(`leer:${r.coleccion}/${r.id}`);
        if (r.coleccion === 'propuestas') {
          return snap(r.coleccion, r.id, relectura[r.id] ?? propuestas[r.id]);
        }
        return snap(r.coleccion, r.id, actividades[r.id]);
      });
    },
  };

  const bucket = {
    getFiles: async ({ prefix }: { prefix: string }) => [
      [...vivos].filter((n) => n.startsWith(prefix)).map((name) => ({ name })),
    ],
    file: (nombre: string) => ({
      exists: async () => {
        pasos.push(`existe?:${nombre}`);
        return [vivos.has(nombre)];
      },
      delete: async () => {
        if (fallaAlBorrar.includes(nombre)) throw new Error('503 de mentira');
        pasos.push(`borrar:${nombre}`);
        vivos.delete(nombre);
      },
    }),
  };

  return { db, bucket, vivos, pasos, consultas, mascaras };
};

const ORIGINAL = 'propuestas/prop_1.jpg';
const COPIA = 'imagenes/img_1.jpg';

const aceptada = (extra: Doc = {}, original = ORIGINAL, actividadId = 'a1'): Doc => ({
  estado: 'aceptada',
  contacto: { mail: 'alguien@ejemplo.com' },
  revision: { actividadId, motivo: 'nota interna' },
  imagen: { storagePath: original },
  ...extra,
});

const conCopia = (copia = COPIA): Doc => ({
  titulo: 'Club X',
  online: { url: 'https://zoom.example/secreto' },
  imagenes: [{ id: 'img_1', url: 'u', storagePath: copia, portada: true }],
});

describe('borrarOriginalesConCopia — B-1370', () => {
  it('el caso seguro: aceptada, actividad con copia viva y original vivo → se borra el original', async () => {
    const m = mundo({
      propuestas: { p1: aceptada() },
      actividades: { a1: conCopia() },
      objetos: [ORIGINAL, COPIA],
    });

    const r = await borrarOriginalesConCopia(m.db, m.bucket);

    expect(r.resultados).toEqual({ p1: 'borrado' });
    expect(r.errores).toEqual({});
    expect(r.pendientes).toEqual({});
    expect(r.porTope).toBe(0);
    expect(m.vivos.has(ORIGINAL), 'el original tenía que irse').toBe(false);
    expect(m.vivos.has(COPIA), 'la copia de la actividad no se toca').toBe(true);
  });

  /**
   * **La verificación de B-863 va antes del borrado, y es la de siempre.** Lo
   * que se mira es que el último `existe?` de la copia y la relectura de la
   * actividad ocurran **después** de la clasificación y **antes** del borrado:
   * es `borrarOriginalAlAceptar` volviendo a mirar, no la clasificación de hace
   * un rato.
   */
  it('antes de borrar relee la propuesta, relee la actividad y vuelve a preguntar por la copia', async () => {
    const m = mundo({
      propuestas: { p1: aceptada() },
      actividades: { a1: conCopia() },
      objetos: [ORIGINAL, COPIA],
    });
    await borrarOriginalesConCopia(m.db, m.bucket);

    const borrado = m.pasos.indexOf(`borrar:${ORIGINAL}`);
    expect(borrado).toBeGreaterThan(0);
    const antes = m.pasos.slice(0, borrado);
    // La cola inmediata antes del borrado es la de B-863: propuesta, actividad, copia.
    expect(antes.slice(-3)).toEqual(['leer:propuestas/p1', 'leer:actividades/a1', `existe?:${COPIA}`]);
  });

  it('no mira, ni guarda en memoria, el contacto ni nada de la actividad fuera de `imagenes`', async () => {
    const m = mundo({
      propuestas: { p1: aceptada() },
      actividades: { a1: conCopia() },
      objetos: [ORIGINAL, COPIA],
    });
    await borrarOriginalesConCopia(m.db, m.bucket);

    const campos = m.consultas.flatMap((c) => c.campos);
    expect(campos).not.toContain('contacto');
    expect(campos.some((c) => c === 'revision' || c === 'revision.motivo')).toBe(false);
    for (const mascara of m.mascaras.actividades ?? []) expect(mascara).toEqual(['imagenes']);
    for (const mascara of m.mascaras.propuestas ?? []) {
      expect(mascara).not.toContain('contacto');
      expect(mascara).not.toContain('revision.motivo');
    }
  });

  /**
   * **Todos los demás casos con el original vivo se quedan como están** — y
   * aparecen en `pendientes` con su caso, que es lo que el log diario dice.
   *
   * MUTACIÓN PROBADA: cambiando el `filter` de `candidatas` por
   * `f.caso.endsWith('-con-original')`, este caso se pone rojo.
   */
  it('no borra ningún otro caso, aunque el original esté vivo', async () => {
    const m = mundo({
      propuestas: {
        sinFoto: aceptada({}, 'propuestas/prop_sf.jpg', 'a-sin-foto'),
        rota: aceptada({}, 'propuestas/prop_rota.jpg', 'a-rota'),
        externa: aceptada({}, 'propuestas/prop_ext.jpg', 'a-externa'),
        sinActividad: aceptada({}, 'propuestas/prop_sa.jpg', 'a-no-existe'),
        descartada: aceptada(
          { revision: { actividadId: 'a1', fotoDescartada: true } },
          'propuestas/prop_desc.jpg',
        ),
      },
      actividades: {
        a1: conCopia(),
        'a-sin-foto': { imagenes: [] },
        'a-rota': conCopia('imagenes/img_que_no_esta.jpg'),
        'a-externa': { imagenes: [{ id: 'x', url: 'https://afuera/x.jpg' }] },
      },
      objetos: [
        COPIA,
        'propuestas/prop_sf.jpg',
        'propuestas/prop_rota.jpg',
        'propuestas/prop_ext.jpg',
        'propuestas/prop_sa.jpg',
        'propuestas/prop_desc.jpg',
      ],
    });

    const r = await borrarOriginalesConCopia(m.db, m.bucket);

    expect(r.resultados).toEqual({});
    expect(m.pasos.filter((p) => p.startsWith('borrar:'))).toEqual([]);
    expect(r.pendientes).toEqual({
      sinFoto: 'sin-foto-con-original',
      rota: 'copia-rota-con-original',
      externa: 'solo-externas-con-original',
      sinActividad: 'sin-actividad-con-original',
      descartada: 'descartada-con-original',
    });
  });

  it('las propuestas que no están aceptadas no se tocan ni se listan', async () => {
    const m = mundo({
      propuestas: {
        abierta: aceptada({ estado: 'nueva' }),
        rechazada: aceptada({ estado: 'rechazada' }, 'propuestas/prop_r.jpg'),
      },
      actividades: { a1: conCopia() },
      objetos: [ORIGINAL, 'propuestas/prop_r.jpg', COPIA],
    });
    const r = await borrarOriginalesConCopia(m.db, m.bucket);
    expect(r).toMatchObject({ resultados: {}, pendientes: {} });
    expect(m.vivos.has(ORIGINAL)).toBe(true);
  });

  it('si el original ya no está, no hay nada que hacer (en orden)', async () => {
    const m = mundo({
      propuestas: { p1: aceptada() },
      actividades: { a1: conCopia() },
      objetos: [COPIA],
    });
    const r = await borrarOriginalesConCopia(m.db, m.bucket);
    expect(r).toMatchObject({ resultados: {}, pendientes: {} });
    // Sin objetos en `propuestas/`, ni siquiera se consulta Firestore.
    expect(m.consultas).toEqual([]);
  });

  /**
   * **La relectura de la propuesta** — la carrera que la clasificación no ve:
   * entre la query y el borrado un admin la reabre, o le cambia la actividad.
   */
  it('si la propuesta cambió en el medio de la corrida, no borra', async () => {
    for (const cambio of [
      { estado: 'nueva' },
      { revision: { actividadId: 'otra' } },
      { revision: { actividadId: 'a1', fotoDescartada: true } },
      { imagen: { storagePath: 'propuestas/prop_otro.jpg' } },
    ]) {
      const m = mundo({
        propuestas: { p1: aceptada() },
        actividades: { a1: conCopia() },
        objetos: [ORIGINAL, COPIA],
        relectura: { p1: aceptada(cambio) },
      });
      const r = await borrarOriginalesConCopia(m.db, m.bucket);
      expect(r.resultados, JSON.stringify(cambio)).toEqual({ p1: 'cambio-la-propuesta' });
      expect(m.vivos.has(ORIGINAL)).toBe(true);
    }
  });

  it('si la propuesta se borró en el medio, no borra nada', async () => {
    const m = mundo({
      propuestas: { p1: aceptada() },
      actividades: { a1: conCopia() },
      objetos: [ORIGINAL, COPIA],
    });
    // La query la vio; la relectura del borrado ya no la encuentra.
    const { db } = m;
    const original = db.getAll;
    db.getAll = async (...args: unknown[]) => {
      const [ref] = args as { coleccion: string; id: string }[];
      if (ref.coleccion === 'propuestas') return [{ exists: false, get: () => undefined }] as never;
      return original(...args);
    };
    const r = await borrarOriginalesConCopia(db, m.bucket);
    expect(r.resultados).toEqual({ p1: 'ya-no-esta' });
    expect(m.vivos.has(ORIGINAL)).toBe(true);
  });

  it('respeta el tope por corrida y dice cuántas quedaron para mañana', async () => {
    const propuestas: Record<string, Doc> = {};
    const objetos = [COPIA];
    for (const i of [1, 2, 3]) {
      propuestas[`p${i}`] = aceptada({}, `propuestas/prop_${i}.jpg`);
      objetos.push(`propuestas/prop_${i}.jpg`);
    }
    const m = mundo({ propuestas, actividades: { a1: conCopia() }, objetos });
    const r = await borrarOriginalesConCopia(m.db, m.bucket, { tope: 2 });
    expect(Object.keys(r.resultados)).toHaveLength(2);
    expect(r.porTope).toBe(1);
    expect(MAX_ORIGINALES_POR_CORRIDA).toBeGreaterThan(0);
  });

  it('un fallo en una fila no corta las demás', async () => {
    const m = mundo({
      propuestas: {
        p1: aceptada({}, 'propuestas/prop_1.jpg'),
        p2: aceptada({}, 'propuestas/prop_2.jpg'),
      },
      actividades: { a1: conCopia() },
      objetos: [COPIA, 'propuestas/prop_1.jpg', 'propuestas/prop_2.jpg'],
      fallaAlBorrar: ['propuestas/prop_1.jpg'],
    });
    const r = await borrarOriginalesConCopia(m.db, m.bucket);
    expect(r.errores).toEqual({ p1: '503 de mentira' });
    expect(r.resultados).toEqual({ p2: 'borrado' });
    expect(m.vivos.has('propuestas/prop_2.jpg')).toBe(false);
  });

  it('busca los documentos de a 30 por `in`, y solo los que nombran un objeto vivo', async () => {
    const objetos = Array.from({ length: 31 }, (_, i) => `propuestas/prop_${i}.jpg`);
    // Un anidado y el prefijo pelado no son el original de nadie: no se consultan.
    objetos.push('propuestas/a/b.jpg');
    const m = mundo({ objetos });
    await borrarOriginalesConCopia(m.db, m.bucket);
    expect(m.consultas.map((c) => c.valores.length)).toEqual([30, 1]);
    expect(m.consultas.flatMap((c) => c.valores)).not.toContain('propuestas/a/b.jpg');
  });
});

describe('una sola clasificación para el informe y para el barrido — D-88', () => {
  it('el script re-exporta la de functions/, no tiene una propia', () => {
    expect(delScript).toBe(clasificarAceptadas);
    const script = sinComentarios(readFileSync('scripts/flyeres-de-propuestas-aceptadas.mjs', 'utf8'));
    expect(script).not.toMatch(/const clasificarAceptadas\s*=/);
    expect(script).not.toMatch(/copiasEnLaGaleria\(/);
  });

  it('el caso que se borra solo es uno de los que el informe conoce', async () => {
    const { CASOS } = await import('../scripts/flyeres-de-propuestas-aceptadas.mjs');
    expect(Object.keys(CASOS)).toContain(CASO_QUE_SE_BORRA_SOLO);
    expect(CASO_QUE_SE_BORRA_SOLO).toBe('con-copia-con-original');
  });
});

describe('el cableado, afirmado sobre el fuente', () => {
  const propuestas = sinComentarios(readFileSync('functions/propuestas.js', 'utf8'));
  const trigger = sinComentarios(readFileSync('functions/retencion-trigger.js', 'utf8'));

  /**
   * **El barrido no tiene un `delete` propio.** El único borrado del original
   * que alcanza es el de `borrarOriginalAlAceptar`, después de su verificación.
   * Un `.delete(` crudo en estas funciones sería una segunda puerta a perder la
   * foto sin copia.
   */
  it('el único borrado es el de `borrarOriginalAlAceptar`', () => {
    const desde = propuestas.indexOf('export const clasificarAceptadas');
    expect(desde, 'no se encontró el bloque de B-1370').toBeGreaterThan(0);
    const bloque = propuestas.slice(desde);
    expect(bloque).not.toMatch(/\.delete\(/);
    expect(bloque).toContain('return borrarOriginalAlAceptar(db, bucket, { objeto: original, actividadId });');
  });

  it('corre en el `finally` de la retención, así que corre aunque la retención no borre nada', () => {
    const handler = trigger.slice(
      trigger.indexOf('export const borrarPropuestasVencidas'),
      trigger.indexOf('export const borrarFichasVencidas'),
    );
    const fin = handler.indexOf('} finally {');
    expect(fin, 'la segunda mitad dejó de ir en el `finally`').toBeGreaterThan(0);
    expect(handler.indexOf('barrerOriginalesConCopia(db, bucket)', fin)).toBeGreaterThan(fin);
  });

  it('el barrido de originales atrapa sus propios errores', () => {
    const cuerpo = trigger.slice(
      trigger.indexOf('const barrerOriginalesConCopia'),
      trigger.indexOf('export const borrarPropuestasVencidas'),
    );
    expect(cuerpo).toContain('try {');
    expect(cuerpo).toContain('falló el barrido de originales de aceptadas');
  });
});
