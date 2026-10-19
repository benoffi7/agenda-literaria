/**
 * **Un barrido programado que falla entero avisa** — B-2195.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { conAlertaDeBarrido } from '../functions/barridos.js';

describe('conAlertaDeBarrido — B-2195', () => {
  it('loguea con `alerta` y vuelve a tirar: la corrida sigue figurando fallida', async () => {
    const logger = { error: vi.fn() };
    const roto = conAlertaDeBarrido(logger, 'unBarrido', async () => {
      throw new Error('la query se cayó');
    });
    await expect(roto()).rejects.toThrow('la query se cayó');
    expect(logger.error).toHaveBeenCalledWith(
      'falló un barrido programado entero',
      expect.objectContaining({ alerta: 'barrido-fallo', barrido: 'unBarrido' }),
    );
  });

  it('si sale bien no loguea nada', async () => {
    const logger = { error: vi.fn() };
    await conAlertaDeBarrido(logger, 'unBarrido', async () => 'ok')();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    ['functions/retencion-trigger.js', 'borrarPropuestasVencidas'],
    ['functions/retencion-trigger.js', 'borrarFichasVencidas'],
    ['functions/imagenes-limpieza-trigger.js', 'limpiarImagenesHuerfanas'],
    ['functions/versiones-limpieza-trigger.js', 'limpiarVersionesHuerfanas'],
  ])('%s · %s va envuelto', (archivo, nombre) => {
    // Mutación probada: sacarle el envoltorio a uno lo pone rojo.
    const src = readFileSync(archivo, 'utf8');
    const desde = src.indexOf(`export const ${nombre} = onSchedule(`);
    expect(desde).toBeGreaterThan(-1);
    const resto = src.slice(desde, src.indexOf('\n);', desde));
    expect(resto).toContain(`conAlertaDeBarrido(logger, '${nombre}', async () => {`);
  });
});
