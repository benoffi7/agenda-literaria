import { describe, expect, it } from 'vitest';
// La Function es JS plano; TS le infiere los tipos con allowJs.
import {
  CAMPOS_REARME,
  cubiertoPorElUltimoDespacho,
  decidirDisparo,
  esperaMs,
  ESPERA_BASE_MS,
  MAX_INTENTOS,
  registrarExito,
  registrarFallo,
} from '../functions/rebuild.js';
import { fuenteDeLaFunction } from './fixtures/functions';

const T0 = new Date('2026-08-21T18:00:00Z').getTime();
const MINUTO = 60_000;

/** Timestamp mínimo, como el que entrega Firestore al leer el documento. */
const ts = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });

/** El documento `sistema/rebuild` recién marcado por la Function de sync. */
const pendiente = (over: Record<string, unknown> = {}) => ({
  pendiente: true,
  motivo: 'actividad abc123',
  intentos: 0,
  ultimoError: null,
  agotado: false,
  ...over,
});

describe('decidirDisparo — cuándo se dispara el rebuild (§8)', () => {
  it('sin documento no hay nada que disparar', () => {
    expect(decidirDisparo(null, T0)).toEqual({ accion: 'esperar', motivo: 'sin-pendiente' });
  });

  it('con pendiente en false no dispara', () => {
    const d = decidirDisparo({ pendiente: false, intentos: 0 }, T0);
    expect(d).toEqual({ accion: 'esperar', motivo: 'sin-pendiente' });
  });

  it('con pendiente en true dispara en el primer tick, sin esperar', () => {
    expect(decidirDisparo(pendiente(), T0)).toEqual({ accion: 'disparar', intento: 1 });
  });

  it('un documento viejo, sin los campos de intentos, dispara igual', () => {
    // Compatibilidad: `sistema/rebuild` ya existe en producción escrito por la
    // versión anterior, que no tenía contador.
    expect(decidirDisparo({ pendiente: true }, T0)).toEqual({ accion: 'disparar', intento: 1 });
  });
});

describe('decidirDisparo — backoff entre reintentos (B-13)', () => {
  it('después de un fallo espera un período completo del schedule', () => {
    const estado = pendiente({ intentos: 1, ultimoIntento: ts(T0) });

    const enseguida = decidirDisparo(estado, T0 + MINUTO);
    expect(enseguida.accion).toBe('esperar');
    expect(enseguida.motivo).toBe('backoff');
    expect(enseguida.restanteMs).toBe(4 * MINUTO);

    expect(decidirDisparo(estado, T0 + 5 * MINUTO)).toEqual({ accion: 'disparar', intento: 2 });
  });

  it('la espera se duplica con cada fallo: 5, 10, 20, 40 minutos', () => {
    expect(esperaMs(0)).toBe(0);
    expect(esperaMs(1)).toBe(5 * MINUTO);
    expect(esperaMs(2)).toBe(10 * MINUTO);
    expect(esperaMs(3)).toBe(20 * MINUTO);
    expect(esperaMs(4)).toBe(40 * MINUTO);
    expect(ESPERA_BASE_MS).toBe(5 * MINUTO);
  });

  it('al tercer fallo saltea los ticks intermedios', () => {
    const estado = pendiente({ intentos: 3, ultimoIntento: ts(T0) });
    // El schedule tickea igual cada 5 minutos; el backoff decide en cuál se
    // intenta. A los 15 minutos todavía no toca.
    expect(decidirDisparo(estado, T0 + 15 * MINUTO).accion).toBe('esperar');
    expect(decidirDisparo(estado, T0 + 20 * MINUTO).accion).toBe('disparar');
  });

  it('acepta el ultimoIntento como Date además de Timestamp', () => {
    const estado = pendiente({ intentos: 1, ultimoIntento: new Date(T0) });
    expect(decidirDisparo(estado, T0 + MINUTO).accion).toBe('esperar');
    expect(decidirDisparo(estado, T0 + 5 * MINUTO).accion).toBe('disparar');
  });

  it('si falta el ultimoIntento no se queda esperando para siempre', () => {
    // Un documento a medio escribir no puede bloquear el rebuild.
    const estado = pendiente({ intentos: 2, ultimoIntento: null });
    expect(decidirDisparo(estado, T0).accion).toBe('disparar');
  });
});

describe('decidirDisparo — límite de intentos (B-13)', () => {
  it('agotado deja de reintentar en vez de golpear cada 5 minutos', () => {
    const estado = pendiente({ intentos: MAX_INTENTOS, agotado: true, ultimoIntento: ts(T0) });
    const d = decidirDisparo(estado, T0 + 24 * 60 * MINUTO);
    expect(d.accion).toBe('esperar');
    expect(d.motivo).toBe('agotado');
  });

  it('el contador corta aunque falte el flag agotado', () => {
    // Red de contención si el documento quedó a medio escribir.
    const estado = pendiente({ intentos: MAX_INTENTOS, ultimoIntento: ts(T0) });
    expect(decidirDisparo(estado, T0 + 24 * 60 * MINUTO).motivo).toBe('agotado');
  });

  it('el límite es configurable para bajarlo sin tocar la lógica', () => {
    const estado = pendiente({ intentos: 2, ultimoIntento: null });
    expect(decidirDisparo(estado, T0, { maxIntentos: 2 }).motivo).toBe('agotado');
  });
});

describe('registrarFallo — el fallo queda en el documento (B-13)', () => {
  it('incrementa el contador y guarda el error', () => {
    const fallo = registrarFallo(pendiente(), 'HTTP 401 Bad credentials', T0);
    expect(fallo.intentos).toBe(1);
    expect(fallo.ultimoError).toBe('HTTP 401 Bad credentials');
    expect(fallo.ultimoIntento).toEqual(new Date(T0));
    expect(fallo.agotado).toBe(false);
  });

  it('deja pendiente en true: el sitio sigue viejo', () => {
    expect(registrarFallo(pendiente(), 'boom', T0).pendiente).toBe(true);
  });

  it('marca agotado al llegar al máximo', () => {
    const fallo = registrarFallo(pendiente({ intentos: MAX_INTENTOS - 1 }), 'boom', T0);
    expect(fallo.intentos).toBe(MAX_INTENTOS);
    expect(fallo.agotado).toBe(true);
  });

  it('recorta el error: GitHub puede contestar un HTML entero', () => {
    const fallo = registrarFallo(pendiente(), 'x'.repeat(5000), T0);
    expect(fallo.ultimoError.length).toBeLessThanOrEqual(300);
  });

  it('sin mensaje deja algo legible en vez de "undefined"', () => {
    expect(registrarFallo(pendiente(), undefined, T0).ultimoError).toBe('error sin mensaje');
  });
});

describe('vuelta a la normalidad — el contador se resetea (B-13)', () => {
  it('un disparo exitoso baja el flag y limpia el contador', () => {
    const exito = registrarExito(T0);
    expect(exito).toMatchObject({ pendiente: false, intentos: 0, ultimoError: null, agotado: false });
    expect(decidirDisparo({ ...pendiente(), ...exito }, T0 + 60 * MINUTO).motivo).toBe(
      'sin-pendiente',
    );
  });

  it('un cambio nuevo rearma los intentos después de haberlos agotado', () => {
    // El caso real: el PAT venció, se agotaron los reintentos, el dueño lo
    // renovó. La próxima edición de una actividad tiene que volver a disparar
    // sin que nadie toque el documento a mano.
    const agotado = pendiente({ intentos: MAX_INTENTOS, agotado: true, ultimoIntento: ts(T0) });
    expect(decidirDisparo(agotado, T0 + 60 * MINUTO).motivo).toBe('agotado');

    const remarcado = { ...agotado, pendiente: true, ...CAMPOS_REARME };
    expect(decidirDisparo(remarcado, T0 + 60 * MINUTO)).toEqual({ accion: 'disparar', intento: 1 });
  });

  it('la secuencia completa: falla, reintenta, se agota, y se recupera', () => {
    let estado: Record<string, unknown> = pendiente();
    let ahora = T0;
    const intentos: number[] = [];

    // 24 horas de ticks cada 5 minutos con GitHub caído.
    for (let tick = 0; tick < 288; tick += 1) {
      const d = decidirDisparo(estado, ahora);
      if (d.accion === 'disparar') {
        intentos.push(ahora - T0);
        estado = { ...estado, ...registrarFallo(estado, 'HTTP 500', ahora) };
      }
      ahora += 5 * MINUTO;
    }

    // Cinco intentos y se detiene: sin el límite serían 288.
    expect(intentos).toHaveLength(MAX_INTENTOS);
    expect(intentos.map((ms) => ms / MINUTO)).toEqual([0, 5, 15, 35, 75]);
    expect(estado.agotado).toBe(true);
    expect(estado.ultimoError).toBe('HTTP 500');

    // GitHub volvió y el dueño editó una actividad: rearma y dispara.
    const remarcado = { ...estado, pendiente: true, ...CAMPOS_REARME };
    expect(decidirDisparo(remarcado, ahora).accion).toBe('disparar');
    const exito = registrarExito(ahora);
    expect(decidirDisparo({ ...remarcado, ...exito }, ahora).motivo).toBe('sin-pendiente');
  });
});

describe('registrarExito — la marca del documento (B-85)', () => {
  it('sin marcas se comporta como antes: baja el flag', () => {
    expect(registrarExito(T0).pendiente).toBe(false);
  });

  it('con la misma marca a los dos lados baja el flag', () => {
    expect(
      registrarExito(T0, { marcaLeida: ts(T0 - MINUTO), marcaActual: ts(T0 - MINUTO) }).pendiente,
    ).toBe(false);
  });

  /**
   * El caso de B-85: una actividad guardada mientras el `fetch` a GitHub estaba
   * en vuelo marcó su rebuild, y ese cambio no entró al build que arrancó.
   */
  it('si la marca cambió durante el dispatch, `pendiente` queda arriba', () => {
    const exito = registrarExito(T0, {
      marcaLeida: ts(T0 - MINUTO),
      marcaActual: ts(T0 - 30_000),
    });
    expect(exito.pendiente).toBe(true);
    // El disparo salió bien: el contador igual se resetea.
    expect(exito).toMatchObject({ intentos: 0, ultimoError: null, agotado: false });
    // Y el próximo tick lo dispara, sin backoff.
    expect(decidirDisparo({ ...pendiente(), ...exito }, T0 + MINUTO).accion).toBe('disparar');
  });

  it('un documento sin marca que aparece con marca también queda pendiente', () => {
    // El caso de un `sistema/rebuild` escrito por la versión anterior.
    expect(registrarExito(T0, { marcaLeida: null, marcaActual: ts(T0) }).pendiente).toBe(true);
  });

  it('acepta Date y milisegundos, no solo Timestamp', () => {
    expect(registrarExito(T0, { marcaLeida: new Date(T0), marcaActual: T0 }).pendiente).toBe(false);
    expect(registrarExito(T0, { marcaLeida: new Date(T0), marcaActual: T0 + 1 }).pendiente).toBe(
      true,
    );
  });
});

/**
 * ── B-884 · «pendiente» significa lo que no queremos que signifique ────────
 *
 * `pendiente` se baja cuando GitHub **acepta** el `repository_dispatch`, no
 * cuando el sitio tiene el cambio. Si el build muere después, nadie reintenta y
 * el documento dice que está todo bien — verificado: los tres lugares que
 * escriben el flag (`marcarRebuild`, `registrarFallo`, `registrarExito`) son
 * ciegos al resultado del build, y `deploy.yml` no escribe en Firestore ni
 * siquiera en los jobs de aviso que le agregó B-883.
 *
 * **Esto no lo arregla**, y el docblock de `rebuild.js` lo dice con todas las
 * letras: confirmar que el build llegó pide comparar contra el `events.json`
 * vivo, y eso es otro frente. Lo que se fija acá es la **mitad comparable**: el
 * despacho deja escrito qué cubre y cuándo salió, que es lo que hoy no existía.
 */
describe('el registro de lo que se despachó — B-884', () => {
  const marcaVieja = ts(T0 - MINUTO);
  const marcaNueva = ts(T0 - 30_000);

  /**
   * **La decisión que fija este caso**, y es la que se pone roja si alguien
   * ancla en la marca actual: el build que arranca lee Firestore *después* del
   * dispatch, así que cubre **al menos** todo lo marcado hasta `marcaLeida`.
   * Anclar en `marcaActual` afirmaría que cubre el cambio que llegó en el medio
   * —el que B-85 deja justamente pendiente— y el que venga a confirmar se lo
   * creería: sería B-85 otra vez, un nivel más arriba y con la mentira firmada.
   */
  it('el ancla es la marca leída antes del dispatch, no la que hay al escribir', () => {
    const exito = registrarExito(T0, { marcaLeida: marcaVieja, marcaActual: marcaNueva });
    expect(exito.despacho.cubreHasta).toBe(marcaVieja);
    // Y el otro lado de la misma escritura: el flag queda arriba (B-85).
    expect(exito.pendiente).toBe(true);
  });

  it('bajar el flag y decir qué se despachó van en la misma escritura', () => {
    // Si `pendiente` baja, el documento tiene que quedar diciendo qué tendría
    // que estar publicado. Es lo único que hace auditable un `false`.
    const exito = registrarExito(T0, {
      marcaLeida: marcaVieja,
      marcaActual: marcaVieja,
      motivo: 'actividad abc123',
    });
    expect(exito.pendiente).toBe(false);
    expect(cubiertoPorElUltimoDespacho(exito)).toBe(T0 - MINUTO);
  });

  it('guarda el motivo que viajó, que es el leído y no el de arriba del documento', () => {
    const exito = registrarExito(T0, {
      marcaLeida: marcaVieja,
      marcaActual: marcaNueva,
      motivo: 'actividad A',
    });
    // Arriba del documento el motivo ya es "actividad B" —lo pisó la marca que
    // llegó durante el dispatch—, pero lo que se despachó fue "actividad A".
    expect(exito.despacho.motivo).toBe('actividad A');
  });

  it('sin marca y sin motivo el registro queda en null, nunca en undefined', () => {
    // Firestore rechaza `undefined`: sin el `?? null` la escritura del éxito
    // falla entera, o sea que el tick que **sí** despachó quedaría contado como
    // uno que no. Es el caso de un `sistema/rebuild` anterior a B-884.
    expect(registrarExito(T0).despacho).toStrictEqual({ cubreHasta: null, motivo: null });
  });

  it('un disparo que falló no mueve el ancla: no despachó nada', () => {
    // El último despacho que sí salió sigue siendo el que describe qué tendría
    // que estar publicado, y pisarlo con un fallo borraría esa referencia justo
    // cuando hace falta.
    expect(registrarFallo(pendiente(), 'HTTP 500', T0)).not.toHaveProperty('despacho');
  });

  it('una marca nueva rearma el contador y deja el registro en pie', () => {
    // `CAMPOS_REARME` resetea los intentos porque un cambio nuevo merece los
    // suyos; el ancla no, porque una marca nueva no invalida lo que el último
    // despacho cubría. Borrarla le sacaría el piso al que venga a confirmar
    // justo en el caso peor: un cambio encima de un build que quizá no llegó.
    expect(CAMPOS_REARME).not.toHaveProperty('despacho');
    const doc = {
      ...registrarExito(T0, {
        marcaLeida: marcaVieja,
        marcaActual: marcaVieja,
        motivo: 'actividad A',
      }),
      pendiente: true,
      ...CAMPOS_REARME,
    };
    expect(cubiertoPorElUltimoDespacho(doc)).toBe(T0 - MINUTO);
  });

  it('el lector normaliza a milisegundos y distingue «no sé» de «al día»', () => {
    expect(cubiertoPorElUltimoDespacho({ despacho: { cubreHasta: ts(T0) } })).toBe(T0);
    expect(cubiertoPorElUltimoDespacho({ despacho: { cubreHasta: new Date(T0) } })).toBe(T0);
    // Los dos casos sin ancla. `null` es «este documento no alcanza para
    // juzgarlo», y el que confirme tiene que leerlo así y no como «está al
    // día»: un documento anterior a B-884 con `pendiente: false` no dice nada
    // sobre si el sitio está publicado.
    expect(cubiertoPorElUltimoDespacho({ pendiente: false })).toBe(null);
    expect(cubiertoPorElUltimoDespacho(null)).toBe(null);
  });

  /**
   * Sobre el fuente, como el resto de lo que ata el schedule a su módulo puro
   * (`tests/costuras.test.ts`, B-85): que lo que se **registra** sea lo que
   * **viajó** no se puede afirmar desde el módulo puro, porque el que elige las
   * dos cosas es el trigger. Las dos líneas nombran `estado.motivo` —el valor
   * leído antes del `fetch`— y esa coincidencia es la propiedad.
   */
  it('lo que se registra es lo que viajó: las dos veces, el motivo leído', () => {
    const src = fuenteDeLaFunction('dispararRebuild');
    expect(src, 'el dispatch dejó de mandar el motivo leído').toContain(
      'dispararDispatch(GITHUB_REPO, token, estado.motivo)',
    );
    expect(src, 'el registro dejó de guardar el motivo leído').toContain(
      'motivo: estado.motivo ?? null,',
    );
  });
});
