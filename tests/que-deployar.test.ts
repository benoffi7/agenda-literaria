import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
const decidir = (archivos: string[]): Record<string, boolean> => {
  const salida = execFileSync('./scripts/que-deployar.sh', {
    input: archivos.join('\n'),
    encoding: 'utf8',
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
    const archivos = execFileSync('git', ['ls-files', '-z', 'src', 'astro.config.mjs'], {
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean);

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

describe('qué deployar — el exento de functions/ no puede quedar corto (B-88)', () => {
  it('todo alias del panel a un archivo de functions/ está en la lista exenta del script', () => {
    /*
     * La atadura que evita que este agujero se vuelva a abrir en silencio: si
     * mañana se agrega un alias nuevo (`@algo-mas`) apuntando a
     * `functions/<archivo>.js` en `astro.config.mjs` y no se lo suma al `awk`
     * de `que-deployar.sh`, este test se pone rojo ANTES de que el próximo
     * cambio a ese archivo deploye Functions sin deployar Hosting.
     *
     * Mutación: agregar un alias nuevo a `astro.config.mjs` sin tocar
     * `que-deployar.sh` — este `it` lo atrapa. Sacar `historial.js` o
     * `png-chunks-seguros.js` del `awk` — también.
     */
    const astroConfig = readFileSync('astro.config.mjs', 'utf8');
    const alias = [
      ...astroConfig.matchAll(/new URL\('\.\/functions\/([\w-]+)\.js',/g),
    ].map((m) => m[1]);
    // Control: que el propio regex encuentre algo, para que un cambio de forma
    // en astro.config.mjs no vacíe la lista y haga pasar el test por nada que
    // comparar.
    expect(alias.length).toBeGreaterThan(0);

    const script = readFileSync('scripts/que-deployar.sh', 'utf8');
    const awk = /awk '!\/\^functions\\\/\/ \|\| \/\^functions\\\/\(([\w|-]+)\)\\\.js\$\/'/.exec(
      script,
    );
    expect(awk, 'no se encontró el patrón awk esperado en que-deployar.sh').not.toBeNull();
    const exentos = awk![1]!.split('|');

    for (const nombre of alias) {
      expect(exentos, `functions/${nombre}.js tiene alias de panel pero no está en el awk`).toContain(
        nombre,
      );
    }
  });
});
