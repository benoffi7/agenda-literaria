/**
 * La guarda contra la copia quince — B-1060.
 *
 * El arreglo de B-1060 fue mudar catorce copias de «app admin efímera +
 * `createUser` + `setCustomUserClaims` + `createCustomToken`» a
 * `tests/fixtures/credenciales-del-emulador.ts`. Sin nada que lo sostenga, la
 * próxima persona que escriba un test de integración copia el `beforeAll` del
 * archivo de al lado —que hasta ayer era una copia— y la clase vuelve a nacer
 * sola. Ya pasó con `git ls-files` (B-964) y con el `rechazada()` que sigue
 * duplicado en cuatro archivos.
 *
 * **Y el costo no es el tipeo.** Es que una copia difiera en algo que importa
 * sin que nadie lo vea: B-895 unificó los claims hacia la vía de producción en
 * diez archivos y se salteó `reportes-resuelto.integracion.test.ts`, que los
 * pasaba por las **dos** vías a la vez. Ese archivo habría seguido verde aunque
 * la vía fiel dejara de funcionar, que es exactamente lo que B-895 quería poder
 * detectar. Con una sola implementación, esa diferencia no tiene dónde
 * esconderse.
 *
 * El barrido mira `tests/` buscando las dos llamadas que arman una credencial.
 * No mira `scripts/`: ahí `set-admin-claim.mjs` y `preparar-produccion.mjs`
 * **son** producción poniendo el claim, que es justo lo que el helper imita.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { archivosDelRepo } from './fixtures/archivos-del-repo';

const raiz = new URL('..', import.meta.url);
const ruta = (relativo: string) => fileURLToPath(new URL(relativo, raiz));

const HELPER = 'tests/fixtures/credenciales-del-emulador.ts';

/**
 * Excepciones, cada una con su motivo — nunca un patrón. Un patrón («todo lo
 * que empiece con `tests/fixtures/`») dejaría pasar la próxima copia sin que
 * nadie lo decida, y esta lista es el chequeo.
 */
const EXCEPCIONES: Record<string, string> = {
  [HELPER]: 'es la implementación misma',
  'tests/credenciales-del-emulador.test.ts':
    'escribe las dos llamadas a propósito, como control de las mutaciones de abajo',
};

/**
 * Las dos llamadas que arman una credencial contra el emulador de Auth.
 *
 * El `\.` de adelante no es decorativo: hay archivos que **nombran** estas
 * funciones en prosa —`tests/guardas-de-los-scripts.test.ts` explica en un
 * docblock la diferencia entre las dos vías de B-895— y un barrido que los
 * marque como infractores termina con una lista de excepciones que no dice
 * nada. Lo que se persigue es la **llamada**, no la mención.
 */
const ARMA_CREDENCIAL = /\.\s*(createCustomToken|setCustomUserClaims)\s*\(/;

const candidatos = (): string[] =>
  archivosDelRepo('tests').filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

const infractores = (): string[] =>
  candidatos().filter(
    (f) => !(f in EXCEPCIONES) && ARMA_CREDENCIAL.test(readFileSync(ruta(f), 'utf8')),
  );

// Una copia sintética, sin rastrear: `archivosDelRepo` la ve (B-964) y el
// barrido tiene que marcarla. Es el control de mutación del bloque de abajo.
const COPIA_TMP = 'tests/fixtures/.mutacion-b1060-tmp.ts';

describe('nadie arma credenciales del emulador fuera del helper — B-1060', () => {
  afterEach(() => {
    const absoluto = ruta(COPIA_TMP);
    if (existsSync(absoluto)) rmSync(absoluto);
  });

  it('el barrido encuentra archivos de verdad', () => {
    // Control positivo: sin esto, un `archivosDelRepo` vacío —o un prefijo mal
    // escrito— haría pasar todo lo de abajo sin haber mirado nada (B-873).
    expect(candidatos().length).toBeGreaterThan(100);
  });

  it('las excepciones son dos, y la implementación de verdad arma credenciales', () => {
    // Si el helper dejara de tener las dos llamadas, su excepción pasaría a
    // cubrir un archivo que no las usa y el barrido quedaría protegiendo nada.
    const fuente = readFileSync(ruta(HELPER), 'utf8');
    expect(fuente).toMatch(/\.setCustomUserClaims\(/);
    expect(fuente).toMatch(/\.createCustomToken\(/);

    // Y la lista no crece sin que alguien venga a escribir el motivo acá: una
    // excepción de más es una copia aprobada por cansancio.
    expect(Object.keys(EXCEPCIONES)).toEqual([HELPER, 'tests/credenciales-del-emulador.test.ts']);
  });

  it('ningún archivo de `tests/` llama a createCustomToken o setCustomUserClaims', () => {
    expect(
      infractores(),
      'estos archivos arman su propia credencial en vez de pasar por ' +
        `\`${HELPER}\` (tokenDe / entrarComo): ${infractores().join(', ') || '(ninguno)'}`,
    ).toEqual([]);
  });

  it('mutación — una copia nueva con `createCustomToken` se marca', () => {
    writeFileSync(
      ruta(COPIA_TMP),
      'export const t = async (a: { createCustomToken: (u: string) => Promise<string> }) =>\n' +
        '  await a.createCustomToken("uid");\n',
    );

    expect(infractores()).toContain(COPIA_TMP);
  });

  it('mutación — una copia nueva con `setCustomUserClaims` se marca', () => {
    writeFileSync(
      ruta(COPIA_TMP),
      'export const c = async (a: { setCustomUserClaims: (u: string, k: object) => Promise<void> }) =>\n' +
        '  await a.setCustomUserClaims("uid", { admin: true });\n',
    );

    expect(infractores()).toContain(COPIA_TMP);
  });

  it('mutación al revés — nombrarlas en prosa no alcanza para ser infractor', () => {
    // La otra mitad de la mutación: un barrido que también marque las menciones
    // obliga a excepcionar archivos que no copian nada, y una lista de
    // excepciones inflada deja de ser un chequeo.
    writeFileSync(
      ruta(COPIA_TMP),
      '/** Habla de createCustomToken(uid, claims) y de setCustomUserClaims, sin llamarlos. */\n' +
        'export const nada = 1;\n',
    );

    expect(infractores()).not.toContain(COPIA_TMP);
  });
});
