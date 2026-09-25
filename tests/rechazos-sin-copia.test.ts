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
 * el que se quedaba sin red era el **próximo**.
 *
 * **Cerrado en B-1132**, con el segundo `describe` de este archivo. El párrafo
 * de arriba queda como estaba para que se lea contra lo que lo cerró.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { archivosDelRepo } from './fixtures/archivos-del-repo';

const raiz = new URL('..', import.meta.url);
// Una ruta absoluta es la copia sintética de `os.tmpdir()` (B-1962); el resto
// es relativo a la raíz del repo, como lo devuelve `archivosDelRepo`.
const ruta = (relativo: string) =>
  isAbsolute(relativo) ? relativo : fileURLToPath(new URL(relativo, raiz));

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

/*
 * Una copia sintética: el control de mutación de los dos bloques de abajo.
 *
 * **Vive en `os.tmpdir()` y no en `tests/fixtures/`** — B-1962. Adentro del
 * árbol la veía `archivosDelRepo` (B-964) sin más, pero con los archivos en
 * paralelo (PRD 6, M-1) los barridos de otros archivos la encontraban a medio
 * borrar y morían con `ENOENT`. Que el helper ve un archivo sin rastrear ya lo
 * prueba `tests/archivos-del-repo.test.ts`; acá se suma a los candidatos cuando
 * existe, que es lo mismo que el helper hacía con ella.
 */
const DIR_TMP = mkdtempSync(join(tmpdir(), 'mutacion-b1130-'));
const COPIA_TMP = join(DIR_TMP, 'copia.ts');
afterAll(() => rmSync(DIR_TMP, { recursive: true, force: true }));

const candidatos = (): string[] => [
  ...archivosDelRepo('tests').filter((f) => f.endsWith('.ts') || f.endsWith('.tsx')),
  ...(existsSync(COPIA_TMP) ? [COPIA_TMP] : []),
];

const infractores = (): string[] =>
  candidatos().filter((f) => {
    if (f in EXCEPCIONES) return false;
    const fuente = readFileSync(ruta(f), 'utf8');
    return COPIA.some((patron) => patron.test(fuente));
  });

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

/**
 * **El `rejects.toThrow()` pelado sobre una operación de Firestore** — B-1132.
 *
 * Es el punto ciego que el docblock de arriba dejaba escrito, y el más débil
 * de todos: `rejects.toThrow()` sin argumento afirma «algo tiró». Eso es menos
 * incluso que la regex `RECHAZADA` que B-1130 eliminó — **no exige
 * `permission-denied`**, así que un `db()` roto o un `projectId` mal apuntado
 * lo pintan verde sin haber probado ninguna regla. Es el riesgo que describe
 * `05-patrones.md` § «Un rechazo esperado no es cualquier rechazo».
 *
 * ── La firma: **qué se está esperando**, no en qué `describe` está parada ──
 *
 * El ítem proponía un barrido que entendiera en qué `describe` vive cada
 * llamada, para no marcar los dos usos legítimos. **Medido, no hace falta, y el
 * discriminador correcto es más angosto:** lo que separa un caso de reglas de
 * los otros dos es **qué operación se espera**, y eso está en la misma
 * expresión.
 *
 *  - `storage-reglas.integracion.test.ts` **no importa nada de
 *    `firebase/firestore`** —es otro emulador, con sus propios códigos—, así
 *    que sus seis `toThrow()` pelados quedan afuera solos.
 *  - `opciones.integracion.test.ts` sí importa `doc`, `getDoc` y `setDoc`, pero
 *    lo que espera es `upsertOpcion(…)`: código del panel validando antes de
 *    escribir, no una regla.
 *
 * Resultado: **cero excepciones escritas a mano**, que es la diferencia con el
 * diseño que el ítem imaginaba. Una lista de excepciones es lo que B-1113 dice
 * que no hay que construir.
 *
 * ── Y la lista de operaciones sale de los imports, no de acá ──────────────
 *
 * Qué cuenta como «operación de Firestore» se lee del `import … from
 * 'firebase/firestore'` de cada archivo. Escribir la lista acá sería la copia
 * de D-88 otra vez, y además envejecería: el día que un caso use una operación
 * nueva, el barrido se entera solo.
 *
 * ── Los límites, dichos ───────────────────────────────────────────────────
 *
 * 1. **El conteo de paréntesis es literal**, así que un `)` adentro de una
 *    cadena en el argumento de `expect(` descuadra el corte y esa aparición se
 *    saltea. Por eso el control positivo de abajo exige que el barrido siga
 *    viendo los pelados que hoy existen: si el parseo se rompe, se pone rojo en
 *    vez de quedar mirando al vacío (D-750).
 * 2. **Marca de más antes que de menos.** Un `expect(algoMio(doc(db, 'x')))`
 *    con `toThrow()` pelado se marca, porque `doc` viene del import aunque no
 *    sea la operación esperada. Es la dirección que se quiere: se ve en el
 *    primer rojo y se arregla poniéndole el helper, que es lo correcto igual.
 */
describe('un rechazo de Firestore no se afirma con `toThrow()` pelado — B-1132', () => {
  afterEach(() => {
    const absoluto = ruta(COPIA_TMP);
    if (existsSync(absoluto)) rmSync(absoluto);
  });

  /** Los identificadores que un archivo trae de `firebase/firestore`. */
  const opsDeFirestore = (fuente: string): string[] =>
    [...fuente.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'firebase\/firestore'/gu)]
      .flatMap((m) => m[1]!.split(','))
      .map((s) => s.trim().split(/\s+as\s+/u).pop()!.trim())
      .filter(Boolean);

  /**
   * El argumento de cada `expect(…)` **seguido de `.rejects.toThrow()` sin
   * nada adentro**. Se corta contando paréntesis desde el `expect(`, que es lo
   * que permite que el argumento tenga llamadas anidadas.
   */
  const esperasPeladas = (fuente: string): string[] => {
    const salida: string[] = [];
    const re = /\bexpect\s*\(/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(fuente)) !== null) {
      const inicio = m.index + m[0].length;
      let nivel = 1;
      let i = inicio;
      for (; i < fuente.length && nivel > 0; i += 1) {
        if (fuente[i] === '(') nivel += 1;
        else if (fuente[i] === ')') nivel -= 1;
      }
      if (nivel !== 0) continue;
      if (/^\s*\.rejects\s*\.\s*toThrow\(\s*\)/u.test(fuente.slice(i))) {
        salida.push(fuente.slice(inicio, i - 1));
      }
    }
    return salida;
  };

  /** Los archivos donde un `toThrow()` pelado espera una operación de Firestore. */
  const pelados = (): string[] =>
    candidatos().filter((f) => {
      if (f in EXCEPCIONES) return false;
      const fuente = readFileSync(ruta(f), 'utf8');
      const ops = opsDeFirestore(fuente);
      if (ops.length === 0) return false;
      const llamaAUnaOp = new RegExp(String.raw`\b(?:${ops.join('|')})\s*\(`, 'u');
      return esperasPeladas(fuente).some((arg) => llamaAUnaOp.test(arg));
    });

  it('el barrido sigue viendo los `toThrow()` pelados que hoy existen', () => {
    /*
     * **Control positivo, y es el que sostiene todo lo de abajo** (D-750): el
     * corte por paréntesis es literal, así que si un día deja de cuadrar este
     * barrido devolvería `[]` por no haber encontrado nada — verde, y sin haber
     * mirado. Los dos archivos que se nombran son justamente los dos usos
     * legítimos, o sea los que tienen que existir y **no** ser infractores.
     */
    const conPelados = candidatos().filter(
      (f) => esperasPeladas(readFileSync(ruta(f), 'utf8')).length > 0,
    );
    expect(conPelados).toContain('tests/storage-reglas.integracion.test.ts');
    expect(conPelados).toContain('tests/opciones.integracion.test.ts');
  });

  it('ninguna operación de Firestore se afirma con un `toThrow()` pelado', () => {
    expect(
      pelados(),
      'un `rejects.toThrow()` sin argumento lo satisface un emulador caído: no ' +
        'exige `permission-denied`, así que no prueba ninguna regla. Usá ' +
        `\`denegada()\` de \`${HELPER}\` — o \`denegadaOReglaQueTira()\` si lo que ` +
        'el caso afirma es que la puerta está cerrada y da igual por dónde. ' +
        `Archivos: ${pelados().join(', ') || '(ninguno)'}`,
    ).toEqual([]);
  });

  it('los dos usos legítimos de hoy NO se marcan', () => {
    // Es la mitad que define la firma: Storage no importa Firestore, y lo que
    // `opciones` espera es código del panel. Si el barrido los marcara, la
    // salida sería una lista de excepciones — lo que B-1113 dice no construir.
    expect(pelados()).not.toContain('tests/storage-reglas.integracion.test.ts');
    expect(pelados()).not.toContain('tests/opciones.integracion.test.ts');
  });

  it('mutación — un `getDoc` con `toThrow()` pelado se marca', () => {
    writeFileSync(
      ruta(COPIA_TMP),
      `import { doc, getDoc } from 'firebase${'/'}firestore';\n` +
        'export const caso = async (db: never) =>\n' +
        "  await expect(getDoc(doc(db, 'actividades', 'x'))).rejects.toThrow();\n",
    );

    expect(pelados()).toContain(COPIA_TMP);
  });

  it('mutación al revés — con el helper, o con un argumento, no se marca', () => {
    writeFileSync(
      ruta(COPIA_TMP),
      `import { doc, getDoc } from 'firebase${'/'}firestore';\n` +
        'export const caso = async (db: never) =>\n' +
        "  await denegada(getDoc(doc(db, 'actividades', 'x')), 'leer sin login');\n",
    );
    expect(pelados()).not.toContain(COPIA_TMP);

    writeFileSync(
      ruta(COPIA_TMP),
      `import { doc, getDoc } from 'firebase${'/'}firestore';\n` +
        'export const caso = async (db: never) =>\n' +
        "  await expect(getDoc(doc(db, 'actividades', 'x'))).rejects.toThrow(/denegada/);\n",
    );
    expect(pelados()).not.toContain(COPIA_TMP);
  });

  it('mutación al revés — un `toThrow()` pelado sobre código propio no se marca', () => {
    // El caso de `opciones.integracion.test.ts`, sintético: el archivo importa
    // Firestore para armar el escenario, pero lo que espera es una función del
    // panel. Marcarlo obligaría a escribir una excepción, que es lo que no se
    // quiere.
    writeFileSync(
      ruta(COPIA_TMP),
      `import { doc, getDoc } from 'firebase${'/'}firestore';\n` +
        'export const caso = async () =>\n' +
        "  await expect(upsertOpcion('barrio', '!!', 'uid')).rejects.toThrow();\n",
    );

    expect(pelados()).not.toContain(COPIA_TMP);
  });
});
