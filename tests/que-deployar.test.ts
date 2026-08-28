import { execFileSync } from 'node:child_process';
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

  it('el resto de functions/ NO arrastra hosting', () => {
    expect(decidir(['functions/historial.js', 'functions/index.js']).hosting).toBe(false);
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

  it('pero scripts/version.mjs SÍ deploya hosting', () => {
    // Calcula la versión que se estampa en el bundle.
    expect(decidir(['scripts/version.mjs']).hosting).toBe(true);
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
