/**
 * La guarda contra la copia diez — B-1130.
 *
 * El arreglo de B-1130 fue mudar **nueve** copias de «capturo el error, miro el
 * `code`» a `tests/fixtures/rechazos-del-emulador.ts`. Sin nada que lo
 * sostenga, la próxima persona que escriba un test de reglas copia el helper
 * del archivo de al lado —que hasta ayer era una copia— y la clase vuelve a
 * nacer sola. Ya pasó con `git ls-files` (B-964) y con las credenciales del
 * emulador (B-1060), y acá el docblock de `escritura-anonima` dejaba escrito el
 * motivo de una de las copias: «está acá y no importado porque ese archivo no lo
 * exporta».
 *
 * **Y el costo no era el tipeo.** Las nueve afirmaban lo mismo con textos
 * distintos, ninguna podía distinguir «la regla denegó» de «la regla nunca
 * contestó», y la que se propuso arreglarlo (`RECHAZADA = /permission|
 * insufficient/i`) matcheaba las dos cosas. Con una sola implementación, la
 * pregunta que faltaba se agregó **una** vez y la contestan los 280 casos.
 *
 * ── Qué persigue, y por qué no persigue el literal ───────────────────────
 * `'permission-denied'` aparece de forma legítima en media docena de tests que
 * no tienen nada que ver con el emulador: el traductor de errores del panel
 * (`fallos-del-panel.test.ts`), la analítica (`analytics-eventos.test.ts`). Un
 * barrido por el literal sería la red de D-88 con la firma equivocada, que es
 * exactamente lo que B-1113 dice que no hay que hacer.
 *
 * Lo que se persigue es la **forma de la copia**: leer el `code` de un error
 * capturado con el casteo que hacían las seis, y la regex que las reemplazaba.
 * Es angosta a propósito — pero es la firma de lo que realmente volvió a nacer
 * nueve veces. **La escribió el barrido, no la lectura:** el primer recuento a
 * mano decía seis, y tres archivos tenían además del helper de escrituras uno
 * aparte para lecturas. Aparecieron cuando la guarda corrió.
 *
 * **Lo que NO cubre, dicho:** un `rejects.toThrow()` pelado. Es *más* débil que
 * la regex vieja —lo satisface un emulador caído— pero no se puede perseguir por
 * texto sin marcar los dos usos que quedan y son legítimos:
 *
 *  - `storage-reglas.integracion.test.ts`, porque el emulador de Storage tiene
 *    sus propios códigos y este helper es de Firestore;
 *  - `opciones.integracion.test.ts`, donde lo que tira es `upsertOpcion()` —el
 *    código del panel validando antes de escribir— y no una regla.
 *
 * **Y no es un punto ciego teórico: ya dejó pasar cuatro.** Dos `getDoc` en
 * `/reportes` y dos en `/propuestas` quedaron con el `toThrow()` pelado en
 * archivos que esta misma migración tocó línea por línea. Están migrados —los
 * encontró el `auditor-trampas` sobre este cambio, no la guarda ni la suite—, y
 * el que se quede sin red es el **próximo**. Cerrarlo pediría un barrido que
 * entienda en qué `describe` está parada cada llamada; queda anotado como
 * **B-1132**, porque es otra clase de chequeo y no un `if` más acá.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { archivosDelRepo } from './fixtures/archivos-del-repo';

const raiz = new URL('..', import.meta.url);
const ruta = (relativo: string) => fileURLToPath(new URL(relativo, raiz));

const HELPER = 'tests/fixtures/rechazos-del-emulador.ts';

/**
 * Excepciones, cada una con su motivo — nunca un patrón. Un patrón («todo lo
 * que empiece con `tests/fixtures/`») dejaría pasar la próxima copia sin que
 * nadie lo decida, y esta lista es el chequeo.
 */
const EXCEPCIONES: Record<string, string> = {
  [HELPER]: 'es la implementación misma',
  'tests/rechazos-sin-copia.test.ts':
    'escribe los dos patrones a propósito, como control de las mutaciones de abajo',
};

/**
 * Las dos formas de la copia.
 *
 * El casteo es literal —es cómo estaba escrito en las nueve, palabra por
 * palabra— y la regex es la constante `RECHAZADA` que cinco archivos
 * declaraban idéntica.
 */
const COPIA = [
  /as\s*\{\s*code\?:\s*string\s*\}\s*\)?\s*\.code/,
  /\/permission\|insufficient\//,
];

const candidatos = (): string[] =>
  archivosDelRepo('tests').filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

const infractores = (): string[] =>
  candidatos().filter((f) => {
    if (f in EXCEPCIONES) return false;
    const fuente = readFileSync(ruta(f), 'utf8');
    return COPIA.some((patron) => patron.test(fuente));
  });

// Una copia sintética, sin rastrear: `archivosDelRepo` la ve (B-964) y el
// barrido tiene que marcarla. Es el control de mutación del bloque de abajo.
const COPIA_TMP = 'tests/fixtures/.mutacion-b1130-tmp.ts';

describe('nadie escribe su propio helper de rechazo — B-1130', () => {
  afterEach(() => {
    const absoluto = ruta(COPIA_TMP);
    if (existsSync(absoluto)) rmSync(absoluto);
  });

  it('el barrido encuentra archivos de verdad', () => {
    // Control positivo: sin esto, un `archivosDelRepo` vacío —o un prefijo mal
    // escrito— haría pasar todo lo de abajo sin haber mirado nada (B-873).
    expect(candidatos().length).toBeGreaterThan(100);
  });

  it('la implementación de verdad mira el `code`, y las excepciones son dos', () => {
    // Si el helper dejara de mirar el `code`, su excepción pasaría a cubrir un
    // archivo que no lo hace y el barrido quedaría protegiendo nada.
    const fuente = readFileSync(ruta(HELPER), 'utf8');
    expect(fuente).toMatch(/code\?: string/);
    expect(fuente).toMatch(/'permission-denied'/);

    // Y la lista no crece sin que alguien venga a escribir el motivo acá: una
    // excepción de más es una copia aprobada por cansancio.
    expect(Object.keys(EXCEPCIONES)).toEqual([HELPER, 'tests/rechazos-sin-copia.test.ts']);
  });

  it('ningún archivo de `tests/` arma su propio veredicto de rechazo', () => {
    expect(
      infractores(),
      'estos archivos miran el `code` por su cuenta en vez de pasar por ' +
        `\`${HELPER}\` (denegada / denegadaOReglaQueTira): ` +
        `${infractores().join(', ') || '(ninguno)'}`,
    ).toEqual([]);
  });

  it('mutación — una copia nueva con el casteo del `code` se marca', () => {
    writeFileSync(
      ruta(COPIA_TMP),
      'export const r = (e: unknown) => (e as { code?: string }).code === "permission-denied";\n',
    );

    expect(infractores()).toContain(COPIA_TMP);
  });

  it('mutación — una copia nueva con la regex del mensaje se marca', () => {
    writeFileSync(ruta(COPIA_TMP), 'export const RECHAZADA = /permission|insufficient/i;\n');

    expect(infractores()).toContain(COPIA_TMP);
  });

  it('mutación al revés — nombrar el code en prosa no alcanza para ser infractor', () => {
    // El traductor de errores del panel compara `code` contra
    // `'permission-denied'` con toda razón: lo que se persigue es el helper de
    // test, no el literal.
    writeFileSync(
      ruta(COPIA_TMP),
      '// Un rechazo llega como `permission-denied` y el panel lo traduce.\n' +
        'export const texto = (code: string) => (code === "permission-denied" ? "no podés" : "");\n',
    );

    expect(infractores()).not.toContain(COPIA_TMP);
  });
});
