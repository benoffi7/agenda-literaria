import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  leerSeccionRecordada,
  recordarSeccion,
  seccionArrancaAbierta,
  type AlmacenDeSecciones,
} from '@/components/admin/campos/Seccion';

/**
 * B-193 — la vista previa del evento ya existía y quien la pidió no la encontró.
 *
 * No faltaba la función: faltaba **poder encontrarla**. Era la última sección del
 * formulario, arrancaba colapsada, y el reporte salió desde el listado. El ítem
 * dice explícitamente qué no es el arreglo —explicarlo mejor en la guía, que ya
 * lo explicaba—, así que el arreglo es que nazca abierta y recuerde lo que se
 * decidió después.
 *
 * Lo que se testea acá es la memoria (lógica pura, con el almacén como puerto) y
 * que la sección de la vista previa la use: la memoria puede estar perfecta y la
 * sección seguir naciendo cerrada.
 */

/** Almacén de mentira, y uno que tira: `localStorage` hace las dos cosas. */
const almacenFalso = (inicial: Record<string, string> = {}) => {
  const datos = { ...inicial };
  return {
    datos,
    puerto: {
      getItem: (k: string) => datos[k] ?? null,
      setItem: (k: string, v: string) => {
        datos[k] = v;
      },
    } satisfies AlmacenDeSecciones,
  };
};

const almacenQueTira: AlmacenDeSecciones = {
  getItem: () => {
    throw new Error('modo privado');
  },
  setItem: () => {
    throw new Error('cuota llena');
  },
};

describe('con qué estado arranca una sección', () => {
  it('una sección no colapsable está siempre abierta, pase lo que pase', () => {
    expect(
      seccionArrancaAbierta({ colapsable: false, abiertaPorDefecto: false, recordada: false }),
    ).toBe(true);
  });

  it('sin memoria manda el default de la sección', () => {
    expect(
      seccionArrancaAbierta({ colapsable: true, abiertaPorDefecto: true, recordada: null }),
    ).toBe(true);
    expect(
      seccionArrancaAbierta({ colapsable: true, abiertaPorDefecto: false, recordada: null }),
    ).toBe(false);
  });

  it('con memoria manda la memoria, en las dos direcciones', () => {
    // Ésta es la mitad que evita el otro extremo de B-193: abrirla siempre
    // castiga a quien ya la conoce y la cerró a propósito.
    expect(
      seccionArrancaAbierta({ colapsable: true, abiertaPorDefecto: true, recordada: false }),
    ).toBe(false);
    expect(
      seccionArrancaAbierta({ colapsable: true, abiertaPorDefecto: false, recordada: true }),
    ).toBe(true);
  });
});

describe('la memoria de una sección', () => {
  it('lo que se guarda se vuelve a leer', () => {
    const { puerto } = almacenFalso();
    recordarSeccion(puerto, 'vista-previa', false);
    expect(leerSeccionRecordada(puerto, 'vista-previa')).toBe(false);
    recordarSeccion(puerto, 'vista-previa', true);
    expect(leerSeccionRecordada(puerto, 'vista-previa')).toBe(true);
  });

  it('cada sección tiene su clave: cerrar una no cierra la otra', () => {
    const { puerto } = almacenFalso();
    recordarSeccion(puerto, 'vista-previa', false);
    expect(leerSeccionRecordada(puerto, 'material')).toBeNull();
  });

  it('la clave lleva prefijo, para no chocar con lo demás del navegador', () => {
    const { datos, puerto } = almacenFalso();
    recordarSeccion(puerto, 'vista-previa', true);
    const claves = Object.keys(datos);
    expect(claves).toHaveLength(1);
    expect(claves[0]).toBe('agenda:seccion:vista-previa');
  });

  /**
   * §5.1 — lo guardado tiene que ser una preferencia y nada más. El borrador
   * local lleva la huella del admin en la clave justamente porque guarda
   * contenido; acá no hay nada que proteger, y este chequeo es lo que impide que
   * mañana alguien meta algo del formulario en la misma clave.
   */
  it('lo guardado es «abierta» o «cerrada», nada más', () => {
    const { datos, puerto } = almacenFalso();
    recordarSeccion(puerto, 'vista-previa', true);
    recordarSeccion(puerto, 'material', false);
    expect([...new Set(Object.values(datos))].sort()).toEqual(['abierta', 'cerrada']);
  });

  it('un valor ajeno en la clave no se cree ni abierto ni cerrado', () => {
    const { puerto } = almacenFalso({ 'agenda:seccion:vista-previa': 'true' });
    expect(leerSeccionRecordada(puerto, 'vista-previa')).toBeNull();
  });

  it('sin clave no hay memoria: es el comportamiento de siempre', () => {
    const { datos, puerto } = almacenFalso();
    expect(leerSeccionRecordada(puerto, undefined)).toBeNull();
    recordarSeccion(puerto, undefined, true);
    expect(Object.keys(datos)).toHaveLength(0);
  });

  it('sin almacén tampoco, y no tira', () => {
    expect(leerSeccionRecordada(null, 'vista-previa')).toBeNull();
    expect(() => recordarSeccion(null, 'vista-previa', true)).not.toThrow();
  });

  it('un almacén que tira se cae al default en vez de romper el formulario', () => {
    // `localStorage` **tira** —no devuelve null— en modo privado y con la cuota
    // llena, y un acordeón no puede llevarse puesta la isla del panel por eso.
    expect(leerSeccionRecordada(almacenQueTira, 'vista-previa')).toBeNull();
    expect(() => recordarSeccion(almacenQueTira, 'vista-previa', true)).not.toThrow();
  });
});

/**
 * Que la vista previa **use** la memoria y ya no nazca cerrada. Es la mitad que
 * el reporte pedía, y la que ninguna función pura puede garantizar.
 */
describe('la sección de la vista previa nace abierta y se acuerda', () => {
  const RUTA = 'src/components/admin/formulario/SeccionVistaPrevia.tsx';

  /** Sin comentarios: este archivo cuenta en prosa que antes nacía cerrada. */
  const seccion = (): string =>
    readFileSync(RUTA, 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\s+/g, ' ');

  it('ya no arranca colapsada', () => {
    expect(seccion()).not.toContain('abiertaPorDefecto={false}');
  });

  it('y recuerda cómo la dejaron', () => {
    expect(seccion()).toContain('recuerdaComo="vista-previa"');
  });

  it('sigue siendo colapsable: poder cerrarla es la otra mitad', () => {
    // Además, `camposFaltantes.ts` la declara colapsable y
    // `tests/campos-faltantes.test.ts` compara las dos listas.
    expect(seccion()).toContain('colapsable');
  });

  /**
   * Las otras cuatro secciones colapsables **no** cambian de default acá, y no es
   * un olvido: B-193 midió que no se encontraba la vista previa, no las demás. Si
   * mañana se abre otra, que sea porque hay un reporte y no de arrastre.
   */
  it('ninguna otra sección cambió de default de arrastre', () => {
    const otras = readdirSync('src/components/admin/formulario')
      .filter((f) => f.startsWith('Seccion') && f.endsWith('.tsx') && f !== 'SeccionVistaPrevia.tsx')
      .map((f) => ({
        archivo: f,
        src: readFileSync(`src/components/admin/formulario/${f}`, 'utf8'),
      }));
    const colapsablesCerradas = otras
      .filter((o) => /abiertaPorDefecto=\{false\}/.test(o.src))
      .map((o) => o.archivo)
      .sort();
    expect(colapsablesCerradas).toEqual(['SeccionDifusion.tsx', 'SeccionOpcional.tsx']);
    // Material no está en esa lista porque su default no es un literal: se abre
    // sola cuando la actividad tiene material o es un club. Se afirma aparte
    // para que la lista de arriba no la deje pasar por omisión.
    const material = otras.find((o) => o.archivo === 'SeccionMaterial.tsx')?.src ?? '';
    expect(material).toContain('abiertaPorDefecto={esClub || form.material.tiene}');
  });
});
