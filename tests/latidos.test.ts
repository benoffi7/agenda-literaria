/**
 * **Un barrido que deja de correr avisa** — B-2220.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  BARRIDOS_CON_LATIDO,
  ENTRE_AVISOS_MS,
  PLAZO_LATIDO_MS,
  latidosVencidos,
} from '../functions/latidos.js';
import { conAlertaDeBarrido } from '../functions/barridos.js';

const AHORA = 1_800_000_000_000;
const HORA = 60 * 60 * 1000;

const todosHace = (ms: number) =>
  Object.fromEntries(BARRIDOS_CON_LATIDO.map((n) => [n, AHORA - ms]));

describe('cuándo un barrido dejó de latir — B-2220', () => {
  it('con todos al día no hay nada', () => {
    expect(latidosVencidos({ desde: AHORA - 10 * 24 * HORA, ...todosHace(20 * HORA) }, AHORA)).toEqual([]);
  });

  it('el que pasó las 48 horas sale, y solo ése', () => {
    // Mutación probada: comparar contra 24 h en vez de 48 pone esto rojo.
    const doc = { desde: AHORA - 10 * 24 * HORA, ...todosHace(20 * HORA), borrarFichasVencidas: AHORA - PLAZO_LATIDO_MS - 1 };
    expect(latidosVencidos(doc, AHORA)).toEqual(['borrarFichasVencidas']);
  });

  it('el deploy que lo estrena no avisa: sin latido se cuenta desde `desde`', () => {
    expect(latidosVencidos({ desde: AHORA - 2 * HORA }, AHORA)).toEqual([]);
    expect(latidosVencidos(null, AHORA)).toEqual([]);
    // Pero si pasan dos días sin que un barrido lata nunca, sí.
    expect(latidosVencidos({ desde: AHORA - PLAZO_LATIDO_MS - 1 }, AHORA)).toEqual([...BARRIDOS_CON_LATIDO]);
  });

  it('una vez avisado no repite hasta el día siguiente', () => {
    const vencido = { desde: AHORA - 10 * 24 * HORA, ...todosHace(20 * HORA), limpiarVersionesHuerfanas: AHORA - 3 * 24 * HORA };
    expect(latidosVencidos({ ...vencido, avisado: { limpiarVersionesHuerfanas: AHORA - HORA } }, AHORA)).toEqual([]);
    expect(
      latidosVencidos({ ...vencido, avisado: { limpiarVersionesHuerfanas: AHORA - ENTRE_AVISOS_MS - 1 } }, AHORA),
    ).toEqual(['limpiarVersionesHuerfanas']);
  });

  it('lee también un Timestamp de Firestore', () => {
    const ts = (ms: number) => ({ toMillis: () => ms });
    expect(latidosVencidos({ desde: ts(AHORA - 10 * 24 * HORA), borrarPropuestasVencidas: ts(AHORA - 3 * 24 * HORA), ...Object.fromEntries(BARRIDOS_CON_LATIDO.filter((n) => n !== 'borrarPropuestasVencidas').map((n) => [n, ts(AHORA - HORA)])) }, AHORA)).toEqual(['borrarPropuestasVencidas']);
  });
});

describe('el envoltorio late solo si salió bien — B-2220', () => {
  it('bien: late; mal: no late y vuelve a tirar', async () => {
    const latir = vi.fn(async () => {});
    const logger = { error: vi.fn(), warn: vi.fn() };
    await conAlertaDeBarrido(logger, 'x', async () => 'ok', latir)();
    expect(latir).toHaveBeenCalledTimes(1);
    await expect(
      conAlertaDeBarrido(logger, 'x', async () => {
        throw new Error('roto');
      }, latir)(),
    ).rejects.toThrow('roto');
    expect(latir).toHaveBeenCalledTimes(1);
  });

  it('un latido que no se anota no tira una corrida que ya hizo su trabajo', async () => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const r = await conAlertaDeBarrido(logger, 'x', async () => 'ok', async () => {
      throw new Error('sin permiso');
    })();
    expect(r).toBe('ok');
    expect(logger.warn).toHaveBeenCalled();
  });

  it.each(BARRIDOS_CON_LATIDO)('%s pasa su latido al envoltorio', (nombre) => {
    const archivos = ['functions/retencion-trigger.js', 'functions/imagenes-limpieza-trigger.js', 'functions/versiones-limpieza-trigger.js'];
    expect(archivos.some((a) => readFileSync(a, 'utf8').includes(`latido('${nombre}')`))).toBe(true);
  });

  it('la frescura los vigila antes de cualquier corte', () => {
    const src = readFileSync('functions/frescura-trigger.js', 'utf8');
    const handler = src.slice(src.indexOf('export const verificarFrescuraDelSitio'));
    expect(handler.indexOf('await vigilarLatidos(db, ahora)')).toBeGreaterThan(-1);
    expect(handler.indexOf('await vigilarLatidos(db, ahora)')).toBeLessThan(handler.indexOf('return;'));
  });
});
