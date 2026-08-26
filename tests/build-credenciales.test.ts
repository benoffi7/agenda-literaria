import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * B-189 — un build sin credenciales no puede leer Firestore, y no puede
 * enterarse tarde.
 *
 * La guarda `hayCredenciales()` estuvo escrita desde el principio **sin que la
 * llamara nadie**: era para el consumidor que todavía no existía (el
 * `events.json` y las páginas de detalle del sitio público), y el patrón que la
 * deja apagada es que el consumidor nazca sin llamarla. Estos tests son lo que
 * evita que vuelva a pasar, y por eso son dos cosas distintas:
 *
 * 1. **La puerta tira** cuando no hay con qué leer.
 * 2. **La puerta es la única**: nada en `src/` habla con el Admin SDK por su
 *    cuenta. Es lo que hace que un consumidor nuevo no pueda esquivarla ni por
 *    olvido — no hay otro camino a Firestore en build time.
 *
 * El síntoma que evita, si esto se rompe: un `events.json` vacío publicado
 * encima del sitio que sí tenía datos, sin error, sin log y con el workflow en
 * verde. O sea el sitio público vacío e indexado por Google, que es el objetivo
 * del proyecto al revés.
 */

/** El config de vitest exporta el emulador para todos los tests: hay que sacarlo. */
const sinCredenciales = () => {
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', '');
  vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', '');
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '');
};

/** Módulo fresco: el `_app` y el registro del SDK se cachean por módulo. */
const cargar = async () => {
  vi.resetModules();
  return import('@/lib/firebase-admin');
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('hayCredenciales — la pregunta sobre el entorno', () => {
  it('sin ninguna de las tres variables, no hay con qué leer', async () => {
    sinCredenciales();
    const { hayCredenciales } = await cargar();
    expect(hayCredenciales()).toBe(false);
  });

  it.each([
    ['FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080'],
    ['FIREBASE_SERVICE_ACCOUNT', '{"project_id":"agenda-literaria"}'],
    ['GOOGLE_APPLICATION_CREDENTIALS', '/tmp/sa.json'],
  ])('%s alcanza', async (variable, valor) => {
    sinCredenciales();
    vi.stubEnv(variable, valor);
    const { hayCredenciales } = await cargar();
    expect(hayCredenciales()).toBe(true);
  });
});

describe('la puerta a Firestore no abre sin credenciales', () => {
  it('adminApp tira, y el mensaje dice qué hacer', async () => {
    sinCredenciales();
    const { adminApp } = await cargar();
    expect(() => adminApp()).toThrow(/[Bb]uild sin credenciales/);
    // El mensaje nombra las tres salidas: un build que corta sin decir cómo
    // seguir se resuelve comentando la guarda.
    expect(() => adminApp()).toThrow(/FIRESTORE_EMULATOR_HOST/);
    expect(() => adminApp()).toThrow(/FIREBASE_SERVICE_ACCOUNT/);
  });

  it('adminDb tampoco, porque pasa por la misma puerta', async () => {
    sinCredenciales();
    const { adminDb } = await cargar();
    expect(() => adminDb()).toThrow(/[Bb]uild sin credenciales/);
  });

  it('con el emulador arriba abre, que es el camino local del §10', async () => {
    sinCredenciales();
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
    const { adminApp } = await cargar();
    // No hay red acá: `initializeApp` contra el emulador no necesita credencial.
    expect(() => adminApp()).not.toThrow();
  });
});

describe('la guarda está llamada, no solo escrita', () => {
  const FUENTE_ADMIN = 'src/lib/firebase-admin.ts';
  const fuenteAdmin = readFileSync(FUENTE_ADMIN, 'utf8');

  it('adminApp la llama', () => {
    // El bug original era exactamente esto: la función exportada y ninguna
    // llamada en todo el repo.
    const cuerpo = fuenteAdmin.slice(fuenteAdmin.indexOf('export const adminApp'));
    expect(cuerpo).toContain('hayCredenciales()');
  });

  it('la puerta es única: nada más en src/ importa el Admin SDK', () => {
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(dir)) {
        const ruta = join(dir, entrada);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.(ts|tsx|astro|mjs)$/.test(entrada)) archivos.push(ruta);
      }
    };
    recorrer('src');
    expect(archivos.length).toBeGreaterThan(20);

    const colados = archivos.filter(
      (a) =>
        a.replace(/\\/g, '/') !== FUENTE_ADMIN &&
        /from\s+'firebase-admin/.test(readFileSync(a, 'utf8')),
    );
    expect(
      colados,
      'estos archivos hablan con el Admin SDK sin pasar por firebase-admin.ts, ' +
        'así que un build sin credenciales los deja leer cero documentos en silencio',
    ).toEqual([]);
  });

  it('los dos workflows le pasan las credenciales al build', () => {
    // La guarda corta el build; que en CI **haya** con qué leer es la otra
    // mitad, y vive en los workflows. Sin esto, cerrar B-106 dejaría los dos
    // deploys rojos y la salida fácil sería sacar la guarda.
    for (const wf of ['.github/workflows/deploy.yml', '.github/workflows/push-main.yml']) {
      const src = readFileSync(wf, 'utf8');
      const build = src.slice(src.indexOf('run: npm run build'));
      expect(build, `${wf}: el paso de build no recibe FIREBASE_SERVICE_ACCOUNT`).toMatch(
        /FIREBASE_SERVICE_ACCOUNT/,
      );
    }
  });
});
