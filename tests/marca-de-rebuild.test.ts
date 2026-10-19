/**
 * **La marca del rebuild aguanta una ráfaga** — B-2193.
 *
 * Una carga masiva dispara cientos de `syncCalendar` que escriben todos el mismo
 * `sistema/rebuild`; la contención vuelve como ABORTED o RESOURCE_EXHAUSTED. Se
 * reintenta eso, y nada más.
 */
import { describe, expect, it } from 'vitest';
import { marcarRebuild } from '../functions/marca-de-rebuild.js';

const dbQueFalla = (codigos: number[]) => {
  const intentos = { total: 0 };
  return {
    intentos,
    doc: () => ({
      set: async () => {
        intentos.total += 1;
        const code = codigos.shift();
        if (code !== undefined) throw Object.assign(new Error(`grpc ${code}`), { code });
      },
    }),
  };
};

describe('marcarRebuild reintenta la contención — B-2193', () => {
  it('ABORTED y RESOURCE_EXHAUSTED se reintentan hasta que entra', async () => {
    const db = dbQueFalla([10, 8]);
    await marcarRebuild(db as never, 'actividad x', { esperas: [1, 1, 1], dormir: async () => {} });
    expect(db.intentos.total).toBe(3);
  });

  it('un error que no es pasajero sale a la primera', async () => {
    const db = dbQueFalla([7]); // PERMISSION_DENIED
    await expect(
      marcarRebuild(db as never, 'actividad x', { esperas: [1, 1], dormir: async () => {} }),
    ).rejects.toMatchObject({ code: 7 });
    expect(db.intentos.total).toBe(1);
  });

  it('agotados los intentos tira, y el trigger lo atrapa con alerta', async () => {
    const db = dbQueFalla([10, 10, 10]);
    await expect(
      marcarRebuild(db as never, 'actividad x', { esperas: [1, 1], dormir: async () => {} }),
    ).rejects.toMatchObject({ code: 10 });
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('functions/calendario-trigger.js', 'utf8');
    expect(src).toMatch(/try \{\s*await marcarRebuild\(db, `actividad \$\{id\}`\);\s*\} catch[\s\S]{0,200}alerta: 'rebuild-sin-marcar'/);
  });
});
