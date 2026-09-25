/**
 * **`admin:claim -- --ver` lee y no escribe, contra el emulador de Auth** — B-2051.
 *
 * El modo de solo lectura de `scripts/set-admin-claim.mjs` es la única rama del
 * script que no llama a `setCustomUserClaims`, y el default del script es
 * **dar admin**. Así que el modo de falla que importa no es que imprima mal: es
 * que un cambio en cómo se leen los argumentos haga caer el `--ver` a la rama
 * que escribe y le dé admin a la cuenta que se estaba mirando. Por eso se corre
 * el script de verdad, como proceso aparte, y se comparan los claims de la
 * cuenta **antes y después**.
 *
 * El proyecto va explícito (`PUBLIC_FIREBASE_PROJECT_ID`) y es el del emulador
 * de Auth vivo, no el de este checkout: Auth es de un solo proyecto (B-1201,
 * D-1020), y con otro el script buscaría la cuenta en un namespace vacío.
 *
 * Lo que dice de cada combinación de claims está en `describir-claims.test.ts`.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { describe, expect, it } from 'vitest';
import { HOST_AUTH, emuladorAuthVivo, proyectoDeAuth } from './emulador';
import { mailDe, tokenDe, uidDe } from './fixtures/credenciales-del-emulador';

const vivo = await emuladorAuthVivo();

const UID = uidDe('uid_claim_ver');
const MAIL = mailDe('claim-ver@ejemplo.test');

const correrScript = async (...args: string[]) => {
  const r = spawnSync('node', ['scripts/set-admin-claim.mjs', ...args], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      FIREBASE_AUTH_EMULATOR_HOST: HOST_AUTH,
      PUBLIC_FIREBASE_PROJECT_ID: await proyectoDeAuth(),
    },
    encoding: 'utf8',
  });
  return { codigo: r.status, salida: `${r.stdout}${r.stderr}` };
};

const claimsDe = async (uid: string): Promise<Record<string, unknown> | undefined> => {
  const app = initAdmin({ projectId: await proyectoDeAuth() }, `claim-ver-${Date.now()}-${Math.random()}`);
  try {
    return (await getAdminAuth(app).getUser(uid)).customClaims;
  } finally {
    await deleteAdminApp(app);
  }
};

describe.skipIf(!vivo)('`--ver` lee el rol y la ciudad sin escribir — B-2051', () => {
  it('un publicador de una ciudad: lo dice, y los claims quedan como estaban', async () => {
    const claims = { publicador: true, ciudad: 'mar-del-plata' };
    await tokenDe(UID, claims, { email: MAIL });

    const { codigo, salida } = await correrScript('--ver', MAIL);

    expect(codigo, salida).toBe(0);
    expect(salida).toContain('Objetivo: EMULADOR');
    expect(salida).toContain('SOLO LECTURA');
    expect(salida).toContain('Rol: publicador de mar-del-plata');
    expect(salida).toContain('Ciudad: mar-del-plata');
    // Lo que el ítem existe para impedir: que el default del script —admin— se
    // cuele. MUTACIÓN PROBADA: sacar el `process.exit(0)` del bloque `--ver`
    // deja la cuenta con `{ admin: true }` y este caso en rojo.
    expect(await claimsDe(UID)).toEqual(claims);
    expect(salida).not.toContain('El claim entra al token');
  });

  it('por uid también, y sin rol dice «sin rol»', async () => {
    await tokenDe(UID, {}, { email: MAIL });

    const { codigo, salida } = await correrScript('--ver', UID);

    expect(codigo, salida).toBe(0);
    expect(salida).toContain('Rol: sin rol');
    expect(salida).toContain('sin alcance por ciudad');
    expect(await claimsDe(UID)).toEqual({});
  });

  it('`--ver` con un flag de rol se rechaza antes de tocar la cuenta', async () => {
    await tokenDe(UID, { admin: true }, { email: MAIL });

    const { codigo, salida } = await correrScript('--ver', '--quitar', MAIL);

    expect(codigo).toBe(1);
    expect(salida).toContain('--ver solo lee');
    expect(await claimsDe(UID)).toEqual({ admin: true });
  });

  it('una cuenta que no existe se explica con el comando `--ver` listo para copiar', async () => {
    const { codigo, salida } = await correrScript('--ver', uidDe('uid_claim_ver_inexistente'));

    expect(codigo).toBe(1);
    expect(salida).toContain('No existe');
    expect(salida).toContain('admin:claim:prod -- --ver');
  });
});
