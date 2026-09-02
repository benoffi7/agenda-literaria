/**
 * Lógica pura del trigger de sync (`functions/sincronizacion.js`): el id
 * idempotente del evento (B-82) y la reposición de `calendarEventId` en el
 * documento (B-80).
 *
 * El diff en sí está testeado en `calendario.test.ts`; las costuras de estos
 * dos bugs, en `costuras.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALFABETO_ID_CALENDAR,
  decidirAnteFallo,
  idDeEvento,
  mapaDeEtiquetas,
  mismasEtiquetas,
  replanificarPorEtiquetas,
  reponerIds,
} from '../functions/sincronizacion.js';
import { planificar } from '../functions/calendario.js';
import { nuevaSesionId } from '@/lib/sesiones';
import { ts } from './fixtures/tiempo';
import { cicloDeOcho, sesionesDeCiclo } from './fixtures/ciclo';

const fuente = (relativo: string) =>
  readFileSync(fileURLToPath(new URL(relativo, new URL('..', import.meta.url))), 'utf8');

// ─────────────────────────────────────────────────────────────────────
// B-82 · el id del evento lo elige el cliente
// ─────────────────────────────────────────────────────────────────────

describe('idDeEvento — el alfabeto que exige la API de Calendar', () => {
  /**
   * La verificación que importa: Calendar acepta un id elegido por el cliente
   * solo si está en base32hex (`0-9a-v`) y mide entre 5 y 1024 caracteres. Se
   * comprueba contra ids generados por el mismo código del panel
   * (`nuevaSesionId`), no contra un literal escrito a mano.
   */
  it('los ids que genera el panel caen dentro del alfabeto', () => {
    for (let i = 0; i < 200; i += 1) {
      const derivado = idDeEvento(nuevaSesionId());
      expect(derivado).not.toBeNull();
      expect(derivado).toMatch(ALFABETO_ID_CALENDAR);
    }
  });

  it('mide 35 caracteres: `ses` + el uuid sin guiones', () => {
    const derivado = idDeEvento('ses_3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b');
    expect(derivado).toBe('ses3f2a1b4c5d6e4f708a9b0c1d2e3f4a5b');
    expect(derivado).toHaveLength(35);
  });

  it('es determinístico: el mismo id de sesión da el mismo id de evento', () => {
    const sesion = nuevaSesionId();
    expect(idDeEvento(sesion)).toBe(idDeEvento(sesion));
  });

  /**
   * La propiedad de la que depende todo: sacar los guiones de posiciones fijas
   * es inyectivo, así que dos sesiones nunca comparten el id del evento. Si
   * colisionaran, el segundo `insert` daría 409 y las dos sesiones acabarían
   * apuntando al mismo evento del calendario público.
   */
  it('no colisiona: mil ids de sesión dan mil ids de evento distintos', () => {
    const derivados = new Set(
      Array.from({ length: 1000 }, () => idDeEvento(nuevaSesionId())),
    );
    expect(derivados.size).toBe(1000);
  });

  it('tolera mayúsculas en el uuid', () => {
    expect(idDeEvento('SES_3F2A1B4C-5D6E-4F70-8A9B-0C1D2E3F4A5B')).toBe(
      'ses3f2a1b4c5d6e4f708a9b0c1d2e3f4a5b',
    );
  });

  /**
   * Cualquier cosa que no tenga la forma documentada devuelve `null` y el
   * `insert` va sin id, como siempre: se pierde la idempotencia de esa sesión,
   * nunca la sincronización. El respaldo de `nuevaSesionId` sin
   * `crypto.randomUUID` usa base36, que tiene letras fuera del alfabeto.
   */
  it.each([
    ['el respaldo base36 de nuevaSesionId', 'ses_m1kz9x-ab3zk91p'],
    ['un id de otra época, sin uuid', 'ses_1'],
    ['un id sin el prefijo', '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b'],
    ['un uuid incompleto', 'ses_3f2a1b4c-5d6e-4f70-8a9b'],
    ['vacío', ''],
  ])('devuelve null con %s', (_caso, sesionId) => {
    expect(idDeEvento(sesionId)).toBeNull();
  });

  it('devuelve null sin id, sin explotar', () => {
    expect(idDeEvento(null)).toBeNull();
    expect(idDeEvento(undefined)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-80 · reponer el calendarEventId en el documento
// ─────────────────────────────────────────────────────────────────────

const sesion = (id: string, calendarEventId: string | null) => ({
  id,
  inicio: { toMillis: () => 0 },
  cancelada: false,
  calendarEventId,
});

describe('reponerIds — qué queda escrito después de sincronizar', () => {
  it('escribe el id de un evento recién creado', () => {
    const repuestas = reponerIds(
      [sesion('ses_1', null)],
      new Map([['ses_1', 'evt_1']]),
    );
    expect(repuestas?.[0]).toMatchObject({ id: 'ses_1', calendarEventId: 'evt_1' });
  });

  it('limpia el id de un evento borrado', () => {
    const repuestas = reponerIds(
      [sesion('ses_1', 'evt_1')],
      new Map<string, string | null>([['ses_1', null]]),
    );
    expect(repuestas?.[0]).toMatchObject({ calendarEventId: null });
  });

  /**
   * El arreglo de B-80: el guardado desde un listado viejo dejó el campo en
   * `null`, y el `actualizar` que ese mismo guardado disparó lo repone. Sin
   * esto el documento se queda sin id y la edición siguiente crea un segundo
   * evento.
   */
  it('repone el id que el panel pisó con null', () => {
    const repuestas = reponerIds(
      [sesion('ses_1', null)],
      new Map([['ses_1', 'evt_1']]),
    );
    expect(repuestas?.[0]).toMatchObject({ calendarEventId: 'evt_1' });
  });

  /**
   * Y la otra mitad del arreglo: en el caso normal el documento ya tiene el id
   * correcto. Devolver `null` es lo que evita una escritura —y por lo tanto un
   * disparo más de la Function— por cada `actualizar`.
   */
  it('devuelve null cuando el documento ya tiene los ids que corresponden', () => {
    expect(reponerIds([sesion('ses_1', 'evt_1')], new Map([['ses_1', 'evt_1']]))).toBeNull();
  });

  it('devuelve null sin ids que aplicar', () => {
    expect(reponerIds([sesion('ses_1', 'evt_1')], new Map())).toBeNull();
    expect(reponerIds([sesion('ses_1', 'evt_1')], null as never)).toBeNull();
  });

  it('no toca las sesiones que no están en el mapa', () => {
    const sesiones = [sesion('ses_1', 'evt_1'), sesion('ses_2', 'evt_2')];
    const repuestas = reponerIds(sesiones, new Map([['ses_1', 'evt_9']]));
    expect(repuestas?.[1]).toBe(sesiones[1]);
    expect(repuestas?.[0]).toMatchObject({ calendarEventId: 'evt_9' });
  });

  it('conserva el resto de los campos de la sesión', () => {
    const repuestas = reponerIds(
      [{ ...sesion('ses_1', null), tema: 'Cap. 1-4' }],
      new Map([['ses_1', 'evt_1']]),
    );
    expect(repuestas?.[0]).toMatchObject({ tema: 'Cap. 1-4', calendarEventId: 'evt_1' });
  });

  it('un campo ausente cuenta como null: no genera escritura', () => {
    // La sesión de una actividad que nunca se publicó puede no tener el campo.
    expect(
      reponerIds([{ id: 'ses_1' }], new Map<string, string | null>([['ses_1', null]])),
    ).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-04 · renombrar una etiqueta y los eventos ya creados
// ─────────────────────────────────────────────────────────────────────



const publicada = (over: Record<string, unknown> = {}) => ({
  titulo: 'Club de lectura',
  descripcion: 'Ocho encuentros',
  estado: 'publicado',
  modalidad: 'presencial',
  sede: { nombre: 'Casa Brandon', direccion: 'Drago 236', barrio: 'villa-crespo', ciudad: 'CABA' },
  inscripcion: { requiere: false, destino: '' },
  arancel: { tipo: 'a-la-gorra', notas: '' },
  esCiclo: false,
  sesiones: [
    {
      id: 'ses_3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b',
      inicio: ts('2026-09-03T22:00:00Z'),
      fin: ts('2026-09-04T00:00:00Z'),
      tema: null,
      lectura: null,
      cancelada: false,
      calendarEventId: 'evt_1',
    },
  ],
  ...over,
});

const etiquetas = (arancel: string) => ({ arancel: { 'a-la-gorra': arancel } });

describe('mismasEtiquetas — qué cuenta como renombre', () => {
  it('dos mapas iguales son iguales', () => {
    expect(mismasEtiquetas({ gratis: 'Gratis' }, { gratis: 'Gratis' })).toBe(true);
  });

  /**
   * El caso frecuente, y el que hay que descartar: `upsertOpcion` escribe
   * `/opciones/*` en CADA guardado del formulario para subir `usos`. Como el
   * mapa solo lleva slug y etiqueta, eso no se ve acá — que es exactamente lo
   * que se quiere.
   */
  it('subir `usos` no cambia ninguna etiqueta', () => {
    const antes = mapaDeEtiquetas([{ slug: 'gratis', label: 'Gratis', usos: 3 }]);
    const despues = mapaDeEtiquetas([{ slug: 'gratis', label: 'Gratis', usos: 4 }]);
    expect(mismasEtiquetas(antes, despues)).toBe(true);
  });

  it('reordenar las opciones tampoco', () => {
    const valores = [
      { slug: 'gratis', label: 'Gratis' },
      { slug: 'a-la-gorra', label: 'A la gorra' },
    ];
    const alReves = valores.slice().reverse();
    expect(mismasEtiquetas(mapaDeEtiquetas(valores), mapaDeEtiquetas(alReves))).toBe(true);
  });

  it('renombrar una etiqueta sí', () => {
    expect(mismasEtiquetas({ gratis: 'Gratis' }, { gratis: 'Sin cargo' })).toBe(false);
  });

  it('una opción nueva cuenta como cambio, y no hace daño: nadie la usa todavía', () => {
    expect(mismasEtiquetas({ gratis: 'Gratis' }, { gratis: 'Gratis', beca: 'Con beca' })).toBe(
      false,
    );
  });

  it('borrar una opción también', () => {
    expect(mismasEtiquetas({ gratis: 'Gratis' }, {})).toBe(false);
  });

  it('sin argumentos no explota', () => {
    expect(mismasEtiquetas()).toBe(true);
  });
});

describe('replanificarPorEtiquetas — qué eventos se reescriben (B-04)', () => {
  it('renombrar la etiqueta del arancel reescribe el evento', () => {
    const ops = replanificarPorEtiquetas(
      publicada(),
      etiquetas('A la gorra'),
      etiquetas('A la gorra (lo que puedas)'),
    );
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ tipo: 'actualizar', eventId: 'evt_1' });
    expect(ops[0]!.evento.description).toContain('A la gorra (lo que puedas)');
  });

  it('si la etiqueta renombrada no aparece en el evento, no hay nada que hacer', () => {
    const ops = replanificarPorEtiquetas(
      publicada({ arancel: { tipo: 'gratis', notas: '' } }),
      etiquetas('A la gorra'),
      etiquetas('A la gorra (lo que puedas)'),
    );
    expect(ops).toEqual([]);
  });

  it('el barrio también viaja en la ubicación', () => {
    const ops = replanificarPorEtiquetas(
      publicada(),
      { barrio: { 'villa-crespo': 'Villa Crespo' } },
      { barrio: { 'villa-crespo': 'Villa Crespo (CABA)' } },
    );
    expect(ops).toHaveLength(1);
    expect(ops[0]!.evento.location).toContain('Villa Crespo (CABA)');
  });

  it('una sesión sin evento no se toca: crear es trabajo del diff', () => {
    const sinEvento = publicada();
    sinEvento.sesiones[0]!.calendarEventId = null as never;
    expect(replanificarPorEtiquetas(sinEvento, etiquetas('A la gorra'), etiquetas('Otra'))).toEqual(
      [],
    );
  });

  it('una sesión cancelada tampoco: su evento no debería existir', () => {
    const cancelada = publicada();
    cancelada.sesiones[0]!.cancelada = true;
    expect(replanificarPorEtiquetas(cancelada, etiquetas('A la gorra'), etiquetas('Otra'))).toEqual(
      [],
    );
  });

  it('una actividad que no está publicada tampoco', () => {
    expect(
      replanificarPorEtiquetas(
        publicada({ estado: 'borrador' }),
        etiquetas('A la gorra'),
        etiquetas('Otra'),
      ),
    ).toEqual([]);
  });

  it('sin actividad devuelve vacío', () => {
    expect(replanificarPorEtiquetas(null, {}, {})).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-125 · un evento borrado a mano en Calendar
// ─────────────────────────────────────────────────────────────────────

/**
 * El §2.1 dice que el calendario es un espejo de solo lectura y que editarlo a
 * mano no es un caso soportado. Lo que **no** era el comportamiento esperado es
 * que no se recuperara nunca: el documento se quedaba con el `calendarEventId`
 * del evento borrado, el diff seguía emitiendo `actualizar` contra un evento
 * inexistente, Calendar contestaba 404 y eso caía en el `else` de "falló una
 * operación" — se logueaba y el id quedaba intacto. La edición siguiente hacía
 * lo mismo. El encuentro se perdía del calendario público para siempre, y la
 * vista calendario del panel seguía diciendo "En el calendario" porque el id
 * estaba ahí (D-71).
 */
describe('decidirAnteFallo — qué significa que Calendar rechace una operación (B-125)', () => {
  const op = (tipo: string) => ({ tipo, id: 'ses_1', eventId: 'evt_1', evento: {} });

  it('un borrado que no encuentra su evento es el resultado buscado: se limpia el id', () => {
    for (const code of [404, 410]) {
      expect(decidirAnteFallo(op('borrar'), code)).toMatchObject({ accion: 'limpiar-id' });
    }
  });

  it('un update que no encuentra su evento lo recrea: lo borraron a mano (B-125)', () => {
    for (const code of [404, 410]) {
      expect(decidirAnteFallo(op('actualizar'), code)).toMatchObject({
        accion: 'recrear',
        motivo: 'borrado-a-mano',
      });
    }
  });

  /**
   * Un 404 al **crear** no es "el evento no está": es un calendario que no
   * existe o al que la service account no tiene acceso (D-06). Recrear en un
   * loop no lo arregla, y taparlo como aviso esconde el único error que hay que
   * mirar.
   */
  it('un 404 al crear es un problema de acceso al calendario, no un evento faltante', () => {
    expect(decidirAnteFallo(op('crear'), 404)).toEqual({ accion: 'registrar-error' });
  });

  it('cualquier otro código sigue siendo un error, en las tres operaciones', () => {
    const otros = [400, 401, 403, 409, 429, 500, 503, undefined, null, 'boom'];
    const noEsError: string[] = [];
    for (const tipo of ['crear', 'actualizar', 'borrar']) {
      for (const code of otros) {
        const { accion } = decidirAnteFallo(op(tipo), code as number);
        if (accion !== 'registrar-error') noEsError.push(`${tipo} · ${String(code)}: ${accion}`);
      }
    }
    expect(noEsError).toEqual([]);
  });

  it('no explota sin operación', () => {
    expect(decidirAnteFallo(undefined, 404)).toEqual({ accion: 'registrar-error' });
  });
});

/**
 * Réplica del cuerpo de `syncCalendar` con un calendario que **pierde** un
 * evento, para ver el ciclo completo: la pérdida, la reposición y que la pasada
 * siguiente ya no tenga nada que hacer.
 *
 * Es el mismo patrón que la réplica de B-82 en `costuras.test.ts`, y por el
 * mismo motivo: el efecto vive en `index.js`, que está atado a Firebase y a la
 * red. Abajo hay un chequeo de fidelidad contra el fuente.
 */
const correrConCalendarioQueFalla = (
  antes: unknown,
  despues: unknown,
  documento: { sesiones: { id: string; calendarEventId: string | null }[] },
  calendario: Map<string, unknown>,
) => {
  const ops = planificar(antes, despues, {}) as {
    tipo: string;
    id: string;
    eventId?: string;
    evento?: unknown;
  }[];
  const ids = new Map<string, string | null>();

  for (const op of ops) {
    // El "404" del doble: la operación toca un evento que no está en el mapa.
    const existe = op.eventId ? calendario.has(op.eventId) : true;
    if (op.tipo === 'crear') {
      const eventId = idDeEvento(op.id) ?? `evt_google_${calendario.size + 1}`;
      calendario.set(eventId, op.evento);
      ids.set(op.id, eventId);
      continue;
    }
    if (existe) {
      if (op.tipo === 'actualizar') {
        calendario.set(op.eventId!, op.evento);
        ids.set(op.id, op.eventId!);
      } else {
        calendario.delete(op.eventId!);
        ids.set(op.id, null);
      }
      continue;
    }
    const { accion } = decidirAnteFallo(op, 404);
    if (accion === 'limpiar-id') {
      ids.set(op.id, null);
    } else if (accion === 'recrear') {
      const eventId = idDeEvento(op.id) ?? `evt_google_${calendario.size + 1}`;
      calendario.set(eventId, op.evento);
      ids.set(op.id, eventId);
    }
  }

  const repuestas = reponerIds(documento.sesiones, ids);
  if (repuestas) documento.sesiones = repuestas as typeof documento.sesiones;
  return ops;
};

describe('B-125 · el encuentro vuelve al calendario en la próxima edición', () => {
  /** Ids con la forma documentada: sin eso no hay id derivable (B-82). */
  const idsReales = () =>
    sesionesDeCiclo().map((s, i) => ({
      ...s,
      id: `ses_3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a${String(i).padStart(2, '0')}`,
      calendarEventId: `evt_google_${i}`,
    }));

  const armar = () => {
    const sesiones = idsReales();
    const actividad = (over: Record<string, unknown> = {}) => cicloDeOcho({ sesiones, ...over });
    const calendario = new Map<string, unknown>(
      sesiones.map((s) => [s.calendarEventId!, { summary: 'viejo' }]),
    );
    const documento = { sesiones: sesiones.map((s) => ({ ...s })) };
    return { actividad, calendario, documento, sesiones };
  };

  it('recrea el evento que faltaba y deja su id nuevo en el documento', () => {
    const { actividad, calendario, documento, sesiones } = armar();
    const huerfana = sesiones[3]!;

    // Alguien lo borra a mano desde Calendar.
    calendario.delete(huerfana.calendarEventId!);
    expect(calendario.size).toBe(7);

    // Cualquier edición de la actividad: acá, cambiar el título (trampa 9).
    correrConCalendarioQueFalla(
      actividad(),
      actividad({ titulo: 'Título nuevo' }),
      documento,
      calendario,
    );

    // El encuentro volvió, y el documento apunta al evento que existe.
    expect(calendario.size).toBe(8);
    const repuesta = documento.sesiones.find((s) => s.id === huerfana.id)!;
    expect(repuesta.calendarEventId).toBe(idDeEvento(huerfana.id));
    expect(calendario.has(repuesta.calendarEventId!)).toBe(true);
  });

  it('y no queda inestable: la pasada siguiente no genera ninguna operación', () => {
    const { actividad, calendario, documento, sesiones } = armar();
    calendario.delete(sesiones[3]!.calendarEventId!);

    const conTitulo = { titulo: 'Título nuevo' };
    correrConCalendarioQueFalla(actividad(), actividad(conTitulo), documento, calendario);

    // El write-back del id vuelve a disparar la Function (§7.1, trampa 3).
    const ops = correrConCalendarioQueFalla(
      actividad({ ...conTitulo, sesiones: documento.sesiones }),
      actividad({ ...conTitulo, sesiones: documento.sesiones }),
      documento,
      calendario,
    );
    expect(ops).toEqual([]);
    expect(calendario.size).toBe(8);
  });

  it('no recrea el evento de un encuentro que no debería estar (§7.3)', () => {
    const { actividad, calendario, documento, sesiones } = armar();
    const cancelada = sesiones[3]!;
    calendario.delete(cancelada.calendarEventId!);

    // Se cancela el encuentro cuyo evento ya no está: la op es `borrar`, y un
    // borrado que no encuentra su evento no se recrea, se limpia.
    correrConCalendarioQueFalla(
      actividad(),
      actividad({
        sesiones: sesiones.map((s) => (s.id === cancelada.id ? { ...s, cancelada: true } : s)),
      }),
      documento,
      calendario,
    );

    expect(calendario.size).toBe(7);
    expect(documento.sesiones.find((s) => s.id === cancelada.id)!.calendarEventId).toBeNull();
  });

  /**
   * El modo de falla que se arregló, con la decisión vieja escrita al lado: un
   * `actualizar` que falla era solo un error, así que `ids` no recibía nada para
   * esa sesión y el id colgado se quedaba en el documento. Cada edición
   * siguiente repetía la misma operación imposible: el encuentro no volvía
   * nunca.
   */
  it('el modo de falla que se arregló: sin recrear, el encuentro se perdía para siempre', () => {
    const { documento, calendario, sesiones } = armar();
    const huerfana = sesiones[3]!;
    calendario.delete(huerfana.calendarEventId!);

    const vieja = (op: { tipo: string }, code: number) =>
      op.tipo === 'borrar' && (code === 404 || code === 410)
        ? { accion: 'limpiar-id' }
        : { accion: 'registrar-error' };

    expect(vieja({ tipo: 'actualizar' }, 404)).toEqual({ accion: 'registrar-error' });
    // Con eso `ids` queda vacío para esa sesión y no hay nada que reponer: el
    // documento sigue apuntando a un evento que no existe.
    expect(reponerIds(documento.sesiones, new Map())).toBeNull();
    expect(documento.sesiones.find((s) => s.id === huerfana.id)!.calendarEventId).toBe(
      huerfana.calendarEventId,
    );
    expect(calendario.size).toBe(7);
  });

  it('la réplica sigue siendo fiel: index.js consume decidirAnteFallo y recrea', () => {
    const src = fuente('functions/index.js');
    expect(src).toContain('const { accion, motivo } = decidirAnteFallo(op, code);');
    expect(src).toContain("if (accion === 'limpiar-id')");
    expect(src).toContain("} else if (accion === 'recrear') {");
    // Recrear pasa por `crearEvento`, o sea por el id derivado y por el 409.
    expect(src).toMatch(/accion === 'recrear'[\s\S]{0,400}await crearEvento\(cal, op\)/);
    // Y la tabla vieja no quedó al lado de la nueva.
    expect(src).not.toMatch(/op\.tipo === 'borrar' && \(code === 404/);
  });
});
