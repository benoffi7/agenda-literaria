/**
 * **B-904 / B-912 / B-917 — una ficha de la Guía tampoco se guarda para
 * siempre.**
 *
 * Es DEC-13 sin contestar, tres veces: `contactoDeQuienCargo` es el mismo dato
 * que el `contacto` de una propuesta —el mail, el WhatsApp o el Instagram de
 * alguien que no está logueado— y hasta acá una ficha `rechazado` lo conservaba
 * sin plazo, porque las tres colecciones no tenían ninguna Function. Lo único
 * que había era el borrado a mano, que depende de que alguien se acuerde: justo
 * lo que B-838 decidió no aceptar.
 *
 * Este archivo prueba la decisión pura (`decidirRetencionDeFichas` y la tabla).
 * El borrado contra Firestore —la precondición de B-864— vive en
 * `tests/retencion-de-guias.integracion.test.ts`, que es donde se puede afirmar
 * que una ficha tocada durante la corrida se salva.
 *
 * **Lo que NO prueba, porque no existe:** ningún borrado de Storage. Una ficha
 * usa el mismo `GaleriaEditor` que una actividad, así que sus fotos viven en
 * `imagenes/` y las levanta `limpiarImagenesHuerfanas` — desde B-922, que es el
 * cambio que lo hizo cierto.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ESTADOS_DE_FICHA_QUE_CADUCAN,
  ESTADO_RECHAZADO_DE_FICHA,
  FICHAS_POR_PAGINA,
  MARGEN_DE_RETENCION_FICHA_MS,
  MARGEN_SIN_TOCAR_FICHA_MS,
  MAX_FICHAS_POR_CORRIDA,
  RETENCION_DE_FICHA_POR_ESTADO,
  decidirRetencionDeFichas,
  fichasVencibles,
} from '../functions/retencion.js';
import { COLECCIONES_DE_DIRECTORIO } from '../functions/directorios.js';
import { ESTADOS_DIRECTORIO } from '@/lib/directorios';
// El doble de `Timestamp` del repo, uno y solo uno (B-211).
import { tsDe } from './fixtures/tiempo';

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.parse('2026-09-15T12:00:00Z');
const haceDias = (n: number) => tsDe(new Date(AHORA - n * DIA));

/** Una ficha con lo mínimo que la decisión mira. */
const ficha = (id: string, estado: string, campos: Record<string, unknown> = {}) => ({
  id,
  estado,
  updateTime: { isEqual: () => true },
  ...campos,
});

describe('la tabla de plazos de una ficha', () => {
  it('nombra exactamente los tres estados de ESTADOS_DIRECTORIO', () => {
    // Dos vocabularios del mismo ciclo de vida se separan sin que nada falle, y
    // acá el síntoma sería silencioso: un estado que la tabla no nombra **no
    // caduca**, así que el plazo deja de correr sin ningún error.
    //
    // Mutación: agregar un estado a `ESTADOS_DIRECTORIO` sin tocar la tabla.
    expect(Object.keys(RETENCION_DE_FICHA_POR_ESTADO).sort()).toEqual([...ESTADOS_DIRECTORIO].sort());
  });

  it('`publicado` no vence, y es una decisión', () => {
    // Una ficha publicada está en el sitio: su contacto es lo que deja avisarle
    // a la librería que su ficha existe o darla de baja cuando cierra. Mismo
    // argumento que la propuesta `aceptada`.
    //
    // Este caso es el que se pone rojo si alguien le pone un número «por
    // simetría» con los otros dos.
    expect(RETENCION_DE_FICHA_POR_ESTADO.publicado).toBeNull();
  });

  it('los dos plazos son 30 días, y son dos constantes', () => {
    expect(MARGEN_DE_RETENCION_FICHA_MS).toBe(30 * DIA);
    expect(MARGEN_SIN_TOCAR_FICHA_MS).toBe(30 * DIA);
    // Hoy son iguales **y eso no es una atadura**: son dos decisiones que
    // coinciden. El aserto está al revés a propósito, para que nadie las una
    // escribiendo `= MARGEN_DE_RETENCION_FICHA_MS` por prolijidad — el día que
    // el dueño mueva una, la otra no tiene por qué moverse.
    expect(fuente('functions/retencion.js')).toContain(
      'export const MARGEN_SIN_TOCAR_FICHA_MS = 30 * 24 * 60 * 60 * 1000;',
    );
  });

  it('los estados que caducan se DERIVAN de la tabla, no se escriben al lado', () => {
    // El modo de falla obvio: la tabla dice que caduca, la query no lo trae, no
    // caduca nunca y nada falla.
    expect([...ESTADOS_DE_FICHA_QUE_CADUCAN].sort()).toEqual(['pendiente', 'rechazado']);
  });

  it('el estado terminal declarado es el de una ficha, no el de una propuesta', () => {
    // `relojDeRetencion` lo recibe por parámetro: con `'rechazada'` —el de las
    // propuestas— una ficha descartada caería al reloj de «la última señal de
    // vida», que es el mismo campo pero **otro plazo**, y lo haría en silencio.
    expect(ESTADO_RECHAZADO_DE_FICHA).toBe('rechazado');
    expect(ESTADOS_DIRECTORIO).toContain(ESTADO_RECHAZADO_DE_FICHA);
  });
});

describe('decidirRetencionDeFichas — qué caducó', () => {
  it('una rechazada hace 31 días se va, y cuenta desde el rechazo', () => {
    const { aBorrar, motivos } = decidirRetencionDeFichas({
      fichas: [
        ficha('vieja', 'rechazado', {
          // Llegó hace un año y se descartó hace 31 días: el reloj es el
          // rechazo (DEC-13), no la llegada.
          creadoEn: haceDias(365),
          revision: { en: haceDias(31) },
        }),
      ],
      ahora: AHORA,
    });
    expect(aBorrar.map((f) => f.id)).toEqual(['vieja']);
    expect(motivos.vieja).toBe('rechazada-vencida');
  });

  it('una rechazada hace 29 días se queda', () => {
    const { aBorrar, motivos } = decidirRetencionDeFichas({
      fichas: [ficha('nueva', 'rechazado', { revision: { en: haceDias(29) } })],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(motivos.nueva).toBe('dentro-del-plazo');
  });

  it('una rechazada SIN fecha de revisión legible no se borra — falla cerrado', () => {
    // Borrarla a los 30 días de haber llegado sería otro plazo, decidido por
    // accidente. Es la misma propiedad que sostiene la retención de propuestas.
    const { aBorrar, motivos } = decidirRetencionDeFichas({
      fichas: [ficha('sinfecha', 'rechazado', { creadoEn: haceDias(400), revision: {} })],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(motivos.sinfecha).toBe('sin-fecha-legible');
  });

  it('una pendiente que nadie tocó en 31 días se va — el caso del formulario público', () => {
    // Es el que hace falta de verdad: la ficha que llegó por `/guia/<x>/sumar`,
    // no interesó y quedó ahí. Sin este plazo la única forma de que caduque
    // sería que un admin apretara «Descartar», o sea la dependencia que la
    // retención automática viene a sacar.
    const { aBorrar, motivos } = decidirRetencionDeFichas({
      fichas: [ficha('olvidada', 'pendiente', { creadoEn: haceDias(31) })],
      ahora: AHORA,
    });
    expect(aBorrar.map((f) => f.id)).toEqual(['olvidada']);
    expect(motivos.olvidada).toBe('sin-mirar-vencida');
  });

  it('una pendiente vieja que un admin REABRIÓ ayer se queda', () => {
    // El caso que el reloj de «la última señal de vida» existe para cubrir: una
    // descartada que se reabre vuelve a `pendiente` con un `creadoEn` de hace
    // meses. Contando desde la llegada, el barrido de esa misma noche se lleva
    // la ficha que un admin acaba de rescatar a mano.
    const { aBorrar, motivos } = decidirRetencionDeFichas({
      fichas: [
        ficha('reabierta', 'pendiente', {
          creadoEn: haceDias(200),
          revision: { en: haceDias(1) },
        }),
      ],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(motivos.reabierta).toBe('dentro-del-plazo');
  });

  it('una publicada NO se borra, por vieja que sea', () => {
    const { aBorrar, motivos } = decidirRetencionDeFichas({
      fichas: [ficha('viva', 'publicado', { creadoEn: haceDias(900), revision: { en: haceDias(900) } })],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    // Con esas palabras y no `estado-publicado`, que se leería como «cayó acá
    // porque el filtro no la contemplaba».
    expect(motivos.viva).toBe('publicado-no-vence');
  });

  it('un estado que la tabla no nombra no caduca', () => {
    // Agregar un estado no puede empezar a borrar documentos de rebote.
    const { aBorrar, motivos } = decidirRetencionDeFichas({
      fichas: [ficha('rara', 'archivada', { creadoEn: haceDias(900) })],
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(motivos.rara).toBe('estado-archivada');
  });

  it('el tope de la corrida es el de las fichas, no el de las propuestas', () => {
    const fichas = Array.from({ length: MAX_FICHAS_POR_CORRIDA + 3 }, (_, i) =>
      ficha(`f${i}`, 'rechazado', { revision: { en: haceDias(60) } }),
    );
    const { aBorrar, motivos } = decidirRetencionDeFichas({ fichas, ahora: AHORA });
    expect(aBorrar).toHaveLength(MAX_FICHAS_POR_CORRIDA);
    expect(Object.values(motivos).filter((m) => m.endsWith('-pendiente-por-tope'))).toHaveLength(3);
  });

  it('ninguna ficha arrastra un objeto de Storage', () => {
    // La diferencia con las propuestas, dicha como aserto: acá `objeto` es
    // siempre `null` porque las fotos de una ficha viven en `imagenes/` y las
    // levanta `limpiarImagenesHuerfanas` (B-922). Duplicar el borrado sería una
    // segunda implementación de la misma idea, y la que se equivoque de prefijo
    // borra la imagen de una actividad publicada.
    const { aBorrar } = decidirRetencionDeFichas({
      fichas: [ficha('x', 'rechazado', { revision: { en: haceDias(60) } })],
      ahora: AHORA,
    });
    expect(aBorrar[0].objeto).toBeNull();
  });
});

describe('fichasVencibles — qué se lee, y qué NO entra a memoria', () => {
  /** Un `db` falso con la superficie que `fichasVencibles` usa. */
  const dbFalso = (paginas: Record<string, unknown>[][]) => {
    const visto: { coleccion?: string; estados?: unknown; campos?: unknown[]; limite?: number } = {};
    let n = 0;
    const query = {
      where: (_campo: string, _op: string, valores: unknown) => {
        visto.estados = valores;
        return query;
      },
      select: (...campos: unknown[]) => {
        visto.campos = campos;
        return query;
      },
      startAfter: () => query,
      limit: (l: number) => {
        visto.limite = l;
        return {
          get: async () => {
            const docs = paginas[n++] ?? [];
            return {
              size: docs.length,
              docs: docs.map((d) => ({
                id: String(d.id),
                get: (c: string) => (d as Record<string, unknown>)[c.split('.')[0]],
                updateTime: {},
              })),
            };
          },
        };
      },
    };
    return {
      db: { collection: (c: string) => ((visto.coleccion = c), query) },
      visto,
    };
  };

  it('pide solo los estados que caducan y proyecta tres campos', async () => {
    // El `select` no es una optimización: es lo que hace que el
    // `contactoDeQuienCargo` —el dato personal del tercero— y el motivo del
    // rechazo —una nota interna sobre el trabajo de otra persona— **no entren a
    // la memoria de la Function** ni puedan caer en un log.
    //
    // Mutación: borrar el `.select(...)`. Este caso se pone rojo.
    const { db, visto } = dbFalso([[]]);
    await fichasVencibles(db as never, 'librerias');
    expect(visto.coleccion).toBe('librerias');
    expect(visto.estados).toEqual(ESTADOS_DE_FICHA_QUE_CADUCAN);
    expect(visto.campos).toEqual(['estado', 'creadoEn', 'revision.en']);
    expect(visto.limite).toBe(FICHAS_POR_PAGINA);
  });

  it('pagina hasta que la colección se termina', async () => {
    const llena = Array.from({ length: FICHAS_POR_PAGINA }, (_, i) => ({
      id: `a${i}`,
      estado: 'pendiente',
      creadoEn: haceDias(1),
    }));
    const { db } = dbFalso([llena, [{ id: 'ultima', estado: 'pendiente', creadoEn: haceDias(1) }]]);
    const leidas = await fichasVencibles(db as never, 'lugares', { ahora: AHORA });
    expect(leidas).toHaveLength(FICHAS_POR_PAGINA + 1);
  });

  it('corta de leer apenas lo leído llena el tope de borrados', async () => {
    // El corte es **por trabajo y no por cantidad leída** (B-865): si lo que ya
    // se leyó llena el tope, la página siguiente no cambiaría nada.
    const vencidas = Array.from({ length: FICHAS_POR_PAGINA }, (_, i) => ({
      id: `v${i}`,
      estado: 'rechazado',
      revision: { en: haceDias(60) },
    }));
    const { db } = dbFalso([vencidas, [{ id: 'nunca-leida', estado: 'rechazado' }]]);
    const leidas = await fichasVencibles(db as never, 'suscripciones', { ahora: AHORA });
    expect(leidas).toHaveLength(FICHAS_POR_PAGINA);
    expect(leidas.map((f) => f.id)).not.toContain('nunca-leida');
  });
});

describe('el barrido corre sobre las tres guías y se deriva de una sola lista', () => {
  it('el trigger recorre COLECCIONES_DE_DIRECTORIO y no una lista propia', () => {
    // La cuarta guía tiene que entrar sola. Una lista escrita al lado es la que
    // queda vieja — es lo que B-922 acaba de cobrar en `limpieza-imagenes.js`.
    const src = fuente('functions/retencion-trigger.js');
    expect(src).toContain('for (const coleccion of COLECCIONES_DE_DIRECTORIO)');
    for (const c of COLECCIONES_DE_DIRECTORIO) {
      expect(src).not.toContain(`'${c}'`);
    }
  });

  it('está exportada desde `index.js`: una Function que no se exporta no se despliega', () => {
    expect(fuente('functions/index.js')).toContain('export { borrarFichasVencidas }');
  });

  it('una colección que falla no deja sin barrer a las otras', () => {
    // Tres bandejas independientes: un plazo que se deja de cumplir es un dato
    // personal que se queda de más. El `try` tiene que abarcar la colección
    // entera —la query incluida—, no solo el borrado de cada ficha.
    const src = fuente('functions/retencion-trigger.js');
    const cuerpo = src.slice(src.indexOf('for (const coleccion of COLECCIONES_DE_DIRECTORIO)'));
    expect(cuerpo).toContain('falló la retención de una colección de la guía');
    // El `try` abre antes de la lectura, que es lo que lo hace cierto.
    expect(cuerpo.indexOf('try {')).toBeLessThan(cuerpo.indexOf('fichasVencibles('));
  });

  it('no borra nada de Storage', () => {
    // La diferencia con `borrarPropuestasVencidas`, fijada donde se puede ver:
    // este barrido no pide el bucket. Si alguien lo agrega, hay que volver a
    // decidir el orden de las dos mitades y la guarda del prefijo — y el
    // docblock de `MARGEN_DE_RETENCION_FICHA_MS` dice por qué no hace falta.
    const src = fuente('functions/retencion-trigger.js');
    const cuerpo = src.slice(src.indexOf('export const borrarFichasVencidas'));
    expect(cuerpo).not.toContain('getStorage()');
    expect(cuerpo).not.toContain('bucket');
  });
});

/**
 * **Lo que las tres páginas prometen tiene que ser el número que el barrido
 * cumple** — el hallazgo del `auditor-privacidad` al abrir el `create` anónimo.
 *
 * `/guia/<x>/sumar` dice, en HTML indexado y a alguien que no tiene cuenta: «si
 * al final la ficha no entra, tu contacto se borra a los 30 días». Quien lo
 * cumple es `RETENCION_DE_FICHA_POR_ESTADO`, y hasta acá nada cruzaba las dos
 * mitades: mover el margen a 90 dejaba la suite verde y las tres páginas
 * mintiendo.
 *
 * Es el mismo patrón que `promesas-sobre-datos.test.ts` aplica del otro lado —el
 * número que se promete sale del mismo lugar que el que se cumple— con la
 * diferencia de que acá la premisa es una constante y no una función.
 */
describe('las tres páginas prometen el plazo que la tabla cumple', () => {
  const DIAS = MARGEN_DE_RETENCION_FICHA_MS / DIA;

  it.each(['librerias', 'suscripciones', 'lugares'])(
    '/guia/%s/sumar dice los mismos días que la retención',
    (seccion) => {
      /*
       * MUTACIÓN PROBADA: cambiar `MARGEN_DE_RETENCION_FICHA_MS` a 90 días deja
       * los tres casos en rojo, que es exactamente lo que tiene que pasar: el
       * plazo se puede mover, pero no sin tocar lo que las páginas dicen.
       */
      const pagina = fuente(`src/pages/guia/${seccion}/sumar.astro`);
      expect(pagina, 'la página dejó de prometer un plazo').toMatch(/se borra a los \d+ días/);
      expect(pagina).toContain(`se borra a los ${DIAS} días`);
    },
  );

  it('y el número de la promesa es el de la RECHAZADA, que es el caso que la página describe', () => {
    // La frase dice «si al final la ficha **no entra**», o sea el rechazo. Hoy
    // los dos plazos coinciden, y este aserto es lo que impide que alguien lea la
    // promesa contra el otro — son dos decisiones distintas que hoy dan el mismo
    // número (ver `MARGEN_SIN_TOCAR_FICHA_MS`).
    expect(RETENCION_DE_FICHA_POR_ESTADO.rechazado).toBe(MARGEN_DE_RETENCION_FICHA_MS);
  });
});
