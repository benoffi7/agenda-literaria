/**
 * **Los derivados de `modalidades` verificados del lado del servidor, la mitad
 * pura** — B-2050, B-2052.
 *
 * `syncCalendar` recalcula `modalidad`, `sede`, `online` y `searchText` (y
 * `ciudades`, B-1920) de las filas del documento y, si no coinciden, los corrige
 * y avisa con `alerta: 'derivados-no-coinciden'`. Y avisa —sin corregir— cuando
 * una publicadora con ciudad carga una fila con sede y sin ciudad
 * (`alerta: 'sede-sin-ciudad'`).
 *
 * Lo de acá es la decisión, la guarda anti-loop en sus tres mitades, que el panel
 * y la restauración **nunca** disparen la alerta, que corregir `online` no pueda
 * abrir el link de la reunión (§5) y el cableado. La transacción de verdad y la
 * lectura del claim, contra el emulador, están en
 * `derivados-del-servidor.integracion.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as fachadaModalidades from '@/lib/modalidades';
import * as fachadaBusqueda from '@/lib/normalize';
import * as enBusqueda from '../functions/busqueda.js';
import * as enDerivados from '../functions/derivados.js';
import {
  cambiaLoPublico,
  conDerivados,
  derivadosDe,
  derivadosDesalineados,
  onlinePrincipal,
  pideRebuild,
} from '../functions/derivados.js';
import { camposCambiados, huboCambioDeContenido } from '../functions/historial.js';
import { planificar } from '../functions/calendario.js';
import { formADocumento } from '@/lib/actividades';
import { payloadDeRestauracion, type Version } from '@/lib/historial';
import { linkDeReunionQueSale } from '@/lib/toPublic';
import { modalidadVacia, onlineVacio } from '@/lib/formulario/estadoInicial';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import { formGuardable } from './fixtures/formulario';
import { ts } from './fixtures/tiempo';
import type { Actividad, ActividadForm, Online, Sede } from '@/types/actividad';

const sede = (nombre: string, ciudad = 'mar-del-plata', over: Partial<Sede> = {}): Sede => ({
  nombre,
  direccion: 'Av. Luro 3000',
  provincia: 'buenos-aires',
  barrio: '',
  ciudad,
  indicaciones: '',
  geo: null,
  ...over,
});

const zoom = (url: string, urlPublica = false): Online => ({ plataforma: 'zoom', url, urlPublica });

type Fila = { id: string; modalidad: string; sede: Sede | null; online: Online | null };

const fila = (id: string, s: Sede | null, o: Online | null = null): Fila => ({
  id,
  modalidad: s && o ? 'hibrido' : o ? 'virtual' : 'presencial',
  sede: s,
  online: o,
});

/** Un documento como lo deja el panel: los cinco derivados salen de sus filas. */
const alineado = (modalidades: Fila[], over: Record<string, unknown> = {}) => {
  const base = {
    titulo: 'Club del puerto',
    descripcion: 'Leemos a Saer',
    estado: 'publicado',
    organizador: { nombre: 'Biblioteca popular', instagram: '', web: '' },
    tallerista: null,
    libro: null,
    // Un ciclo de dos (§2.2): un cambio de sede tiene que llegar a las N sesiones
    // (trampa 9), así que lo que se mide es que no llegue a ninguna.
    esCiclo: true,
    sesiones: ['1', '2'].map((n) => ({
      id: `ses_${n}`,
      inicio: ts(`2026-10-0${n}T22:00:00Z`),
      fin: ts(`2026-10-0${n}T23:30:00Z`),
      tema: null,
      lectura: null,
      cancelada: false,
      calendarEventId: `evt_${n}`,
    })),
    modalidades,
    updatedBy: 'uid_pub',
    ...over,
  };
  const d = derivadosDe(base);
  return { ...base, ...d, ciudades: enDerivados.derivadosDesalineados(base)!.derivados.ciudades };
};

describe('las fachadas reexportan las mismas funciones, no copias (D-1233)', () => {
  /**
   * Si esto se rompe, el servidor y el panel derivan por separado, y el síntoma
   * es un mail por cada guardado bien hecho.
   */
  it('`src/lib/modalidades.ts` → `functions/derivados.js`', () => {
    for (const nombre of [
      'filaPideSede',
      'filaPideOnline',
      'modalidadResultante',
      'sedePrincipal',
      'onlinePrincipal',
    ] as const) {
      expect(fachadaModalidades[nombre], nombre).toBe(enDerivados[nombre]);
    }
  });

  it('`src/lib/normalize.ts` → `functions/busqueda.js`', () => {
    expect(fachadaBusqueda.normalize).toBe(enBusqueda.normalize);
    expect(fachadaBusqueda.buildSearchText).toBe(enBusqueda.buildSearchText);
    expect(fachadaBusqueda.CAMPOS_DE_SEARCH_TEXT).toBe(enBusqueda.CAMPOS_DE_SEARCH_TEXT);
  });
});

describe('`derivadosDesalineados` — cuándo el servidor corrige', () => {
  const dosFilas = [fila('mod_1', sede('Librería del puerto')), fila('mod_2', null, zoom('https://zoom.us/j/1'))];

  it('un documento que coincide no se toca', () => {
    expect(derivadosDesalineados(alineado(dosFilas))).toBeNull();
    expect(derivadosDesalineados(alineado([fila('mod_v', null, zoom('https://z'))]))).toBeNull();
    expect(derivadosDesalineados(alineado([]))).toBeNull();
  });

  /** MUTACIÓN PROBADA: devolver siempre `null` pone los cuatro en rojo. */
  it('una `sede` que no es la de la primera fila con sede se corrige', () => {
    const doc = { ...alineado(dosFilas), sede: sede('Otra', 'rosario') };
    expect(derivadosDesalineados(doc)?.campos).toEqual(['sede']);
    expect(derivadosDesalineados(doc)?.derivados.sede).toEqual(dosFilas[0]!.sede);
  });

  it('una `modalidad` que no es la unión de las filas se corrige', () => {
    const doc = { ...alineado(dosFilas), modalidad: 'presencial' };
    expect(derivadosDesalineados(doc)?.campos).toEqual(['modalidad']);
    expect(derivadosDesalineados(doc)?.derivados.modalidad).toBe('hibrido');
  });

  it('un `online` que no es el de las filas se corrige', () => {
    const doc = { ...alineado(dosFilas), online: zoom('https://otro', true) };
    expect(derivadosDesalineados(doc)?.campos).toEqual(['online']);
  });

  it('un `searchText` que no sale de los campos se corrige', () => {
    const doc = { ...alineado(dosFilas), searchText: 'cualquier cosa para aparecer arriba' };
    expect(derivadosDesalineados(doc)?.campos).toEqual(['searchText']);
  });

  it('el campo ausente cuenta, como en `ciudades`', () => {
    const { online: _, ...sinOnline } = alineado([fila('mod_1', sede('X'))]);
    expect(derivadosDesalineados(sinOnline)?.campos).toEqual(['online']);
  });

  it('los cinco a la vez, en el orden de `CAMPOS_DERIVADOS`', () => {
    const doc = {
      ...alineado(dosFilas),
      modalidad: 'virtual',
      sede: null,
      online: null,
      searchText: '',
      ciudades: [],
    };
    expect(derivadosDesalineados(doc)?.campos).toEqual([
      'modalidad',
      'sede',
      'online',
      'searchText',
      'ciudades',
    ]);
  });

  it('el orden de las claves de un map no cuenta: la misma sede no se «corrige»', () => {
    const doc = alineado(dosFilas);
    const alReves = Object.fromEntries(Object.entries(doc.sede as Sede).reverse());
    expect(derivadosDesalineados({ ...doc, sede: alReves })).toBeNull();
  });

  it('un borrado (`despues` nulo) no tiene nada que corregir', () => {
    expect(derivadosDesalineados(null)).toBeNull();
    expect(derivadosDesalineados(undefined)).toBeNull();
  });

  /** Corre adentro de `syncCalendar` antes del diff: si tirara, cortaría el sync. */
  it('no tira con un documento escrito a mano con basura', () => {
    for (const basura of [
      { modalidades: [null, 5, { sede: 'x' }, { online: 3, modalidad: {} }] },
      { modalidades: 'no-es-lista', titulo: 42, organizador: 'x', tallerista: [], libro: 7 },
      { modalidades: [{ sede: { nombre: {}, barrio: 3, ciudad: 42 } }] },
    ]) {
      expect(() => derivadosDesalineados(basura)).not.toThrow();
      expect(() => conDerivados(basura)).not.toThrow();
    }
  });
});

describe('el panel y la restauración nunca disparan la alerta', () => {
  const filaForm = (
    modalidad: 'presencial' | 'virtual' | 'hibrido',
    s: Partial<Sede> = {},
    o: Partial<Online> = {},
  ): ActividadForm['modalidades'][number] => {
    const f = modalidadVacia(modalidad);
    return {
      ...f,
      sede: f.sede ? { ...f.sede, ...sede('Casa Brandon', 'caba'), barrio: 'villa-crespo', ...s } : null,
      online: f.online ? { ...onlineVacio(), plataforma: 'meet', url: 'https://meet/x', ...o } : null,
    };
  };

  const casos: [string, Partial<ActividadForm>][] = [
    ['presencial', { modalidades: [filaForm('presencial')] }],
    ['virtual', { modalidades: [filaForm('virtual')] }],
    ['híbrida', { modalidades: [filaForm('hibrido')] }],
    [
      'dos filas en dos barrios',
      { modalidades: [filaForm('presencial'), filaForm('presencial', { nombre: 'Otra', barrio: 'boedo' })] },
    ],
    ['una virtual antes de la presencial', { modalidades: [filaForm('virtual'), filaForm('presencial')] }],
    [
      // El panel arma el índice con lo tipeado y guarda lo recortado.
      'espacios de más en lo tipeado',
      {
        titulo: '  Taller   de Crónica  ',
        descripcion: ' Escribir \n no ficción ',
        modalidades: [filaForm('presencial', { nombre: '  Casa  Brandon ' })],
        tallerista: { nombre: ' María Moreno ', bio: '', instagram: '' },
        libro: { titulo: ' Pedro Páramo ', autor: 'Rulfo ' },
      },
    ],
    ['un tallerista sin nombre no entra', { tallerista: { nombre: '   ', bio: 'x', instagram: '' } }],
  ];

  /**
   * Si esto se rompe, cada guardado del panel mandaría un mail y reescribiría el
   * documento: la derivación del panel y la del servidor tienen que ser la misma.
   */
  it.each(casos)('`formADocumento` coincide con la derivación del servidor: %s', (_, over) => {
    const doc = formADocumento(formGuardable({ titulo: 'Club', ...over }), 'uid', true);
    expect(derivadosDesalineados(doc as Record<string, unknown>)).toBeNull();
  });

  it.each(['titulo', 'descripcion', 'modalidades', 'libro', 'tallerista'])(
    'restaurar `%s` deja el documento alineado',
    (campo) => {
      const actual = formADocumento(
        formGuardable({ titulo: 'Hoy', modalidades: [filaForm('presencial')] }),
        'uid',
        false,
      ) as unknown as Actividad;
      const vieja = formADocumento(
        formGuardable({
          titulo: 'Antes',
          descripcion: 'Otra descripción',
          modalidades: [filaForm('virtual'), filaForm('presencial', { nombre: 'La vieja', barrio: 'boedo' })],
          tallerista: { nombre: 'Alguien', bio: '', instagram: '' },
          libro: { titulo: 'Zama', autor: 'Di Benedetto' },
        }),
        'uid',
        false,
      ) as unknown as Actividad;
      const version = { documento: vieja } as unknown as Version;
      const payload = payloadDeRestauracion(campo, version, actual, 'uid');
      expect(derivadosDesalineados({ ...actual, ...payload })).toBeNull();
    },
  );
});

describe('la guarda anti-loop, en sus tres mitades (trampa 3)', () => {
  const filas = [fila('mod_1', sede('Librería del puerto'))];
  const bien = alineado(filas);
  const mentido = { ...bien, sede: sede('Otra sede', 'rosario', { direccion: 'San Martín 1' }) };
  const corregido = { ...mentido, ...derivadosDesalineados(mentido)!.derivados };

  it('la segunda pasada no entra: el documento corregido coincide consigo mismo', () => {
    expect(derivadosDesalineados(corregido)).toBeNull();
  });

  /**
   * MUTACIÓN PROBADA: sacar `'sede'` de `CAMPOS_DE_MAQUINA` pone este caso en
   * rojo, y el síntoma real sería una versión de historial por cada corrección.
   */
  it('el write-back no es cambio de contenido: no deja versión', () => {
    expect(camposCambiados(mentido, corregido)).toEqual([]);
    expect(huboCambioDeContenido(mentido, corregido)).toBe(false);
  });

  it('control positivo: cambiar las filas sí es contenido', () => {
    const otra = alineado([fila('mod_1', sede('Otra', 'cordoba'))]);
    expect(camposCambiados(bien, otra)).toEqual(['modalidades']);
  });

  /**
   * La tercera mitad: el diff de Calendar se planifica sobre `conDerivados`.
   * MUTACIÓN PROBADA: planificar sobre los documentos crudos pone los dos
   * primeros casos en rojo (el control de abajo es esa mutación).
   */
  it('la corrección no manda un `update` en falso al calendario', () => {
    expect(planificar(conDerivados(mentido), conDerivados(corregido))).toEqual([]);
  });

  it('y la sede mentida no llega nunca al `location` del evento', () => {
    expect(planificar(conDerivados(bien), conDerivados(mentido))).toEqual([]);
  });

  it('control: sobre los crudos, las dos pasadas actualizarían el evento', () => {
    expect(planificar(bien, mentido).map((o) => o.tipo)).toEqual(['actualizar', 'actualizar']);
    expect(planificar(mentido, corregido).map((o) => o.tipo)).toEqual(['actualizar', 'actualizar']);
  });

  it('`cambiaLoPublico`: `ciudades` solo no es la alerta de contenido; cualquiera de los otros sí', () => {
    expect(cambiaLoPublico(['ciudades'])).toBe(false);
    for (const c of ['modalidad', 'sede', 'online', 'searchText']) {
      expect(cambiaLoPublico([c, 'ciudades']), c).toBe(true);
    }
  });

  /**
   * El historial no ve la corrección, pero el sitio sí tiene que verla: la segunda
   * pasada pide rebuild. MUTACIÓN PROBADA: dejar el rebuild colgando solo de
   * `huboCambioDeContenido` pone el primer caso en rojo.
   */
  it('la corrección pide rebuild aunque no deje versión', () => {
    expect(pideRebuild(mentido, corregido)).toBe(true);
    for (const campo of ['modalidad', 'online', 'searchText'] as const) {
      const valor = { modalidad: 'virtual', online: zoom('https://z'), searchText: 'x' }[campo];
      const otro = { ...corregido, [campo]: valor };
      expect(pideRebuild(corregido, otro), campo).toBe(true);
    }
  });

  it('y el write-back del `calendarEventId` sigue sin pedirlo (B-83)', () => {
    const conId = {
      ...bien,
      sesiones: bien.sesiones.map((x) => ({ ...x, calendarEventId: 'evt_nuevo' })),
    };
    expect(pideRebuild(bien, conId)).toBe(false);
    // `ciudades` solo tampoco: es de máquina y no sale al sitio (D-1232).
    expect(pideRebuild(bien, { ...bien, ciudades: ['otra'] })).toBe(false);
  });
});

describe('corregir `online` no puede abrir el link de la reunión (§5.1)', () => {
  /**
   * El `online` corregido es el de una de las filas —el mismo objeto—, y el link
   * de cada fila ya lo publica o lo calla la proyección. O sea que el link que
   * sale por el derivado es siempre uno que ya salía por una fila.
   */
  it('el link del derivado es siempre el link público de alguna fila, o ninguno', () => {
    const combinaciones: Fila[][] = [
      [fila('a', null, zoom('https://privado'))],
      [fila('a', null, zoom('https://publico', true))],
      [fila('a', sede('S')), fila('b', null, zoom('https://privado')), fila('c', null, zoom('https://publico', true))],
      [fila('a', null, zoom('', true)), fila('b', null, zoom('https://publico', true))],
    ];
    for (const filas of combinaciones) {
      const link = linkDeReunionQueSale(onlinePrincipal(filas));
      const deLasFilas = filas.map((f) => linkDeReunionQueSale(f.online)).filter(Boolean);
      if (link !== null) expect(deLasFilas).toContain(link);
    }
  });

  it('un `online` de raíz con un link público que ninguna fila tiene se corrige a callado', () => {
    const filas = [fila('a', null, zoom('https://zoom.us/j/privado'))];
    const doc = { ...alineado(filas), online: zoom('https://zoom.us/j/inventado', true) };
    expect(linkDeReunionQueSale(doc.online)).toBe('https://zoom.us/j/inventado');
    const corregido = derivadosDesalineados(doc)!.derivados.online as Online;
    expect(linkDeReunionQueSale(corregido)).toBeNull();
  });
});

describe('el cableado en `syncCalendar`', () => {
  const trigger = sinComentarios(readFileSync('functions/calendario-trigger.js', 'utf8'));

  const clavesDe = (alerta: string) =>
    [...trigger.matchAll(/logger\.warn\(\s*'[^']*',\s*\{([^}]*)\}/g)]
      .map((m) => m[1]!)
      .filter((b) => b.includes(`alerta: '${alerta}'`))
      .map((b) =>
        b
          .split(',')
          .map((c) => c.split(':')[0]!.trim())
          .filter(Boolean)
          .sort(),
      );

  /**
   * La lista cerrada de lo que lleva cada log (clase de B-81). `sede` es una
   * dirección, `searchText` trae nombres de personas y `online` el link de la
   * reunión: el log nombra los campos, nunca los valores. Y ni el uid ni el mail
   * de quien escribió: el `id` de la actividad alcanza para llegar a la cuenta.
   */
  it('`derivados-no-coinciden` lleva solo nombres de campo', () => {
    expect(clavesDe('derivados-no-coinciden')).toEqual([
      ['alerta', 'campos', 'estado', 'id'],
      ['alerta', 'campos', 'error', 'id'],
    ]);
  });

  it('en `warn`, que es la mitad del filtro de la política de GCP', () => {
    for (const alerta of ['derivados-no-coinciden']) {
      expect(trigger).toMatch(new RegExp(`logger\\.warn\\([^)]*\\{\\s*alerta: '${alerta}'`));
    }
  });

  it('el diff de Calendar se planifica sobre la vista derivada', () => {
    expect(trigger).toContain('planificar(conDerivados(antes), conDerivados(despues), labels)');
  });

  it('el rebuild del sitio pregunta `pideRebuild`, no solo el historial', () => {
    expect(trigger).toContain('if (pideRebuild(antes, despues)) {');
    expect(trigger).not.toMatch(/if \(huboCambioDeContenido\(/);
  });

  it('el runbook tiene la sección que nombra la alerta', () => {
    const runbook = readFileSync('docs/08-operacion.md', 'utf8');
    expect(runbook).toContain('### Cuando suena `derivados-no-coinciden`');
  });
});
