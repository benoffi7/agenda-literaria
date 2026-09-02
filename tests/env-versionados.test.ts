import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Los `.env` versionados no pueden llevar un secreto — B-213.
 *
 * ── Por qué hace falta un gate acá ─────────────────────────────────────────
 * `.gitignore` versiona algunos `.env` como **excepciones deliberadas y bien
 * argumentadas**: la config del SDK web es pública por diseño (viaja en el
 * bundle, §5.3) y `functions/.env` solo lleva el ID del calendario y el nombre
 * del repo. Todo eso es correcto.
 *
 * El problema es que la única defensa era la memoria, y ésta es la puerta que
 * publica de la forma **más irreversible que hay**: un commit a un repo público.
 * Todas las otras puertas del proyecto tienen gate automático —
 * `verificar-bundle.sh` como paso bloqueante en los dos workflows,
 * `build-credenciales.test.ts` recorriendo `src/`, `ssr.external` en
 * `astro.config.mjs`. Esta no tenía ninguno.
 *
 * ── Los archivos se descubren, no se listan ────────────────────────────────
 * B-213 hablaba de «los tres `.env` versionados». **Son cuatro**, y el que
 * faltaba es el que más importa: `.env.example` es el único que **nombra** las
 * tres claves secretas del proyecto (`FIREBASE_SERVICE_ACCOUNT`,
 * `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CALENDAR_ICS_PRIVADO`) con el `=`
 * ya puesto y el valor vacío. O sea que el camino más corto a la fuga no es
 * agregar una clave: es **rellenar una que ya está esperando** para probar algo
 * local, y commitear sin mirar.
 *
 * Por eso la lista sale de `git ls-files` y no está escrita acá: un quinto
 * archivo entra al gate solo, que es exactamente lo que le pasó al cuarto.
 *
 * ── Nunca se imprime un valor ──────────────────────────────────────────────
 * Un test que falla mostrando el secreto lo copia al log de CI, que también es
 * público. Los mensajes nombran el archivo, la clave y **qué patrón** matcheó.
 */
const RAIZ = fileURLToPath(new URL('..', import.meta.url));

/** Los `.env` que están en el índice de git. Cualquiera, en cualquier carpeta. */
const versionados = (): string[] =>
  execFileSync('git', ['ls-files'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n')
    .filter((f) => /(?:^|\/)\.env(?:\.|$)/.test(f))
    .sort();

interface Clave {
  archivo: string;
  clave: string;
  valor: string;
}

const claves = (archivo: string): Clave[] =>
  readFileSync(new URL(archivo, new URL('../', import.meta.url)), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return { archivo, clave: l.slice(0, i).trim(), valor: l.slice(i + 1).trim() };
    })
    .filter((c) => c.clave);

const TODAS = versionados().flatMap(claves);

/**
 * Las tres excepciones nombradas a mano, y por qué cada una.
 *
 * - `GOOGLE_CALENDAR_ID` — el calendario es el espejo **público** de la agenda
 *   (§7); su id no es más secreto que la URL de la que se suscribe la gente.
 * - `GITHUB_REPO` — es el nombre del repo. El PAT que autoriza a escribirle va
 *   a Secret Manager (§5.4), no acá.
 * - `FIRESTORE_EMULATOR_HOST` — una dirección de loopback (`127.0.0.1:8080`).
 *   No identifica nada ni autoriza nada, y solo tiene efecto en la máquina de
 *   quien la lee. Esta tercera la encontró el gate en su primera corrida, en
 *   `.env.example`, que es el archivo que B-213 no había contado.
 *
 * Agregar una cuarta excepción es una decisión, no un descuido: hay que
 * escribirla en esta lista y explicar por qué el valor puede ser público.
 */
const EXCEPCIONES = new Set([
  'GOOGLE_CALENDAR_ID',
  'GITHUB_REPO',
  'FIRESTORE_EMULATOR_HOST',
]);

/**
 * Formas de secreto, con nombre para que el mensaje de falla diga qué se vio sin
 * mostrarlo.
 *
 * Lo que **no** entra: `AIza…`. La API key del SDK web tiene esa forma y es
 * pública por diseño — es el valor que este proyecto versiona a propósito.
 * Ponerla acá haría fallar el gate contra su propio caso legítimo, y un gate que
 * grita por lo correcto enseña a apagarlo.
 */
const FORMAS_DE_SECRETO: [string, RegExp][] = [
  ['la URL privada de un ICS de Google Calendar', /private-[0-9a-f]{10,}/],
  ['una clave privada PEM', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['la clave privada de una service account JSON', /"private_key"\s*:/],
  ['un PAT clásico de GitHub', /\bghp_[A-Za-z0-9]{20,}/],
  ['un PAT de GitHub de nueva generación', /\bgithub_pat_[A-Za-z0-9_]{20,}/],
  ['un token de OAuth de GitHub', /\bgh[osu]_[A-Za-z0-9]{20,}/],
];

describe('los `.env` versionados — B-213', () => {
  it('se encontraron los archivos, y son los que se esperan hoy', () => {
    /*
     * Control positivo. Sin esto, un `git ls-files` que devuelva vacío —otro cwd,
     * un checkout sin índice— dejaría los tres asertos de abajo pasando sobre
     * una lista vacía: el gate daría verde sin haber mirado nada, que es
     * justamente el modo de falla que B-217 encontró en el paso 4 del gate.
     */
    const archivos = versionados();
    expect(archivos).toEqual([
      '.env.development',
      '.env.example',
      '.env.production',
      'functions/.env',
    ]);
    expect(TODAS.length).toBeGreaterThan(10);
  });

  it('toda clave es `PUBLIC_*`, o una excepción nombrada, o está vacía', () => {
    /*
     * Las tres formas legítimas, y la tercera es la que hace que `.env.example`
     * pueda seguir siendo una plantilla: nombrar `FIREBASE_SERVICE_ACCOUNT=` sin
     * valor es documentación; ponerle valor es una fuga.
     */
    const fuera = TODAS.filter(
      (c) => !c.clave.startsWith('PUBLIC_') && !EXCEPCIONES.has(c.clave) && c.valor !== '',
    ).map((c) => `${c.archivo}: ${c.clave} (no es PUBLIC_, no es excepción y tiene valor)`);
    expect(fuera).toEqual([]);
  });

  it('ningún valor tiene forma de secreto', () => {
    /*
     * La segunda mitad, y no es redundante con la primera: una clave
     * `PUBLIC_ALGO` pasa el filtro de nombres y podría llevar cualquier cosa
     * adentro. El prefijo dice dónde va a viajar el valor, no qué es.
     */
    const hallazgos: string[] = [];
    for (const c of TODAS) {
      for (const [nombre, patron] of FORMAS_DE_SECRETO) {
        if (patron.test(c.valor)) hallazgos.push(`${c.archivo}: ${c.clave} parece ${nombre}`);
      }
    }
    expect(hallazgos).toEqual([]);
  });

  it('las tres claves secretas del proyecto están nombradas pero vacías', () => {
    /*
     * El aserto que mira el caso concreto en vez de la propiedad, porque este
     * caso concreto es el candidato que B-213 nombraba: `GOOGLE_CALENDAR_ICS_PRIVADO`
     * es un secreto con forma de URL cómoda de pegar en un `.env`.
     *
     * Si alguna de las tres desaparece del `.env.example`, este test también
     * falla — y está bien que falle: la plantilla es el único lugar donde alguien
     * se entera de que esas variables existen y de que su valor no va al repo.
     */
    const secretas = ['FIREBASE_SERVICE_ACCOUNT', 'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CALENDAR_ICS_PRIVADO'];
    for (const clave of secretas) {
      const entradas = TODAS.filter((c) => c.clave === clave);
      expect(entradas.length, `${clave} ya no está en ningún .env versionado`).toBe(1);
      expect(entradas[0]!.archivo).toBe('.env.example');
      expect(entradas[0]!.valor, `${clave} tiene un valor cargado`).toBe('');
    }
  });

  it('el gate está documentado como tal en `.gitignore`', () => {
    /*
     * La excepción de `.gitignore` es un párrafo que explica por qué estos
     * archivos se versionan. Lo que le faltaba era decir quién lo vigila: sin
     * eso, el próximo que lea el párrafo tiene que decidir de nuevo si es
     * seguro, y la respuesta correcta («hay un test que lo verifica») no está
     * escrita en ningún lado donde la vaya a buscar.
     */
    expect(readFileSync(new URL('../.gitignore', import.meta.url), 'utf8')).toContain(
      'tests/env-versionados.test.ts',
    );
  });
});
