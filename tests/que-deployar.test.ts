import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { archivosDelRepo } from './fixtures/archivos-del-repo';

/**
 * La decisión de qué deployar en un push a main.
 *
 * Se testea porque el error importa y es silencioso: si la detección dice
 * "hosting no cambió" cuando sí, producción queda con el panel viejo y el
 * workflow queda verde. Nadie se entera hasta que algo no funciona.
 *
 * El caso que motiva el diseño es `functions/calendario.js`: está en
 * `functions/` pero el panel lo importa por el alias `@calendario`, así que
 * afecta al bundle. Una lista blanca de rutas se lo pierde.
 */
const SCRIPT = path.resolve('scripts/que-deployar.sh');

/**
 * **El árbol chico** — PRD 6, M-3.
 *
 * Este archivo llamaba al script ~50 veces contra el repo real, una por caso y
 * de a una: 16,5 s en serie y 37 s con la suite en paralelo, el archivo más
 * lento de todos. Medido, cada llamada cuesta ~0,35 s, y no por el `grep -r`
 * de `src/` sino por los procesos que lanza el script por cada archivo
 * compartido. Se ataca por los dos lados:
 *
 *  - **El árbol chico** baja cada llamada a ~0,2 s. La derivación solo mira
 *    los literales que apuntan a `functions/` desde `src/` y
 *    `astro.config.mjs`, y los `functions/*.js` que esos alcanzan, así que el
 *    chico copia exactamente eso: `astro.config.mjs`, los pocos archivos de
 *    `src/` que nombran `functions/`, y los `.js` de `functions/`.
 *  - **Los casos corren a la vez** (`describe.concurrent`, con el script
 *    lanzado sin bloquear): son procesos independientes que no comparten nada.
 *
 * Y después se atacó la causa (B-1970): el script ya no lanza un `grep` por
 * archivo compartido sino uno por vuelta de la clausura, y resolver un nombre
 * a su archivo no abre un subshell. De ~5 s a ~2,5 s este archivo solo.
 *
 * Que el recorte no cambió la respuesta lo dice el primer caso del bloque de
 * B-1241 de abajo: `compartidos()` sobre el chico **es igual** a
 * `compartidos()` sobre el real. Y un caso de decisión sigue corriendo contra
 * el árbol real, sin `QUE_DEPLOYAR_RAIZ`, para que el default del script
 * también esté probado (además del de «no depende del directorio»).
 */
const LITERAL_A_FUNCTIONS = /['"`](?:\.\/|(?:\.\.\/)+)functions\//;
const CHICO = (() => {
  const raiz = mkdtempSync(path.join(tmpdir(), 'que-deployar-chico-'));
  const copiar = (ruta: string) => {
    mkdirSync(path.dirname(path.join(raiz, ruta)), { recursive: true });
    writeFileSync(path.join(raiz, ruta), readFileSync(ruta));
  };
  copiar('astro.config.mjs');
  for (const f of archivosDelRepo('src')) {
    if (LITERAL_A_FUNCTIONS.test(readFileSync(f, 'utf8'))) copiar(f);
  }
  for (const f of archivosDelRepo('functions')) {
    if (/^functions\/[^/]+\.[cm]?js$/.test(f)) copiar(f);
  }
  return raiz;
})();
afterAll(() => rmSync(CHICO, { recursive: true, force: true }));

/** Corre el script sin bloquear, para que los casos concurrentes corran a la vez. */
const correr = (args: string[], entrada: string, raiz: string | null): Promise<string> =>
  new Promise((resolver, rechazar) => {
    const hijo = spawn(SCRIPT, args, {
      env: raiz ? { ...process.env, QUE_DEPLOYAR_RAIZ: raiz } : process.env,
    });
    let salida = '';
    let errores = '';
    hijo.stdout.on('data', (d: Buffer) => (salida += d));
    hijo.stderr.on('data', (d: Buffer) => (errores += d));
    hijo.on('error', rechazar);
    hijo.on('close', (codigo) =>
      codigo === 0
        ? resolver(salida)
        : rechazar(new Error(`que-deployar.sh salió con ${codigo}: ${errores}`)),
    );
    hijo.stdin.end(entrada);
  });

/**
 * `raiz` corre el script sobre otro árbol (`QUE_DEPLOYAR_RAIZ`, B-1241); por
 * defecto, el chico. `null` es el árbol real, sin la variable.
 */
const decidir = async (
  archivos: string[],
  raiz: string | null = CHICO,
): Promise<Record<string, boolean>> => {
  const salida = await correr([], archivos.join('\n'), raiz);
  return Object.fromEntries(
    salida
      .trim()
      .split('\n')
      .map((l) => {
        const [k, v] = l.split('=');
        return [k, v === 'true'];
      }),
  );
};

// Una sola suite concurrente alrededor de todas (M-3): los `describe` hermanos
// corren uno detrás del otro aunque cada uno sea concurrente, y el reloj se iba
// en esa fila.
describe.concurrent('que-deployar.sh', () => {
  describe.concurrent('qué deployar — lo obvio', () => {
    it('sin cambios, no deploya nada', async () => {
      expect(await decidir([])).toEqual({ hosting: false, functions: false, firestore: false, storage: false });
    });

    it('un cambio en el panel deploya solo hosting', async () => {
      expect(await decidir(['src/components/admin/AdminApp.tsx'])).toEqual({
        hosting: true, functions: false, firestore: false, storage: false,
      });
    });

    it('un cambio en las reglas deploya solo firestore', async () => {
      expect(await decidir(['firestore.rules'])).toEqual({
        hosting: false, functions: false, firestore: true, storage: false,
      });
    });

    it('los índices también son firestore', async () => {
      expect((await decidir(['firestore.indexes.json'])).firestore).toBe(true);
    });

    it('el trigger de una Function deploya solo functions', async () => {
      expect(await decidir(['functions/reportes-trigger.js'])).toEqual({
        hosting: false, functions: true, firestore: false, storage: false,
      });
    });
  });

  describe.concurrent('qué deployar — el caso que motiva el diseño', () => {
    it('calendario.js deploya functions Y hosting', async () => {
      // Está en functions/, pero el panel lo importa como @calendario para la
      // vista previa del evento. Si solo se deployaran las Functions, la vista
      // previa mostraría algo distinto de lo que el sync publica.
      const esperado = { hosting: true, functions: true, firestore: false, storage: false };
      expect(await decidir(['functions/calendario.js'])).toEqual(esperado);
      // El único caso de decisión contra el árbol real (M-3): el mismo veredicto
      // sin `QUE_DEPLOYAR_RAIZ`, así el default del script sigue probado.
      expect(await decidir(['functions/calendario.js'], null)).toEqual(esperado);
    });

    it('historial.js también deploya functions Y hosting', async () => {
      // Lo encontró el auditor-privacidad auditando B-323: el panel lo importa
      // como @historial (comparación de versiones), y hasta acá el script no lo
      // sabía — este `it` fallaba antes del arreglo.
      expect(await decidir(['functions/historial.js'])).toEqual({
        hosting: true, functions: true, firestore: false, storage: false,
      });
    });

    it('un cambio en la lista blanca de chunks PNG deploya functions Y hosting (B-323)', async () => {
      // El panel lo importa como @png-chunks-seguros (sanear una imagen antes de
      // subirla) y la Function lo importa directo (estructuraConocida). Un
      // cambio a los chunks seguros que solo redeployara Functions dejaría al
      // panel subiendo con la lista vieja, en silencio.
      expect(await decidir(['functions/png-chunks-seguros.js'])).toEqual({
        hosting: true, functions: true, firestore: false, storage: false,
      });
    });

    it('el resto de functions/ NO arrastra hosting', async () => {
      expect((await decidir(['functions/imagenes.js', 'functions/index.js'])).hosting).toBe(false);
    });

    it('firebase.json deploya functions y hosting', async () => {
      // Tiene las cabeceras de cache (hosting) y la config del codebase.
      const r = await decidir(['firebase.json']);
      expect(r.functions).toBe(true);
      expect(r.hosting).toBe(true);
      // B-167 — y también las reglas de Storage: `firebase.json` es donde está
      // declarado qué archivo son.
      expect(r.storage).toBe(true);
    });
  });

  describe.concurrent('qué deployar — las reglas de Storage (B-167)', () => {
    it('storage.rules deploya solo storage', async () => {
      // Es su propio target: `firebase deploy --only storage`. Si cayera en la
      // decisión de `firestore`, un cambio de reglas de Storage se deployaría
      // **nunca** — y el bucket quedaría con las reglas viejas sin que nada lo
      // diga, que es el default caro.
      expect(await decidir(['storage.rules'])).toEqual({
        hosting: false, functions: false, firestore: false, storage: true,
      });
    });

    it('storage.rules NO arrastra hosting', async () => {
      // Es config del servidor y nadie la importa, así que no puede entrar al
      // bundle. Es el mismo argumento que ya tenía `firestore.rules`, y lo que lo
      // sostiene es la línea de la lista NEGRA: sin ella caería en "archivo
      // desconocido" y pediría un deploy de hosting que no hace falta.
      expect((await decidir(['storage.rules'])).hosting).toBe(false);
    });

    it('las dos reglas juntas deployan las dos, y nada más', async () => {
      expect(await decidir(['firestore.rules', 'storage.rules'])).toEqual({
        hosting: false, functions: false, firestore: true, storage: true,
      });
    });

    it('el módulo que sube las imágenes es del panel, no de las reglas', async () => {
      // Control negativo: `src/lib/subir-imagen.ts` habla con Storage pero es
      // código del bundle. Si por su nombre terminara decidiendo `storage`, un
      // cambio del panel intentaría deployar reglas.
      expect(await decidir(['src/lib/subir-imagen.ts'])).toEqual({
        hosting: true, functions: false, firestore: false, storage: false,
      });
    });
  });

  describe.concurrent('qué deployar — falla hacia deployar', () => {
    it('un archivo desconocido en la raíz deploya hosting', async () => {
      // El error barato es un deploy de más. Quedarse corto deja producción con
      // código viejo sin que nada lo diga.
      expect((await decidir(['algo-nuevo-que-nadie-previo.ts'])).hosting).toBe(true);
    });

    it('una carpeta nueva deploya hosting', async () => {
      expect((await decidir(['lib-compartida/util.ts'])).hosting).toBe(true);
    });

    it('un cambio de dependencias deploya hosting', async () => {
      expect((await decidir(['package.json', 'package-lock.json'])).hosting).toBe(true);
    });

    it('la config del build deploya hosting', async () => {
      expect((await decidir(['astro.config.mjs'])).hosting).toBe(true);
      expect((await decidir(['tsconfig.json'])).hosting).toBe(true);
    });

    it('la config pública del SDK deploya hosting', async () => {
      expect((await decidir(['.env.production'])).hosting).toBe(true);
    });
  });

  describe.concurrent('qué deployar — lo que no toca nada', () => {
    it('solo documentación no deploya nada', async () => {
      expect(await decidir(['docs/BACKLOG.md', 'README.md', 'CLAUDE.md'])).toEqual({
        hosting: false, functions: false, firestore: false, storage: false,
      });
    });

    it('solo tests no deploya nada', async () => {
      expect(await decidir(['tests/schema.test.ts', 'tests/emulador.ts'])).toEqual({
        hosting: false, functions: false, firestore: false, storage: false,
      });
    });

    it('solo workflows no deploya nada', async () => {
      expect(await decidir(['.github/workflows/push-main.yml'])).toEqual({
        hosting: false, functions: false, firestore: false, storage: false,
      });
    });

    it('los scripts de mantenimiento no deployan nada', async () => {
      expect(await decidir(['scripts/preparar-produccion.mjs', 'scripts/seed-emulador.mjs'])).toEqual({
        hosting: false, functions: false, firestore: false, storage: false,
      });
    });

    /**
     * B-125, D-293 — es un script de mantenimiento más (no lo importa ni el
     * panel ni ninguna Function), así que entra a la misma lista negra. Sin
     * esto caía en "archivo desconocido" y cada cambio a este script disparaba
     * un deploy de hosting redundante (inofensivo, pero mentiroso — el mismo
     * motivo que documenta el comentario de `que-deployar.sh`).
     */
    it('scripts/verificar-calendario.mjs tampoco deploya nada (B-125, D-293)', async () => {
      expect(await decidir(['scripts/verificar-calendario.mjs'])).toEqual({
        hosting: false, functions: false, firestore: false, storage: false,
      });
    });

    it('pero scripts/version.mjs SÍ deploya hosting', async () => {
      // Calcula la versión que se estampa en el bundle.
      expect((await decidir(['scripts/version.mjs'])).hosting).toBe(true);
    });

    /**
     * B-215 — `.claude/` y `githooks/` son la máquina de quien programa, no el
     * sitio.
     *
     * Las definiciones que terminan en `.md` ya caían por `\.md$`. Lo que caía en
     * "archivo desconocido" y arrastraba un deploy de hosting era el
     * `settings.json` de `.claude/` —donde viven los hooks, así que se toca
     * seguido— y `githooks/pre-push`, que no tiene extensión.
     *
     * `docs/13-agentes.md` lo tenía anotado como pendiente «porque toca código».
     */
    it('la configuración de los agentes no deploya nada (B-215)', async () => {
      expect(await decidir(['.claude/settings.json'])).toEqual({
        hosting: false, functions: false, firestore: false, storage: false,
      });
      expect(
        await decidir(['.claude/agents/auditor-privacidad.md', '.claude/skills/cerrar-cambio/SKILL.md']),
      ).toEqual({ hosting: false, functions: false, firestore: false, storage: false });
    });

    it('el hook de git tampoco (B-215)', async () => {
      expect(await decidir(['githooks/pre-push'])).toEqual({
        hosting: false, functions: false, firestore: false, storage: false,
      });
    });
  });

  describe.concurrent('qué deployar — lo que se excluye tiene que ser demostrable (B-215)', () => {
    /**
     * La lista es NEGRA a propósito, y su modo de falla es el inverso al de una
     * blanca: no se queda corta, se pasa de larga. Excluir algo que sí afecta al
     * bundle deja producción con código viejo y el workflow en verde — que es el
     * error caro y silencioso que el comentario del script describe.
     *
     * `functions/` ya tiene su atadura derivada (el bloque de B-88 de más abajo,
     * que saca los alias de `astro.config.mjs`). Esta es la de los dos prefijos
     * que entraron con B-215: se excluyen porque **nada del build los alcanza**, y
     * eso se verifica en vez de afirmarse. El día que alguien aliasee o importe
     * algo de `.claude/` o de `githooks/`, la exclusión pasa a ser falsa y este
     * caso se pone rojo antes de que un cambio ahí deje de deployar.
     *
     * MUTACIÓN PROBADA: agregar `import x from '../../.claude/algo'` en cualquier
     * archivo de `src/` hace fallar este caso.
     */
    it('nada de `src/` ni del config del build alcanza `.claude/` ni `githooks/`', async () => {
      const archivos = archivosDelRepo('src', 'astro.config.mjs');

      // Control positivo: si el listado sale vacío, el `for` no compara nada.
      expect(archivos.length).toBeGreaterThan(50);

      const alcanzan = archivos.filter((f) => /['"`(][^'"`]*(?:\.claude|githooks)\//.test(
        readFileSync(f, 'utf8'),
      ));
      expect(
        alcanzan,
        'estos archivos del build referencian `.claude/` o `githooks/`, así que ' +
          'excluirlos de NO_AFECTAN en scripts/que-deployar.sh dejó de ser correcto',
      ).toEqual([]);
    });
  });

  describe.concurrent('qué deployar — combinaciones', () => {
    it('un cambio grande deploya todo', async () => {
      expect(
        await decidir(['src/lib/schema.ts', 'functions/index.js', 'firestore.rules', 'storage.rules']),
      ).toEqual({ hosting: true, functions: true, firestore: true, storage: true });
    });

    it('documentación junto con código deploya lo del código', async () => {
      expect(await decidir(['docs/CHANGELOG.md', 'src/lib/toPublic.ts'])).toEqual({
        hosting: true, functions: false, firestore: false, storage: false,
      });
    });
  });

  /**
   * Lo que el script cree que es compartido entre `functions/` y el build.
   * `raiz` lo corre sobre otro árbol (los casos sintéticos de más abajo).
   */
  const compartidosEn = async (raiz: string | null): Promise<string[]> =>
    (await correr(['--compartidos'], '', raiz)).split('\n').filter(Boolean);

  // Sobre el árbol real se pregunta una sola vez: la respuesta no cambia entre
  // casos (M-3). Sin argumento es el árbol real, como antes de M-3.
  let delReal: Promise<string[]> | undefined;
  const compartidos = (raiz?: string): Promise<string[]> =>
    raiz ? compartidosEn(raiz) : (delReal ??= compartidosEn(null));

  /**
   * El recorrido independiente de los imports del build hacia `functions/`.
   *
   * Es a propósito OTRA implementación que la del script: allá son literales
   * entre comillas buscados con `grep`; acá son especificadores de import
   * (`from`, `import(`, `import '…'`, `export … from`, `require(`, `new URL(`)
   * resueltos con `path` contra la carpeta del archivo que los escribe. Si las
   * dos coinciden es porque las dos ven lo mismo, no porque una copie a la otra.
   */
  const ESPECIFICADOR =
    /(?:\bfrom|\bimport\s*\(|\bimport|\brequire\s*\(|\bnew\s+URL\s*\()\s*['"`]([^'"`\n]+)['"`]/g;
  const CODIGO = /\.(?:[cm]?[jt]sx?|astro)$/;

  const especificadores = (texto: string): string[] =>
    [...texto.matchAll(ESPECIFICADOR)].map((m) => m[1]!);

  const conExtension = (ruta: string): string =>
    /\.[cm]?js$/.test(ruta) ? ruta : `${ruta}.js`;

  const importadosPorElBuild = (): string[] => {
    const alcanzados = new Set<string>();
    const pendientes: string[] = [];
    for (const archivo of archivosDelRepo('src', 'astro.config.mjs').filter((f) => CODIGO.test(f))) {
      for (const spec of especificadores(readFileSync(archivo, 'utf8'))) {
        if (!spec.startsWith('.')) continue;
        const ruta = path.posix.normalize(path.posix.join(path.posix.dirname(archivo), spec));
        if (ruta.startsWith('functions/')) pendientes.push(conExtension(ruta));
      }
    }
    // La clausura: lo que importan los compartidos, adentro de `functions/`.
    while (pendientes.length > 0) {
      const ruta = pendientes.pop()!;
      if (alcanzados.has(ruta)) continue;
      alcanzados.add(ruta);
      if (!existsSync(ruta)) continue;
      for (const spec of especificadores(readFileSync(ruta, 'utf8'))) {
        if (!spec.startsWith('./')) continue;
        pendientes.push(conExtension(path.posix.join('functions', spec)));
      }
    }
    return [...alcanzados].sort();
  };

  describe.concurrent('qué deployar — lo compartido con functions/ se deriva, no se enumera (B-1241)', () => {
    /**
     * B-1241 — hasta acá el script tenía una lista de cuatro archivos (los de
     * alias) y `src/` importaba seis más por ruta relativa. Un cambio que tocara
     * solo `functions/alta-de-opcion.js` deployaba la Function y no el panel.
     *
     * Esta es la atadura: el día que aparezca un import de `src/` hacia
     * `functions/` que el script no ve —por una forma nueva de escribirlo, o
     * porque alguien vuelve a cablear la lista—, este caso se pone rojo.
     *
     * MUTACIÓN PROBADA: volver al `awk` con los cuatro alias hace fallar los
     * casos de los seis archivos de más abajo; cambiar `LITERAL_A_FUNCTIONS` para
     * que exija `../` deja afuera a los de `astro.config.mjs` y este `it` falla.
     */
    it('el árbol chico deriva lo mismo que el real (M-3)', async () => {
      // La atadura del recorte: si el chico dejara afuera algo que la derivación
      // lee —un archivo de `src/` con otra forma de nombrar `functions/`, un
      // hermano—, los casos de decisión de arriba estarían contestando sobre
      // otro repo. Con esto, lo que dicen del chico vale para el real.
      expect((await compartidos()).length).toBeGreaterThanOrEqual(10);
      expect(await compartidos(CHICO)).toEqual(await compartidos());
    });

    it('todo lo que el build importa de functions/ lo ve el script', async () => {
      const esperados = importadosPorElBuild();
      // Control positivo: a la fecha de B-1241 son diez. Si el recorrido sale
      // vacío, el `toContain` de abajo no compara nada.
      expect(esperados.length).toBeGreaterThanOrEqual(10);
      expect(esperados).toContain('functions/alta-de-opcion.js');
      expect(esperados).toContain('functions/calendario.js');

      const vistos = await compartidos();
      for (const archivo of esperados) {
        expect(
          vistos,
          `${archivo} lo importa el build pero scripts/que-deployar.sh no lo ve: ` +
            'un cambio que toque solo ese archivo deployaría Functions y no Hosting',
        ).toContain(archivo);
      }
    });

    it('todo alias del panel a un archivo de functions/ está entre los compartidos (B-88)', async () => {
      // La atadura de B-88, que antes leía el `awk` del script. Se queda como
      // segundo control porque los alias son la otra mitad de la entrada.
      const alias = [
        ...readFileSync('astro.config.mjs', 'utf8').matchAll(/new URL\(\s*'\.\/(functions\/[\w-]+\.js)'/g),
      ].map((m) => m[1]!);
      expect(alias.length).toBeGreaterThan(0);
      expect(await compartidos()).toEqual(expect.arrayContaining(alias));
    });

    it('todo literal de astro.config.mjs que nombra functions/ es relativo con `./` (B-1390)', async () => {
      // La derivación y el recorrido de arriba reconocen rutas relativas. Un alias
      // escrito `path.resolve('functions/x.js')` —sin `./`— no lo vería ninguno de
      // los dos, así que ninguno avisaría: esta línea es la que sí.
      const literales = [
        // Sin comentarios: la prosa cita `functions/` entre backticks y no es un literal.
        ...readFileSync('astro.config.mjs', 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '')
          .matchAll(/['"`]([^'"`\n]*functions\/[^'"`\n]*)['"`]/g),
      ].map((m) => m[1]!);
      expect(literales.length).toBeGreaterThan(0);
      expect(literales.filter((l) => !l.startsWith('./'))).toEqual([]);
    });

    it('ni `index.js` ni un `-trigger.js` son compartidos', async () => {
      // Si alguno apareciera, o el build importa el entrypoint de las Functions
      // —trampa 4: firebase-admin en el bundle— o la derivación se volvió tan
      // ancha que ya no distingue nada.
      const vistos = await compartidos();
      expect(vistos).not.toContain('functions/index.js');
      expect(vistos.filter((f) => f.endsWith('-trigger.js'))).toEqual([]);
    });

    it.each([
      'functions/slugify.js',
      'functions/geografia.js',
      'functions/handle-instagram.js',
      'functions/alta-de-opcion.js',
      'functions/huella.js',
      'functions/etiqueta-presentable.js',
    ])('%s deploya functions Y hosting — lo importa src/ por ruta relativa', async (archivo) => {
      expect(await decidir([archivo])).toEqual({
        hosting: true, functions: true, firestore: false, storage: false,
      });
    });

    it('el package.json de functions/ no arrastra hosting mientras lo compartido no importe paquetes', async () => {
      expect((await decidir(['functions/package.json', 'functions/package-lock.json'])).hosting).toBe(false);
    });
  });

  describe.concurrent('qué deployar — la derivación sobre un árbol sintético (B-1241)', () => {
    /** Arma un árbol con estos archivos y devuelve su raíz. */
    const arbol = (archivos: Record<string, string>): string => {
      const raiz = mkdtempSync(path.join(tmpdir(), 'que-deployar-'));
      for (const [ruta, contenido] of Object.entries(archivos)) {
        mkdirSync(path.dirname(path.join(raiz, ruta)), { recursive: true });
        writeFileSync(path.join(raiz, ruta), contenido);
      }
      return raiz;
    };

    it('un archivo compartido nuevo queda cubierto sin que nadie lo sume', async () => {
      const raiz = arbol({
        'src/lib/nuevo.ts': "import { algo } from '../../functions/compartido-nuevo.js';\n",
        'functions/compartido-nuevo.js': 'export const algo = 1;\n',
        'functions/solo-de-la-function.js': 'export const otro = 2;\n',
      });
      expect((await decidir(['functions/compartido-nuevo.js'], raiz)).hosting).toBe(true);
      // Control negativo: lo que nadie del build importa sigue sin arrastrarlo.
      expect((await decidir(['functions/solo-de-la-function.js'], raiz)).hosting).toBe(false);
    });

    it('sigue los imports adentro de functions/', async () => {
      const raiz = arbol({
        'src/lib/a.mjs': "export * from '../../functions/a.js';\n",
        'functions/a.js': "import { b } from './b.js';\nexport const a = b;\n",
        'functions/b.js': "import { c } from './c';\nexport const b = c;\n",
        'functions/c.js': 'export const c = 1;\n',
      });
      expect(await compartidos(raiz)).toEqual(['functions/a.js', 'functions/b.js', 'functions/c.js']);
      expect((await decidir(['functions/c.js'], raiz)).hosting).toBe(true);
    });

    it('ve el alias de astro.config.mjs aunque el `new URL(` esté partido en dos líneas', async () => {
      const raiz = arbol({
        'src/pages/index.astro': '---\n---\n',
        'astro.config.mjs':
          "export default { alias: { '@x': fileURLToPath(\n  new URL(\n    './functions/x.js',\n    import.meta.url)) } };\n",
        'functions/x.js': 'export const x = 1;\n',
      });
      expect(await compartidos(raiz)).toEqual(['functions/x.js']);
    });

    it('ve un import dinámico con comillas invertidas', async () => {
      const raiz = arbol({
        'src/lib/a.ts': 'export const cargar = () => import(`../../functions/perezoso.js`);\n',
        'functions/perezoso.js': 'export const p = 1;\n',
      });
      expect(await compartidos(raiz)).toEqual(['functions/perezoso.js']);
    });

    it('si lo compartido importa un paquete, el package.json de functions/ arrastra hosting', async () => {
      const conPaquete = arbol({
        'src/lib/a.ts': "import { a } from '../../functions/a.js';\n",
        'functions/a.js': "import { chunk } from 'lodash-es';\nexport const a = chunk;\n",
      });
      expect((await decidir(['functions/package.json'], conPaquete)).hosting).toBe(true);
      expect((await decidir(['functions/package-lock.json'], conPaquete)).hosting).toBe(true);

      // `node:` no es un paquete de `functions/node_modules`.
      const conNode = arbol({
        'src/lib/a.ts': "import { a } from '../../functions/a.js';\n",
        'functions/a.js': "import { join } from 'node:path';\nexport const a = join;\n",
      });
      expect((await decidir(['functions/package.json'], conNode)).hosting).toBe(false);
    });

    it('sin `src/` no hay de dónde derivar, y todo functions/ cuenta para hosting', async () => {
      const raiz = arbol({ 'functions/cualquiera.js': 'export const x = 1;\n' });
      expect((await decidir(['functions/cualquiera.js'], raiz)).hosting).toBe(true);
    });

    it('no depende del directorio desde el que se lo llama', async () => {
      // El workflow lo llama desde la raíz, pero `verificar-todo.sh` o una
      // persona pueden no hacerlo. Sin esto, desde otra carpeta no encontraría
      // `src/` y caería en «todo functions/ cuenta».
      const salida = execFileSync(SCRIPT, {
        input: 'functions/index.js\n',
        encoding: 'utf8',
        cwd: tmpdir(),
      });
      expect(salida).toContain('hosting=false');
    });
  });
});
