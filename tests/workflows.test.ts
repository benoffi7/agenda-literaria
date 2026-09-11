import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { describe, expect, it } from 'vitest';
import { fuenteDelModulo } from './fixtures/functions';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';

/**
 * Los workflows de Actions, como archivos YAML — **trampa 11** del `CLAUDE.md`
 * §13, y B-188.
 *
 * **Por qué existe este test** (B-188). `deploy.yml` tenía esta línea:
 *
 * ```yaml
 * run: echo "Motivo: ${{ github.event.client_payload.motivo || '…' }}"
 * ```
 *
 * Un `: ` adentro de un escalar sin comillas hace que YAML lea un mapa anidado,
 * así que **el archivo entero quedaba inválido**. Y la forma en que eso falla es
 * lo que lo hace peligroso: GitHub no puede leer el `on:`, así que el workflow
 * queda registrado **sin ningún trigger** — el `repository_dispatch` que le manda
 * `dispararRebuild` no dispara nada, la Function no se entera (para ella el POST
 * salió 204), y lo único visible es una corrida fallida sin jobs en cada push.
 * Estuvo así desde el primer día y nadie lo vio.
 *
 * No hay forma de que el resto de la suite lo detecte: el YAML roto no rompe
 * ningún import, ningún tipo y ningún test. El único lugar donde se nota es
 * GitHub, o sea después de pushear.
 *
 * Por eso el chequeo es **por clase y no por línea**: no verifica que esa línea
 * esté con `run: |`, verifica que todos los workflows parseen y que cada uno
 * tenga los triggers de los que depende. Una línea nueva con el mismo problema,
 * en cualquier workflow, cae acá.
 *
 * **El que atrapa esta clase es «parsea sin errores», y no «tiene name y al menos
 * un trigger».** Se comprobó reintroduciendo el bug: el parser de `yaml` se
 * recupera del error y devuelve un objeto usable, así que `name` y `on` seguían
 * ahí; GitHub, en cambio, abandona el archivo. O sea que **acá hay que mirar
 * `doc.errors` y no el resultado**, porque un parser tolerante da la respuesta
 * equivocada sobre un archivo que en GitHub no funciona.
 */
const DIR = '.github/workflows';

const archivos = readdirSync(DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

/** El YAML de un workflow, parseado como lo haría GitHub: estricto y sin claves repetidas. */
const parsear = (archivo: string) =>
  parseDocument(readFileSync(join(DIR, archivo), 'utf8'), { uniqueKeys: true, strict: true });

describe('los workflows son YAML válido', () => {
  it('hay workflows que verificar', () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it.each(archivos)('%s parsea sin errores', (archivo) => {
    const doc = parsear(archivo);
    // El mensaje del parser dice línea y columna: se muestra tal cual, que es
    // lo único que hace accionable el fallo.
    expect(doc.errors.map((e) => e.message)).toEqual([]);
  });

  it.each(archivos)('%s tiene name y al menos un trigger', (archivo) => {
    const wf = parsear(archivo).toJS() as { name?: string; on?: Record<string, unknown> };
    // Sin `name`, GitHub muestra el path — que es exactamente el síntoma de que
    // no pudo parsear el archivo.
    expect(wf.name, 'falta `name:`').toBeTruthy();
    // Un workflow sin triggers no corre nunca y no avisa: es el modo de falla de
    // B-188.
    expect(Object.keys(wf.on ?? {}), 'no tiene ningún trigger').not.toHaveLength(0);
  });
});

describe('los triggers de los que depende el §8', () => {
  it('deploy.yml escucha el mismo event_type que manda la Function', () => {
    const wf = parsear('deploy.yml').toJS() as {
      on: { repository_dispatch?: { types?: string[] } };
    };
    // El otro lado de este acuerdo está en `functions/github.js`
    // (`cuerpoDeDispatch`, desde B-77 — antes en `index.js`): `event_type:
    // 'rebuild'`. Si alguno de los dos cambia y el otro no, el lazo del §8 se
    // corta sin ningún error.
    const enviado = fuenteDelModulo('github.js').match(/event_type:\s*'([^']+)'/)?.[1];
    expect(enviado, 'no se encontró el event_type en functions/github.js').toBeTruthy();
    expect(wf.on.repository_dispatch?.types).toContain(enviado);
  });

  it('push-main.yml se dispara con un push a main', () => {
    const wf = parsear('push-main.yml').toJS() as {
      on: { push?: { branches?: string[] } };
    };
    expect(wf.on.push?.branches).toContain('main');
  });
});

/** Todos los `steps[].run` de todos los jobs de un workflow, con su nombre. */
const pasosConScript = (archivo: string): { nombre: string; run: string }[] => {
  const wf = parsear(archivo).toJS() as {
    jobs?: Record<string, { steps?: { name?: string; run?: string; uses?: string }[] }>;
  };
  return Object.entries(wf.jobs ?? {}).flatMap(([job, def]) =>
    (def.steps ?? [])
      .filter((s) => typeof s.run === 'string')
      .map((s) => ({ nombre: `${archivo} · ${job} · ${s.name ?? s.uses ?? 'sin nombre'}`, run: s.run! })),
  );
};

describe('los tags: uno por push, y la cadena no se arma a mano (B-88)', () => {
  const yml = readFileSync(join(DIR, 'push-main.yml'), 'utf8');
  /** El job de los tags, aislado: lo que sigue son afirmaciones sobre sus pasos. */
  const etiquetar = yml.slice(yml.indexOf('  etiquetar:'));

  it('hay un tag del deploy en cada push, y no solo cuando cambia `package.json`', () => {
    /*
     * Pedido del dueño el 2026-09-07: «cada push que hacemos tiene que generar un
     * tag y version». Antes acá se creaba un tag **solo** cuando `version` del
     * `package.json` cambiaba.
     *
     * Lo que se verifica es que existan **los dos**: el del deploy (uno por push,
     * con el SHA adentro) y el de la versión (cuando la mueve una persona). Un
     * chequeo de «hay un `git tag`» pasaría con el comportamiento viejo.
     */
    expect(etiquetar).toContain('git tag "$DEPLOY"');
    expect(etiquetar).toContain('git push origin "$DEPLOY"');
    expect(etiquetar).toMatch(/git tag -a "\$BASE"/);
    expect(etiquetar).toContain('git push origin "$BASE"');
  });

  it('la cadena del tag la compone `scripts/version.mjs` y no el YAML', () => {
    /*
     * **La clase de B-88, y acá el modo de falla es mudo.** El tag del deploy tiene
     * que ser *exactamente* la cadena que el panel muestra y que un reporte de bug
     * copia (`1.9.0+a1b2c3d`): si el YAML la armara a mano —un `echo
     * "v$VERSION+$(git rev-parse --short HEAD)"`— el día que `componerVersion`
     * cambie de formato el tag y el panel dirían cosas distintas, y `git show` de
     * lo que reporta una persona no encontraría nada.
     *
     * `version.mjs` es «el único lugar donde se arma una cadena de versión» (D-98),
     * y esto lo hace cumplir del lado del workflow.
     *
     * MUTACIÓN PROBADA: reemplazar la línea del `node -e` por un armado con
     * `git rev-parse --short HEAD` deja este caso en rojo.
     */
    expect(etiquetar, 'el tag del deploy no sale de version.mjs').toContain(
      'scripts/version.mjs',
    );
    expect(etiquetar).toContain('infoVersion().version');
    // Y no se arma con git a mano en ese job.
    expect(etiquetar, 'la versión del tag se compone en el YAML').not.toMatch(
      /VERSION=.*rev-parse/,
    );
  });

  it('un árbol sucio no llega a ser un tag', () => {
    // La misma guarda que el job del build: una versión sellada como «-sucio» o
    // «sin-git» no identifica ningún commit, así que como tag es basura.
    expect(etiquetar).toMatch(/\*-sucio\*\|\*sin-git\*/);
  });

  it('y un re-run del mismo commit no falla por el tag que ya existe', () => {
    // `git push` de un tag existente sale con error, y el job entero quedaría
    // rojo por algo que ya está bien.
    expect(etiquetar).toMatch(/rev-parse -q --verify "refs\/tags\/\$DEPLOY"/);
  });
});

describe('los scripts de los workflows no interpolan datos ajenos — §5.4', () => {
  /**
   * **Por qué es un chequeo de seguridad y no de estilo** (B-195). `${{ … }}`
   * dentro de un `run:` se pega en el texto del script **antes** de que exista la
   * shell, así que un valor con comillas o `$(…)` ejecuta lo que quiera. Cuando el
   * valor sale de Firestore —el `motivo` del rebuild— es texto que no controlamos,
   * y el job que lo imprime es el mismo que más abajo recibe
   * `FIREBASE_SERVICE_ACCOUNT`: la única key del proyecto.
   *
   * Por `env:` el valor llega como variable de entorno y la shell no lo
   * reinterpreta. La regla es esa, y vale para cualquier contexto que traiga datos
   * de afuera: `github.event.*`, `inputs.*` y `client_payload`.
   */
  const CONTEXTOS_AJENOS = /\$\{\{[^}]*\b(github\.event|inputs|client_payload)\b/;

  it.each(archivos)('%s no interpola contexto de evento en el cuerpo de un run', (archivo) => {
    const culpables = pasosConScript(archivo)
      .filter((p) => CONTEXTOS_AJENOS.test(p.run))
      .map((p) => p.nombre);
    expect(culpables, 'pasalo por `env:` en vez de interpolarlo en el script').toEqual([]);
  });
});

describe('el gate de la trampa 4 no está copiado en YAML — §5.4', () => {
  /**
   * `scripts/verificar-bundle.sh` existe porque **dos** workflows lo necesitan, y
   * su cabecera dice por qué no se duplica: "duplicar en YAML era garantizar que
   * una de las dos copias se quedara vieja". Pasó exactamente eso — la copia de
   * `deploy.yml` se quedó sin la guarda final, la que exige que `dist/` tenga al
   * menos un `.js`, así que un build vacío pasaba el gate habiendo verificado
   * nada (B-195, y es el build que B-189 describe).
   *
   * El chequeo es por clase: cualquier workflow que buildee tiene que llamar al
   * script, no reimplementar el `grep`.
   */
  const PATRON_COPIADO = /grep[^\n]*(firebase-admin|private_key|BEGIN PRIVATE KEY)/;

  it.each(archivos)('%s no reimplementa el grep del bundle', (archivo) => {
    const culpables = pasosConScript(archivo)
      .filter((p) => PATRON_COPIADO.test(p.run))
      .map((p) => p.nombre);
    expect(culpables, 'llamá a ./scripts/verificar-bundle.sh').toEqual([]);
  });

  it.each(archivos)('%s corre el script si buildea', (archivo) => {
    const pasos = pasosConScript(archivo);
    const buildea = pasos.some((p) => /npm run build|astro build/.test(p.run));
    if (!buildea) return;
    const verifica = pasos.some((p) => /verificar-bundle\.sh/.test(p.run));
    expect(verifica, 'buildea pero no verifica que la credencial no se filtró').toBe(true);
  });
});

/**
 * **Ningún test puede depender de un `dist/` construido — B-873.**
 *
 * `tests/sin-comentarios-en-el-html.test.ts` (B-261) y
 * `tests/terceros-antes-del-consentimiento.test.ts` (D-254) leían el `dist/` del
 * repo y se salteaban si no estaba, **y los dos afirmaban en su docblock que en
 * CI el build siempre corre, así que ahí no se saltea nunca**. Era falso en los
 * dos workflows, y estuvo escrito durante meses: el docblock que prometía la
 * cobertura es justamente lo que hizo que nadie fuera a comprobarla.
 *
 * Los dos barridos se mudaron a `scripts/verificar-bundle.sh`, que es el paso
 * post-build. Lo que queda es impedir que la forma vuelva, y por eso el chequeo
 * está acá y no en aquellos archivos: **el hecho que lo habilita es del
 * pipeline**, no de un test. Son dos casos y se leen juntos —el primero mide el
 * hecho, el segundo prohíbe la consecuencia—; y el tercer eslabón, que el gate
 * se corra de verdad, ya lo sostiene el caso «%s corre el script si buildea» de
 * arriba.
 */
describe('ningún test depende de un `dist/` — B-873', () => {
  const PASO_TEST = /\bnpm test\b|\bnpx vitest\b/;
  const PASO_BUILD = /npm run build|astro build/;

  it('en ningún job de ningún workflow el build corre antes que los tests', () => {
    /*
     * **El hecho, medido y no leído.** Es exactamente la afirmación que los dos
     * docblocks tenían al revés, así que se computa del YAML en vez de escribirse
     * en prosa: si mañana alguien reordena los pasos, esto cambia solo.
     *
     * Y si el cambio es deliberado —alguien decide buildear en el job de tests—
     * este caso se pone en rojo a propósito: es el momento de releer B-873 y
     * decidir si los barridos vuelven a ser tests o no. Lo que no puede pasar es
     * que la premisa cambie sin que nadie lo note, que es lo que ya pasó.
     */
    const conBuildAntes: string[] = [];
    for (const archivo of archivos) {
      const wf = parsear(archivo).toJS() as {
        jobs?: Record<string, { steps?: { name?: string; run?: string }[] }>;
      };
      for (const [job, def] of Object.entries(wf.jobs ?? {})) {
        const pasos = (def.steps ?? []).map((s) => s.run ?? '');
        const test = pasos.findIndex((r) => PASO_TEST.test(r));
        const build = pasos.findIndex((r) => PASO_BUILD.test(r));
        if (test >= 0 && build >= 0 && build < test) {
          conBuildAntes.push(`${archivo} · ${job}`);
        }
      }
    }
    expect(
      conBuildAntes,
      'un job buildea antes de correr los tests: la premisa de B-873 cambió, releelo',
    ).toEqual([]);

    // Y el control positivo: que el detector encuentre los pasos de verdad. Sin
    // esto, un cambio de nombre del script dejaría el barrido en cero y el caso
    // pasaría sin mirar nada — la misma forma de mentir que trajo B-873 acá.
    const jobs = archivos.flatMap((archivo) => {
      const wf = parsear(archivo).toJS() as {
        jobs?: Record<string, { steps?: { name?: string; run?: string }[] }>;
      };
      return Object.entries(wf.jobs ?? {}).map(([job, def]) => ({
        nombre: `${archivo} · ${job}`,
        pasos: (def.steps ?? []).map((s) => s.run ?? ''),
      }));
    });
    expect(
      jobs.filter((j) => j.pasos.some((r) => PASO_TEST.test(r))).map((j) => j.nombre).sort(),
      'no se encontró ningún job que corra los tests',
    ).toEqual(['deploy.yml · deploy', 'push-main.yml · verificar']);
    expect(
      jobs.filter((j) => j.pasos.some((r) => PASO_BUILD.test(r))).map((j) => j.nombre).sort(),
      'no se encontró ningún job que buildee',
    ).toEqual(['deploy.yml · deploy', 'push-main.yml · hosting']);
  });

  it('y por eso ningún archivo de `tests/` lee `dist/`', () => {
    /*
     * La consecuencia del caso de arriba, hecha aserto: si `dist/` no existe en
     * ninguna corrida de la suite, un test que lo lea o miente o se saltea. El
     * lugar de esos chequeos es `scripts/verificar-bundle.sh`, después del build.
     *
     * Se mira el fuente **sin comentarios** (`sinComentarios`): los docblocks de
     * este repo hablan mucho de `dist/` y castigar la explicación empujaría a
     * borrarla. Y solo se cuentan las rutas entrecomilladas (`'dist'`,
     * `"dist/404.html"`), que es la forma en que este repo las escribe — un path
     * armado con un template literal se escaparía, y queda anotado como el límite
     * del chequeo.
     */
    const CON_DEUDA: Record<string, string> = {
      // Los dos que quedaron con la forma vieja. Están acá y no borrados para
      // que se cuenten: son la misma clase que B-873 y quedaron fuera de su
      // alcance, con su ítem propio en el BACKLOG.
      'tests/ahoraPublico.test.ts':
        'lee `dist/_astro` y se saltea sin build — misma clase que B-873, sin resolver',
      'tests/no-encontrado.test.ts':
        'lee `dist/404.html` con `it.skipIf(!hayBuild)` — ídem',
    };
    const RUTA_A_DIST = /(['"])dist(\/[^'"]*)?\1/;

    const culpables = readdirSync('tests')
      .filter((f) => /\.tsx?$/.test(f))
      .map((f) => `tests/${f}`)
      .filter((rel) => RUTA_A_DIST.test(sinComentarios(readFileSync(rel, 'utf8'))));

    expect(
      culpables.filter((c) => !(c in CON_DEUDA)).sort(),
      'un test lee `dist/`, que no existe cuando la suite corre: el chequeo va en ' +
        'scripts/verificar-bundle.sh, que es el paso de después del build (B-873)',
    ).toEqual([]);

    // Y en la otra dirección: una deuda que ya se pagó tiene que salir de la
    // lista. Si no, la lista crece sola y deja de decir nada.
    expect(
      Object.keys(CON_DEUDA).filter((c) => !culpables.includes(c)).sort(),
      'esta deuda ya no existe: sacala de CON_DEUDA',
    ).toEqual([]);
  });
});
