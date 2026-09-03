/**
 * El disparo automático del `auditor-privacidad` — B-124, D-350.
 *
 * La decisión de B-124 es que el auditor caro corra **solo** cuando el diff
 * toca una salida pública. Eso quiere dos garantías, y las dos se verifican
 * acá porque las dos se rompen en silencio:
 *
 * 1. **Que se dispare** con cada archivo que la ficha del agente declara.
 * 2. **Que NO se dispare** con lo que no. Un disparador que se prende siempre
 *    es el costo de la opción "en cada cierre" con la etiqueta de la
 *    intermedia — o sea, la decisión deshecha sin que nada falle.
 *
 * ── La clase, no la instancia ─────────────────────────────────────
 * La lista de archivos que disparan al auditor **no está escrita en el
 * script**: se deriva del `description` de `.claude/agents/auditor-privacidad.md`,
 * que es el mismo lugar que decide si Claude lo invoca por nombre de archivo.
 * Este archivo ata las dos puntas — si la ficha suma una salida y el
 * disparador no la ve, o al revés, se pone rojo. Es lo que B-216 hizo para la
 * cuenta de salidas públicas, un lugar más adentro.
 *
 * ── Y el ancla, que es lo que hace que esto no sea una tautología ─
 * Derivar las dos puntas del **mismo** `description` se satisface solo: sacarle
 * una salida a la ficha la saca de las dos listas y todo queda en verde. Lo
 * mismo pasaría si el regex del extractor dejara de reconocer una ruta — la
 * lista se acorta sin fallar, que es exactamente el bug de B-109 una capa más
 * adentro.
 *
 * Así que hay un ancla **independiente**: la tabla numerada de salidas de
 * `docs/07-seguridad.md`, parseada aparte, y todo productor que esa tabla
 * nombra tiene que ser un disparador. Cerrando el otro eslabón,
 * `tests/agentes-y-skills.test.ts` (B-216) ya exige que el `description`
 * nombre a todos esos productores. La cadena queda: tabla → ficha → disparo.
 *
 * MUTACIÓN PROBADA: sacar `src/lib/textoRedes.ts` del `description` deja en
 * rojo el caso del ancla acá y el de B-216 en `agentes-y-skills.test.ts`.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AUDITORES,
  SIEMPRE,
  auditoresQueCorresponden,
  frontmatter,
  leerFichas,
  rutasQueNombra,
} from '../scripts/auditores-que-corresponden.mjs';

const raiz = new URL('..', import.meta.url);
const fichas = leerFichas(raiz) as Record<string, string>;

/** Los archivos que la ficha de un auditor declara mirar. */
const declarados = (auditor: string): string[] =>
  rutasQueNombra(frontmatter(fichas[auditor]).description ?? '').archivos;

const decidir = (rutas: string[]) => auditoresQueCorresponden(rutas, fichas);

/**
 * Los archivos productores que nombra la tabla numerada de salidas públicas de
 * `docs/07-seguridad.md`. Es el **ancla independiente** de este archivo: otro
 * documento, otro parseo, y la lista que el proyecto mantiene cuando aparece
 * una salida nueva.
 *
 * Se parsea distinto de `rutasQueNombra` a propósito: se leen las rutas entre
 * backticks de las filas que empiezan con un número. Si el extractor del
 * script deja de reconocer una ruta, acá sigue apareciendo y el caso del ancla
 * se pone rojo.
 *
 * **Se toma el primer productor de cada fila**, que es el mismo criterio que
 * usa `tests/agentes-y-skills.test.ts` (B-216) para exigir que el
 * `description` los nombre. Deliberadamente no se toman *todos* los archivos
 * que la fila menciona: varias filas nombran de paso a quien **acomoda** la
 * salida y no a quien la produce (`src/pages/index.astro` «embebe» el JSON-LD,
 * los componentes de `src/components/publico/` «solo acomodan»), así que
 * exigirlos acá pondría este archivo en rojo por prosa ajena al cambio de
 * quien lo corre — el modo de falla de B-180. Los productores de segunda
 * vuelta que sí faltan en la ficha son un hallazgo para el backlog, no una
 * regresión de este mecanismo.
 */
const productoresDeLaTablaDeSeguridad = (): string[] => {
  const doc = readFileSync(fileURLToPath(new URL('docs/07-seguridad.md', raiz)), 'utf8');
  const rutas = new Set<string>();
  let empezo = false;
  for (const linea of doc.split('\n')) {
    if (!/^\s*\|\s*\d+\s*\|/.test(linea)) {
      if (empezo) break;
      continue;
    }
    empezo = true;
    const primero = [...linea.matchAll(/`((?:src|functions)\/[^`]+\.[a-z]+)`/g)][0]?.[1];
    if (primero) rutas.add(primero);
  }
  return [...rutas].sort();
};

describe('el disparador se deriva de la ficha del agente — B-124', () => {
  it('la ficha del `auditor-privacidad` declara salidas de verdad', () => {
    /*
     * Control positivo. Si el extractor dejara de reconocer paths, todo lo de
     * abajo pasaría comparando listas vacías: el auditor no se dispararía
     * nunca y ningún caso fallaría.
     */
    expect(declarados('privacidad').length).toBeGreaterThan(20);
  });

  it('todo archivo que la ficha declara existe en el repo', () => {
    // Un disparador que apunta a un archivo borrado o renombrado no dispara
    // nunca, y nada lo dice. Es la mitad de B-260 aplicada al disparo.
    const inexistentes = declarados('privacidad').filter(
      (a) => !existsSync(fileURLToPath(new URL(a, raiz))),
    );
    expect(
      inexistentes,
      'la ficha del auditor nombra archivos que no existen: esos disparadores están muertos',
    ).toEqual([]);
  });

  it('el ancla: todo productor de la tabla de `07-seguridad.md` dispara al auditor', () => {
    /*
     * El caso que impide que este archivo se satisfaga solo. La lista sale de
     * otro documento y con otro parseo, así que ni sacarle una salida a la
     * ficha ni un regex que deja de reconocer una ruta pasan en verde.
     */
    const productores = productoresDeLaTablaDeSeguridad();
    // Control positivo: si el parseo de la tabla se rompiera, esto compararía
    // una lista vacía y todo pasaría sin mirar nada.
    expect(productores.length).toBeGreaterThan(10);

    const mudos = productores.filter((p) => !decidir([p]).privacidad.corresponde);
    expect(
      mudos,
      'la tabla de salidas públicas nombra estos productores y el disparo automático no ' +
        'los ve: un cambio a esa salida cierra sin que el `auditor-privacidad` la mire',
    ).toEqual([]);
  });

  it('cada archivo declarado dispara al auditor, uno por uno', () => {
    const mudos = declarados('privacidad').filter((a) => !decidir([a]).privacidad.corresponde);
    expect(
      mudos,
      'la ficha declara estas salidas y el disparador no las ve: el agente no se ' +
        'despierta y el cambio se cierra sin que nadie mire la salida',
    ).toEqual([]);
  });

  it('y el conjunto de disparadores es exactamente el que la ficha declara', () => {
    /*
     * La otra dirección. Un disparador de más no rompe nada visible: prende el
     * modelo caro sobre un diff que no toca ninguna salida, o sea que paga la
     * opción "en cada cierre" con el nombre de la intermedia.
     */
    const todos = [...declarados('privacidad'), 'docs/README.md', 'tests/toPublic.test.ts'];
    const disparan = decidir(todos).privacidad.disparadores;
    expect(disparan).toEqual([...declarados('privacidad')].sort());
  });
});

describe('cuándo NO se dispara — la mitad que sostiene la decisión', () => {
  it('un diff de solo documentación no despierta a privacidad ni a trampas', () => {
    const d = decidir(['docs/BACKLOG.md', 'docs/13-agentes.md', 'README.md']);
    expect(d.privacidad.corresponde).toBe(false);
    expect(d.trampas.corresponde).toBe(false);
  });

  it('un diff de solo tests tampoco', () => {
    const d = decidir(['tests/toPublic.test.ts', 'tests/red-de-contencion.test.ts']);
    expect(d.privacidad.corresponde).toBe(false);
  });

  it('un archivo del panel dispara trampas y NO privacidad', () => {
    // `src/components/admin/` está en la ficha del `auditor-trampas` como
    // prefijo y no está en la de privacidad: el panel no es una salida pública.
    const d = decidir(['src/components/admin/FormularioActividad.tsx']);
    expect(d.trampas.corresponde).toBe(true);
    expect(d.privacidad.corresponde).toBe(false);
  });

  it('un archivo de `src/lib/` que la ficha no nombra no dispara privacidad', () => {
    /*
     * El caso que un prefijo suelto arruinaría. `src/lib/` entero está en la
     * ficha de trampas, pero privacidad nombra archivos concretos: un módulo
     * nuevo de `src/lib/` que no es una salida no tiene que prender el modelo
     * caro. Que **sí** debería estar en la ficha si es una salida es criterio,
     * y es trabajo del propio auditor (su punto 7) — no de este chequeo.
     */
    const d = decidir(['src/lib/estoNoExisteYNoEsUnaSalida.ts']);
    expect(d.privacidad.corresponde).toBe(false);
    expect(d.trampas.corresponde).toBe(true);
  });

  it('un diff vacío no dispara nada más que el que corre siempre', () => {
    const d = decidir([]);
    expect(d.privacidad.corresponde).toBe(false);
    expect(d.trampas.corresponde).toBe(false);
    expect(d.documentacion.corresponde).toBe(true);
  });
});

describe('las reglas y el que corre siempre', () => {
  it('`firestore.rules` dispara privacidad y trampas', () => {
    const d = decidir(['firestore.rules']);
    expect(d.privacidad.corresponde).toBe(true);
    expect(d.trampas.corresponde).toBe(true);
  });

  it('`auditor-documentacion` corresponde siempre, y eso está declarado y no derivado', () => {
    /*
     * Su `description` no nombra ningún archivo a propósito: su disparador es
     * el cambio, no el archivo. El script lo declara en `SIEMPRE` con el
     * motivo escrito; esto fija que no se cuele nadie más ahí, porque un
     * auditor en esa lista deja de mirar el diff.
     */
    expect(SIEMPRE).toEqual(['documentacion']);
    expect(declarados('documentacion')).toEqual([]);
  });

  it('los auditores del script son exactamente los que existen en `.claude/agents/`', () => {
    /*
     * Las dos direcciones. Un auditor nuevo que no entre al script queda fuera
     * del mecanismo **en silencio** —nunca se dispara solo, y nadie lo nota—;
     * y una entrada del script que apunta a una ficha borrada es un disparador
     * muerto. Es el patrón de `agentes-y-skills.test.ts` aplicado al disparo.
     */
    const enDisco = readdirSync(fileURLToPath(new URL('.claude/agents', raiz)))
      .filter((f) => f.endsWith('.md'))
      .map((f) => `.claude/agents/${f}`)
      .sort();
    expect(enDisco.length).toBeGreaterThanOrEqual(3);
    expect(Object.values(AUDITORES).sort()).toEqual(enDisco);
  });
});

describe('la derivación sale de la ficha y no de una lista escondida', () => {
  it('una ficha inventada cambia el disparador', () => {
    /*
     * El control que prueba que la lista **no** está hardcodeada en el script.
     * Sin este caso, un refactor podría reemplazar la derivación por una copia
     * y todos los casos de arriba seguirían en verde (porque la copia arrancaría
     * igual a la ficha de hoy).
     */
    const inventada = [
      '---',
      'name: auditor-privacidad',
      'description: Audita src/lib/soloEnLaFicha.ts y nada más.',
      'tools: Read',
      '---',
      '',
      'cuerpo',
    ].join('\n');
    const d = auditoresQueCorresponden(
      ['src/lib/soloEnLaFicha.ts', 'src/lib/toPublic.ts'],
      { ...fichas, privacidad: inventada },
    );
    expect(d.privacidad.disparadores).toEqual(['src/lib/soloEnLaFicha.ts']);
  });

  it('una ficha sin frontmatter no dispara nada, y no explota', () => {
    // Un agente con el YAML roto no carga y nadie se entera (B-139). Que su
    // disparador quede en cero es lo correcto: no hay agente que invocar.
    const d = auditoresQueCorresponden(['src/lib/toPublic.ts'], { ...fichas, privacidad: 'sin frontmatter' });
    expect(d.privacidad.corresponde).toBe(false);
  });
});
