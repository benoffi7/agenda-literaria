import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
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

/** `raiz` corre el script sobre otro árbol (`QUE_DEPLOYAR_RAIZ`, B-1241). */
const decidir = (archivos: string[], raiz?: string): Record<string, boolean> => {
  const salida = execFileSync(SCRIPT, {
    input: archivos.join('\n'),
    encoding: 'utf8',
    env: raiz ? { ...process.env, QUE_DEPLOYAR_RAIZ: raiz } : process.env,
  });
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

describe('qué deployar — lo obvio', () => {
  it('sin cambios, no deploya nada', () => {
    expect(decidir([])).toEqual({ hosting: false, functions: false, firestore: false, storage: false });
  });

  it('un cambio en el panel deploya solo hosting', () => {
    expect(decidir(['src/components/admin/AdminApp.tsx'])).toEqual({
      hosting: true, functions: false, firestore: false, storage: false,
    });
  });

  it('un cambio en las reglas deploya solo firestore', () => {
    expect(decidir(['firestore.rules'])).toEqual({
      hosting: false, functions: false, firestore: true, storage: false,
    });
  });

  it('los índices también son firestore', () => {
    expect(decidir(['firestore.indexes.json']).firestore).toBe(true);
  });

  it('el trigger de una Function deploya solo functions', () => {
    expect(decidir(['functions/reportes-trigger.js'])).toEqual({
      hosting: false, functions: true, firestore: false, storage: false,
    });
  });
});

describe('qué deployar — el caso que motiva el diseño', () => {
  it('calendario.js deploya functions Y hosting', () => {
    // Está en functions/, pero el panel lo importa como @calendario para la
    // vista previa del evento. Si solo se deployaran las Functions, la vista
    // previa mostraría algo distinto de lo que el sync publica.
    expect(decidir(['functions/calendario.js'])).toEqual({
      hosting: true, functions: true, firestore: false, storage: false,
    });
  });

  it('historial.js también deploya functions Y hosting', () => {
    // Lo encontró el auditor-privacidad auditando B-323: el panel lo importa
    // como @historial (comparación de versiones), y hasta acá el script no lo
    // sabía — este `it` fallaba antes del arreglo.
    expect(decidir(['functions/historial.js'])).toEqual({
      hosting: true, functions: true, firestore: false, storage: false,
    });
  });

  it('un cambio en la lista blanca de chunks PNG deploya functions Y hosting (B-323)', () => {
    // El panel lo importa como @png-chunks-seguros (sanear una imagen antes de
    // subirla) y la Function lo importa directo (estructuraConocida). Un
    // cambio a los chunks seguros que solo redeployara Functions dejaría al
    // panel subiendo con la lista vieja, en silencio.
    expect(decidir(['functions/png-chunks-seguros.js'])).toEqual({
      hosting: true, functions: true, firestore: false, storage: false,
    });
  });

  it('el resto de functions/ NO arrastra hosting', () => {
    expect(decidir(['functions/imagenes.js', 'functions/index.js']).hosting).toBe(false);
  });

  it('firebase.json deploya functions y hosting', () => {
    // Tiene las cabeceras de cache (hosting) y la config del codebase.
    const r = decidir(['firebase.json']);
    expect(r.functions).toBe(true);
    expect(r.hosting).toBe(true);
    // B-167 — y también las reglas de Storage: `firebase.json` es donde está
    // declarado qué archivo son.
    expect(r.storage).toBe(true);
  });
});

describe('qué deployar — las reglas de Storage (B-167)', () => {
  it('storage.rules deploya solo storage', () => {
    // Es su propio target: `firebase deploy --only storage`. Si cayera en la
    // decisión de `firestore`, un cambio de reglas de Storage se deployaría
    // **nunca** — y el bucket quedaría con las reglas viejas sin que nada lo
    // diga, que es el default caro.
    expect(decidir(['storage.rules'])).toEqual({
      hosting: false, functions: false, firestore: false, storage: true,
    });
  });

  it('storage.rules NO arrastra hosting', () => {
    // Es config del servidor y nadie la importa, así que no puede entrar al
    // bundle. Es el mismo argumento que ya tenía `firestore.rules`, y lo que lo
    // sostiene es la línea de la lista NEGRA: sin ella caería en "archivo
    // desconocido" y pediría un deploy de hosting que no hace falta.
    expect(decidir(['storage.rules']).hosting).toBe(false);
  });

  it('las dos reglas juntas deployan las dos, y nada más', () => {
    expect(decidir(['firestore.rules', 'storage.rules'])).toEqual({
      hosting: false, functions: false, firestore: true, storage: true,
    });
  });

  it('el módulo que sube las imágenes es del panel, no de las reglas', () => {
    // Control negativo: `src/lib/subir-imagen.ts` habla con Storage pero es
    // código del bundle. Si por su nombre terminara decidiendo `storage`, un
    // cambio del panel intentaría deployar reglas.
    expect(decidir(['src/lib/subir-imagen.ts'])).toEqual({
      hosting: true, functions: false, firestore: false, storage: false,
    });
  });
});

describe('qué deployar — falla hacia deployar', () => {
  it('un archivo desconocido en la raíz deploya hosting', () => {
    // El error barato es un deploy de más. Quedarse corto deja producción con
    // código viejo sin que nada lo diga.
    expect(decidir(['algo-nuevo-que-nadie-previo.ts']).hosting).toBe(true);
  });

  it('una carpeta nueva deploya hosting', () => {
    expect(decidir(['lib-compartida/util.ts']).hosting).toBe(true);
  });

  it('un cambio de dependencias deploya hosting', () => {
    expect(decidir(['package.json', 'package-lock.json']).hosting).toBe(true);
  });

  it('la config del build deploya hosting', () => {
    expect(decidir(['astro.config.mjs']).hosting).toBe(true);
    expect(decidir(['tsconfig.json']).hosting).toBe(true);
  });

  it('la config pública del SDK deploya hosting', () => {
    expect(decidir(['.env.production']).hosting).toBe(true);
  });
});

describe('qué deployar — lo que no toca nada', () => {
  it('solo documentación no deploya nada', () => {
    expect(decidir(['docs/BACKLOG.md', 'README.md', 'CLAUDE.md'])).toEqual({
      hosting: false, functions: false, firestore: false, storage: false,
    });
  });

  it('solo tests no deploya nada', () => {
    expect(decidir(['tests/schema.test.ts', 'tests/emulador.ts'])).toEqual({
      hosting: false, functions: false, firestore: false, storage: false,
    });
  });

  it('solo workflows no deploya nada', () => {
    expect(decidir(['.github/workflows/push-main.yml'])).toEqual({
      hosting: false, functions: false, firestore: false, storage: false,
    });
  });

  it('los scripts de mantenimiento no deployan nada', () => {
    expect(decidir(['scripts/preparar-produccion.mjs', 'scripts/seed-emulador.mjs'])).toEqual({
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
  it('scripts/verificar-calendario.mjs tampoco deploya nada (B-125, D-293)', () => {
    expect(decidir(['scripts/verificar-calendario.mjs'])).toEqual({
      hosting: false, functions: false, firestore: false, storage: false,
    });
  });

  it('pero scripts/version.mjs SÍ deploya hosting', () => {
    // Calcula la versión que se estampa en el bundle.
    expect(decidir(['scripts/version.mjs']).hosting).toBe(true);
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
  it('la configuración de los agentes no deploya nada (B-215)', () => {
    expect(decidir(['.claude/settings.json'])).toEqual({
      hosting: false, functions: false, firestore: false, storage: false,
    });
    expect(
      decidir(['.claude/agents/auditor-privacidad.md', '.claude/skills/cerrar-cambio/SKILL.md']),
    ).toEqual({ hosting: false, functions: false, firestore: false, storage: false });
  });

  it('el hook de git tampoco (B-215)', () => {
    expect(decidir(['githooks/pre-push'])).toEqual({
      hosting: false, functions: false, firestore: false, storage: false,
    });
  });
});

describe('qué deployar — lo que se excluye tiene que ser demostrable (B-215)', () => {
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
  it('nada de `src/` ni del config del build alcanza `.claude/` ni `githooks/`', () => {
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

describe('qué deployar — combinaciones', () => {
  it('un cambio grande deploya todo', () => {
    expect(
      decidir(['src/lib/schema.ts', 'functions/index.js', 'firestore.rules', 'storage.rules']),
    ).toEqual({ hosting: true, functions: true, firestore: true, storage: true });
  });

  it('documentación junto con código deploya lo del código', () => {
    expect(decidir(['docs/CHANGELOG.md', 'src/lib/toPublic.ts'])).toEqual({
      hosting: true, functions: false, firestore: false, storage: false,
    });
  });
});

/**
 * Lo que el script cree que es compartido entre `functions/` y el build.
 * `raiz` lo corre sobre otro árbol (los casos sintéticos de más abajo).
 */
const compartidos = (raiz?: string): string[] =>
  execFileSync(SCRIPT, ['--compartidos'], {
    encoding: 'utf8',
    env: raiz ? { ...process.env, QUE_DEPLOYAR_RAIZ: raiz } : process.env,
  })
    .split('\n')
    .filter(Boolean);

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

describe('qué deployar — lo compartido con functions/ se deriva, no se enumera (B-1241)', () => {
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
  it('todo lo que el build importa de functions/ lo ve el script', () => {
    const esperados = importadosPorElBuild();
    // Control positivo: a la fecha de B-1241 son diez. Si el recorrido sale
    // vacío, el `toContain` de abajo no compara nada.
    expect(esperados.length).toBeGreaterThanOrEqual(10);
    expect(esperados).toContain('functions/alta-de-opcion.js');
    expect(esperados).toContain('functions/calendario.js');

    const vistos = compartidos();
    for (const archivo of esperados) {
      expect(
        vistos,
        `${archivo} lo importa el build pero scripts/que-deployar.sh no lo ve: ` +
          'un cambio que toque solo ese archivo deployaría Functions y no Hosting',
      ).toContain(archivo);
    }
  });

  it('todo alias del panel a un archivo de functions/ está entre los compartidos (B-88)', () => {
    // La atadura de B-88, que antes leía el `awk` del script. Se queda como
    // segundo control porque los alias son la otra mitad de la entrada.
    const alias = [
      ...readFileSync('astro.config.mjs', 'utf8').matchAll(/new URL\(\s*'\.\/(functions\/[\w-]+\.js)'/g),
    ].map((m) => m[1]!);
    expect(alias.length).toBeGreaterThan(0);
    expect(compartidos()).toEqual(expect.arrayContaining(alias));
  });

  it('ni `index.js` ni un `-trigger.js` son compartidos', () => {
    // Si alguno apareciera, o el build importa el entrypoint de las Functions
    // —trampa 4: firebase-admin en el bundle— o la derivación se volvió tan
    // ancha que ya no distingue nada.
    const vistos = compartidos();
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
  ])('%s deploya functions Y hosting — lo importa src/ por ruta relativa', (archivo) => {
    expect(decidir([archivo])).toEqual({
      hosting: true, functions: true, firestore: false, storage: false,
    });
  });

  it('el package.json de functions/ no arrastra hosting mientras lo compartido no importe paquetes', () => {
    expect(decidir(['functions/package.json', 'functions/package-lock.json']).hosting).toBe(false);
  });
});

describe('qué deployar — la derivación sobre un árbol sintético (B-1241)', () => {
  /** Arma un árbol con estos archivos y devuelve su raíz. */
  const arbol = (archivos: Record<string, string>): string => {
    const raiz = mkdtempSync(path.join(tmpdir(), 'que-deployar-'));
    for (const [ruta, contenido] of Object.entries(archivos)) {
      mkdirSync(path.dirname(path.join(raiz, ruta)), { recursive: true });
      writeFileSync(path.join(raiz, ruta), contenido);
    }
    return raiz;
  };

  it('un archivo compartido nuevo queda cubierto sin que nadie lo sume', () => {
    const raiz = arbol({
      'src/lib/nuevo.ts': "import { algo } from '../../functions/compartido-nuevo.js';\n",
      'functions/compartido-nuevo.js': 'export const algo = 1;\n',
      'functions/solo-de-la-function.js': 'export const otro = 2;\n',
    });
    expect(decidir(['functions/compartido-nuevo.js'], raiz).hosting).toBe(true);
    // Control negativo: lo que nadie del build importa sigue sin arrastrarlo.
    expect(decidir(['functions/solo-de-la-function.js'], raiz).hosting).toBe(false);
  });

  it('sigue los imports adentro de functions/', () => {
    const raiz = arbol({
      'src/lib/a.mjs': "export * from '../../functions/a.js';\n",
      'functions/a.js': "import { b } from './b.js';\nexport const a = b;\n",
      'functions/b.js': "import { c } from './c';\nexport const b = c;\n",
      'functions/c.js': 'export const c = 1;\n',
    });
    expect(compartidos(raiz)).toEqual(['functions/a.js', 'functions/b.js', 'functions/c.js']);
    expect(decidir(['functions/c.js'], raiz).hosting).toBe(true);
  });

  it('ve el alias de astro.config.mjs aunque el `new URL(` esté partido en dos líneas', () => {
    const raiz = arbol({
      'src/pages/index.astro': '---\n---\n',
      'astro.config.mjs':
        "export default { alias: { '@x': fileURLToPath(\n  new URL(\n    './functions/x.js',\n    import.meta.url)) } };\n",
      'functions/x.js': 'export const x = 1;\n',
    });
    expect(compartidos(raiz)).toEqual(['functions/x.js']);
  });

  it('ve un import dinámico con comillas invertidas', () => {
    const raiz = arbol({
      'src/lib/a.ts': 'export const cargar = () => import(`../../functions/perezoso.js`);\n',
      'functions/perezoso.js': 'export const p = 1;\n',
    });
    expect(compartidos(raiz)).toEqual(['functions/perezoso.js']);
  });

  it('si lo compartido importa un paquete, el package.json de functions/ arrastra hosting', () => {
    const conPaquete = arbol({
      'src/lib/a.ts': "import { a } from '../../functions/a.js';\n",
      'functions/a.js': "import { chunk } from 'lodash-es';\nexport const a = chunk;\n",
    });
    expect(decidir(['functions/package.json'], conPaquete).hosting).toBe(true);
    expect(decidir(['functions/package-lock.json'], conPaquete).hosting).toBe(true);

    // `node:` no es un paquete de `functions/node_modules`.
    const conNode = arbol({
      'src/lib/a.ts': "import { a } from '../../functions/a.js';\n",
      'functions/a.js': "import { join } from 'node:path';\nexport const a = join;\n",
    });
    expect(decidir(['functions/package.json'], conNode).hosting).toBe(false);
  });

  it('sin `src/` no hay de dónde derivar, y todo functions/ cuenta para hosting', () => {
    const raiz = arbol({ 'functions/cualquiera.js': 'export const x = 1;\n' });
    expect(decidir(['functions/cualquiera.js'], raiz).hosting).toBe(true);
  });

  it('no depende del directorio desde el que se lo llama', () => {
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
