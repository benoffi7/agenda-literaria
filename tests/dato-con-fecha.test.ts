/**
 * **El dato que envejece** — B-837, el mecanismo compartido de DEC-12.
 *
 * Las tres reglas de los PRDs (`prd/02-librerias.md` § 6,
 * `prd/03-suscripciones-literarias.md` § 6) verificadas como propiedades del
 * módulo y no como recomendaciones:
 *
 * 1. la fecha se muestra siempre que se muestra el dato, y **el dato no se
 *    muestra sin fecha**;
 * 2. la proyección pública es un string, así que no hay número que filtrar ni
 *    ordenar (D-570);
 * 3. el panel avisa a los 60 días.
 *
 * El PRD dice, textual, que la primera «lo sostiene un test, no la disciplina», y
 * este es ese test. Los casos de fecha rota no son teóricos: el `cargadoEn` llega
 * de Firestore y puede venir ausente, en `null` o como string —un documento
 * anterior al campo, un script, una restauración desde el historial—.
 */
import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  DIAS_PARA_REVISAR,
  diasDesdeLaCarga,
  fraseConFecha,
  pideRevision,
  type DatoConFecha,
} from '@/lib/datoConFecha';

/** 24 de septiembre de 2026, 19:00 en Buenos Aires (22:00 UTC). */
const CARGA = new Date('2026-09-24T22:00:00Z');

const dato = <T>(valor: T, cuando: Date = CARGA): DatoConFecha<T> => ({
  valor,
  cargadoEn: Timestamp.fromDate(cuando),
});

/** El `formatear` de una suscripción, que es el ejemplo del PRD. */
const comoPrecio = (n: number): string => `$${n.toLocaleString('es-AR')} por mes`;

const diasDespues = (n: number): Date => new Date(CARGA.getTime() + n * 24 * 60 * 60 * 1000);

describe('regla 1 · el valor y su fecha salen juntos o no sale ninguno', () => {
  it('la frase lleva las dos cosas, con el separador del sitio', () => {
    expect(fraseConFecha(dato(18000), comoPrecio)).toBe(
      '$18.000 por mes · cargado el 24 de septiembre de 2026',
    );
  });

  it('la fecha es la de Buenos Aires y no la del proceso (trampa 1)', () => {
    // 01:00 UTC del 1 de septiembre son las 22:00 del 31 de agosto acá. Si el
    // formateo no llevara `timeZone` explícito, esto diría «1 de septiembre» —y
    // en una máquina en UTC diría lo otro, que es el modo de falla que importa:
    // pasa en las dos y miente en una.
    const cruce = new Date('2026-09-01T01:00:00Z');
    expect(fraseConFecha(dato('30 % los martes', cruce), (s) => s)).toBe(
      '30 % los martes · cargado el 31 de agosto de 2026',
    );
  });

  it('lleva el año, que es lo que deja decidir si el dato sirve', () => {
    // Sin año, «cargado el 24 de septiembre» no dice si es de hace una semana o
    // de hace tres años, y ese juicio es el único trabajo de esta fecha.
    expect(fraseConFecha(dato(18000), comoPrecio)).toContain('de 2026');
  });

  it('sin dato no hay frase', () => {
    expect(fraseConFecha(null, comoPrecio)).toBe('');
    expect(fraseConFecha(undefined, comoPrecio)).toBe('');
  });

  /**
   * **La mitad que importa de la regla 1**, y va en los tres sentidos en que la
   * fecha puede faltar. Un valor sin su fecha es justo lo que no se puede
   * publicar, así que desaparece en vez de salir solo.
   */
  it('con el valor cargado y la fecha ausente, el valor NO sale', () => {
    const huerfano = { valor: 18000 } as unknown as DatoConFecha<number>;
    expect(fraseConFecha(huerfano, comoPrecio)).toBe('');
  });

  it('con la fecha en null tampoco', () => {
    const huerfano = { valor: 18000, cargadoEn: null } as unknown as DatoConFecha<number>;
    expect(fraseConFecha(huerfano, comoPrecio)).toBe('');
  });

  it('con la fecha como string tampoco, y sin tirar', () => {
    // Un `.toDate()` sobre un string tira, y acá tirar sería peor que no mostrar
    // nada: rompería el build de una página por un campo opcional.
    const crudo = { valor: 18000, cargadoEn: '2026-09-24' } as unknown as DatoConFecha<number>;
    expect(() => fraseConFecha(crudo, comoPrecio)).not.toThrow();
    expect(fraseConFecha(crudo, comoPrecio)).toBe('');
  });

  it('con un `Timestamp` que no representa una fecha, tampoco', () => {
    const roto = { valor: 18000, cargadoEn: { toDate: () => new Date(NaN) } } as DatoConFecha<number>;
    expect(fraseConFecha(roto, comoPrecio)).toBe('');
  });

  it('y una fecha suelta tampoco sale: si el valor se formatea vacío, no hay frase', () => {
    // El caso real es un texto libre en blanco. «cargado el 24 de septiembre»
    // solo, sin decir de qué, es peor que no decir nada.
    expect(fraseConFecha(dato('   '), (s) => s)).toBe('');
    expect(fraseConFecha(dato(0), () => '')).toBe('');
  });
});

describe('regla 2 · la proyección es un string, así que no hay nada que filtrar', () => {
  /**
   * D-570 — la regla la impone la forma. No hay en el módulo ninguna función que
   * devuelva el valor solo, así que un consumidor que quiera filtrar por precio
   * tiene que ir a buscar `dato.valor` al documento **a mano**, y eso se ve en la
   * review. La alternativa —proyectar `{ valor, cargadoEn }` y confiar en que
   * nadie lo compare— es la que este proyecto ya sabe que no funciona.
   */
  it('el módulo no exporta ninguna forma de sacar el valor solo', async () => {
    const modulo = await import('@/lib/datoConFecha');
    expect(Object.keys(modulo).sort()).toEqual([
      'DIAS_PARA_REVISAR',
      'diasDesdeLaCarga',
      'fraseConFecha',
      'pideRevision',
    ]);
  });

  it('la frase es inservible como número', () => {
    const frase = fraseConFecha(dato(18000), comoPrecio);
    expect(Number(frase)).toBeNaN();
    // Y ordenar dos frases no ordena precios: «$9.000» va después de «$18.000».
    expect(
      [fraseConFecha(dato(18000), comoPrecio), fraseConFecha(dato(9000), comoPrecio)].sort(),
    ).toEqual([
      '$18.000 por mes · cargado el 24 de septiembre de 2026',
      '$9.000 por mes · cargado el 24 de septiembre de 2026',
    ]);
  });
});

describe('regla 3 · el panel avisa a los 60 días', () => {
  it('el plazo es el de los dos PRDs y vive en un solo lugar', () => {
    expect(DIAS_PARA_REVISAR).toBe(60);
  });

  it('cuenta los días cumplidos, redondeando para abajo', () => {
    expect(diasDesdeLaCarga(dato(1), CARGA)).toBe(0);
    expect(diasDesdeLaCarga(dato(1), new Date(CARGA.getTime() + 23 * 60 * 60 * 1000))).toBe(0);
    expect(diasDesdeLaCarga(dato(1), diasDespues(59))).toBe(59);
    expect(diasDesdeLaCarga(dato(1), diasDespues(60))).toBe(60);
  });

  it('el día 59 no pide revisión y el 60 sí', () => {
    expect(pideRevision(dato(1), diasDespues(59))).toBe(false);
    expect(pideRevision(dato(1), diasDespues(60))).toBe(true);
    expect(pideRevision(dato(1), diasDespues(400))).toBe(true);
  });

  it('sin dato no hay nada que revisar', () => {
    expect(pideRevision(null, diasDespues(400))).toBe(false);
    expect(diasDesdeLaCarga(null, CARGA)).toBe(null);
  });

  /**
   * **El caso que ata las dos reglas.** Un dato sin fecha usable es el único que
   * el sitio no publica (regla 1), así que sin este aviso quedaría cargado,
   * invisible y sin que nadie se enterara. Es el mismo criterio que hace que
   * `fraseConFecha` devuelva vacío en vez de tirar: el problema no se esconde, se
   * mueve al panel.
   */
  it('un dato sin fecha usable pide revisión aunque no se sepa su edad', () => {
    const huerfano = { valor: 18000 } as unknown as DatoConFecha<number>;
    expect(fraseConFecha(huerfano, comoPrecio)).toBe('');
    expect(diasDesdeLaCarga(huerfano, CARGA)).toBe(null);
    expect(pideRevision(huerfano, CARGA)).toBe(true);
  });

  it('una fecha futura da días negativos y no cero', () => {
    // El panel tiene que poder ver que el dato está mal, no que está fresco.
    expect(diasDesdeLaCarga(dato(1, diasDespues(10)), CARGA)).toBe(-10);
    expect(pideRevision(dato(1, diasDespues(10)), CARGA)).toBe(false);
  });
});
