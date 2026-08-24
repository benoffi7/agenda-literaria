/**
 * Lógica pura del trigger de sync (`functions/sincronizacion.js`): el id
 * idempotente del evento (B-82) y la reposición de `calendarEventId` en el
 * documento (B-80).
 *
 * El diff en sí está testeado en `calendario.test.ts`; las costuras de estos
 * dos bugs, en `costuras.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  ALFABETO_ID_CALENDAR,
  idDeEvento,
  reponerIds,
} from '../functions/sincronizacion.js';
import { nuevaSesionId } from '@/lib/sesiones';

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
