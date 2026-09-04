import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PROJECT_ID_EMULADOR,
  PROYECTO_REAL,
  huellaDeRaiz,
  projectIdDeEmulador,
} from '../scripts/project-id-emulador.mjs';
import {
  HOST_FIRESTORE,
  PROJECT_ID,
  emuladorVivo,
  limpiarFirestore,
  proyectoAparte,
} from './emulador';

/**
 * El aislamiento del emulador entre working-trees — B-219, B-276, B-169.
 *
 * ── Qué se arregló ─────────────────────────────────────────────────────────
 * El emulador escucha en un puerto de la máquina, no del checkout, y todos los
 * tests de integración empiezan por `limpiarFirestore()`, que borra la base
 * **entera**. Con varios worktrees corriendo la suite a la vez —que es cómo se
 * trabaja este backlog— cada uno le vaciaba la base al otro en el medio de un
 * `it`. Cinco observaciones independientes de eso, de tres worktrees y dos días,
 * están anotadas en B-219; `fileParallelism: false` tapaba solo la mitad (los
 * archivos de una corrida, no las corridas de dos checkouts).
 *
 * El arreglo es **un `projectId` por working-tree** sobre el mismo emulador. El
 * porqué de esa opción y no la del puerto está en
 * `scripts/project-id-emulador.mjs`.
 *
 * ── Qué verifica este archivo, y en qué orden ──────────────────────────────
 * 1. La **derivación**: estable para un checkout, distinta entre checkouts, y
 *    con forma de project id de Firebase.
 * 2. El **mecanismo**, contra el emulador de verdad: que borrar la base de un
 *    proyecto no toque la del otro. Es la propiedad de la que depende todo lo
 *    demás, y era la que B-219 anotaba como dudosa («choca con
 *    `singleProjectMode: true`»): no choca, y acá queda fijado en vez de escrito
 *    en un comentario.
 * 3. El **cableado**: que la suite que está corriendo use esa base, que ningún
 *    archivo de integración vuelva al literal `'agenda-literaria'`, y que los
 *    dos consumidores de afuera —el gate en bash y el script que un test
 *    ejecuta— reciban el mismo valor en vez de derivarlo por su cuenta.
 *
 * El 3 es el que hace que esto no se afloje solo: el arreglo se pierde
 * escribiendo `projectId: 'agenda-literaria'` en un archivo nuevo, y eso no
 * rompe nada hasta que dos worktrees coinciden — o sea, se pierde en silencio.
 */
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const fuente = (relativa: string) =>
  readFileSync(new URL(`../${relativa}`, import.meta.url), 'utf8');

/** Los archivos de integración, listados del disco y no a mano. */
const ARCHIVOS_INTEGRACION = readdirSync(new URL('.', import.meta.url))
  .filter((n) => n.endsWith('.integracion.test.ts'))
  .sort();

const vivo = await emuladorVivo();

describe('la derivación del projectId por working-tree', () => {
  it('el mismo checkout da siempre el mismo id', () => {
    // Tiene que ser estable: el emulador persiste con `--export-on-exit`, así
    // que un id nuevo por corrida dejaría una base huérfana por vez.
    expect(projectIdDeEmulador('/a/b/repo')).toBe(projectIdDeEmulador('/a/b/repo'));
  });

  it('dos checkouts del mismo repo dan ids distintos', () => {
    // La propiedad que hace el aislamiento. Sin ella no hay nada que probar.
    expect(projectIdDeEmulador('/x/agenda-literaria')).not.toBe(
      projectIdDeEmulador('/x/agenda-literaria/.claude/worktrees/agent-1'),
    );
  });

  it('la barra final no cambia el id: el CLI y el import coinciden', () => {
    /*
     * `new URL('..', import.meta.url)` termina en `/` y `git rev-parse
     * --show-toplevel` no. Si la huella no normalizara eso, el gate en bash y
     * `vitest.config.ts` estarían usando dos bases distintas del mismo
     * checkout — el paso 4 sembraría en una y el paso 3 borraría la otra, que
     * es una variante del mismo bug adentro de un solo worktree.
     */
    expect(huellaDeRaiz('/a/b/repo/')).toBe(huellaDeRaiz('/a/b/repo'));
    expect(huellaDeRaiz('/a/b/repo///')).toBe(huellaDeRaiz('/a/b/repo'));
  });

  it('tiene forma de project id de Firebase y nunca es el proyecto real', () => {
    const id = projectIdDeEmulador('/x/y/z');
    // 6-30 caracteres, minúsculas, dígitos y guiones, arranca con letra y no
    // termina en guion. Si la huella creciera, el emulador lo aceptaría igual
    // pero el valor dejaría de ser un project id válido y el día que alguien lo
    // apunte a un proyecto de verdad fallaría ahí.
    expect(id).toMatch(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);
    expect(id.length).toBeLessThanOrEqual(30);
    // Y sobre todo: no es el de producción. Un test de integración que apunte
    // al proyecto real es lo único peor que dos que se pisan.
    expect(id).not.toBe(PROYECTO_REAL);
  });
});

describe.skipIf(!vivo)('el mecanismo: el emulador aísla de verdad por proyecto', () => {
  /*
   * Un proyecto vecino de mentira, que hace de "el otro worktree". El nombre no
   * puede ser el de otro checkout de verdad: el punto es borrarlo entero.
   *
   * Y cuelga del nuestro (`proyectoAparte`) en vez de ser un literal, porque si
   * no este test es la instancia número tres del bug que viene a probar: dos
   * corridas concurrentes compartirían el vecino y se lo vaciarían entre sí. Dio
   * rojo así, en la primera prueba con dos corridas a la vez.
   */
  const VECINO = proyectoAparte('vecino');
  const doc = (pid: string, id: string) =>
    `http://${HOST_FIRESTORE}/v1/projects/${pid}/databases/(default)/documents/cosas/${id}`;

  const sembrar = async (pid: string, id: string) => {
    const r = await fetch(
      `http://${HOST_FIRESTORE}/v1/projects/${pid}/databases/(default)/documents/cosas?documentId=${id}`,
      {
        method: 'POST',
        // `Bearer owner` es el equivalente del Admin SDK en el emulador: saltea
        // las reglas, así que la siembra no depende de qué ruleset esté cargado.
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
        body: JSON.stringify({ fields: { a: { stringValue: 'b' } } }),
      },
    );
    if (!r.ok) throw new Error(`no se pudo sembrar ${pid}/${id}: ${r.status}`);
  };

  const existe = async (pid: string, id: string) =>
    (await fetch(doc(pid, id), { headers: { Authorization: 'Bearer owner' } })).ok;

  it('`limpiarFirestore()` de este checkout no toca la base del vecino', async () => {
    await sembrar(PROJECT_ID, 'propia');
    await sembrar(VECINO, 'del-vecino');

    // Control positivo: sin esto, los dos asertos de abajo pasarían con la
    // siembra fallada en silencio y no probarían nada.
    expect(await existe(PROJECT_ID, 'propia'), 'la siembra propia no quedó').toBe(true);
    expect(await existe(VECINO, 'del-vecino'), 'la siembra del vecino no quedó').toBe(true);

    await limpiarFirestore();

    // La mitad conocida: lo nuestro se borró, que es para lo que existe.
    expect(await existe(PROJECT_ID, 'propia')).toBe(false);
    // Y la mitad que es el arreglo: lo del vecino sigue ahí. Antes de B-219 este
    // aserto era falso — `limpiarFirestore()` vaciaba la única base que había.
    expect(
      await existe(VECINO, 'del-vecino'),
      'el borrado se propagó al proyecto vecino: el aislamiento no existe',
    ).toBe(true);

    await limpiarFirestore(VECINO);
    expect(await existe(VECINO, 'del-vecino')).toBe(false);
  }, 30_000);

  it('y las reglas también son por proyecto: cargar las nuestras no pisa al vecino', async () => {
    /*
     * La otra mitad del estado compartido, y es la de B-174: `cargarReglas`
     * empuja el `firestore.rules` de este checkout, y su docblock advertía que
     * «con dos suites en paralelo, la última que carga gana». Con el proyecto
     * particionado eso dejó de ser cierto, y conviene fijarlo: es lo que hace
     * que empujar las reglas propias haya pasado de "cortesía" a obligatorio.
     */
    const cerrada = `rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /{d=**} { allow read, write: if false; }
        }
      }`;
    const cargar = async (pid: string, contenido: string) => {
      const r = await fetch(
        `http://${HOST_FIRESTORE}/emulator/v1/projects/${pid}:securityRules`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rules: { files: [{ name: 'firestore.rules', content: contenido }] },
          }),
        },
      );
      expect(r.ok, `el emulador rechazó las reglas de ${pid}`).toBe(true);
    };

    const abierta = `rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /{d=**} { allow read, write: if true; }
        }
      }`;
    await cargar(VECINO, abierta);
    await sembrar(VECINO, 'con-reglas-abiertas');
    // Anónimo, o sea sujeto a las reglas: con las abiertas, pasa.
    expect((await fetch(doc(VECINO, 'con-reglas-abiertas'))).ok).toBe(true);

    // Ahora este checkout carga unas reglas cerradas EN SU proyecto.
    await cargar(PROJECT_ID, cerrada);

    // El vecino sigue con las suyas: la carga no fue global.
    expect(
      (await fetch(doc(VECINO, 'con-reglas-abiertas'))).ok,
      'la carga de reglas se propagó al proyecto vecino',
    ).toBe(true);

    // Y las nuestras sí cambiaron — control negativo, para que el aserto de
    // arriba no pase por no haber cargado nada.
    await sembrar(PROJECT_ID, 'con-reglas-cerradas');
    expect((await fetch(doc(PROJECT_ID, 'con-reglas-cerradas'))).ok).toBe(false);

    await limpiarFirestore(VECINO);
    await limpiarFirestore();
    // Se dejan las reglas del checkout como las espera el resto de la suite.
    await cargar(PROJECT_ID, fuente('firestore.rules'));
  }, 30_000);
});

describe('el cableado: todo lo que habla con el emulador usa esa base', () => {
  it('la suite corre contra la base que resuelve el módulo, y nunca contra la real', () => {
    /*
     * Ata el valor que ven los tests al que resuelve `project-id-emulador.mjs`.
     * Si alguien vuelve a poner el literal en `vitest.config.ts`, esto falla.
     *
     * Se compara contra `PROJECT_ID_EMULADOR` y no contra
     * `projectIdDeEmulador(RAIZ)` a propósito: el módulo respeta
     * `PUBLIC_FIREBASE_PROJECT_ID` del entorno, que es la salida de emergencia
     * documentada (apuntar una corrida a la base que uno tiene cargada a mano, y
     * es también cómo se probó el arreglo con dos corridas concurrentes). Atarlo
     * a la derivación pura haría fallar el test justo cuando se usa esa salida,
     * que es una falla del test y no del cableado.
     *
     * Lo que no se negocia, con override o sin él, es la segunda mitad: la suite
     * de integración no corre contra el proyecto de producción.
     */
    expect(PROJECT_ID).toBe(PROJECT_ID_EMULADOR);
    expect(PROJECT_ID).not.toBe(PROYECTO_REAL);
    // Y sin override, es la derivación de este checkout.
    if (!process.env.PUBLIC_FIREBASE_PROJECT_ID_FORZADO) {
      expect(PROJECT_ID_EMULADOR).toBe(
        process.env.PUBLIC_FIREBASE_PROJECT_ID ?? projectIdDeEmulador(RAIZ),
      );
    }
  });

  it('ningún test le habla al emulador con un projectId fijo', () => {
    /*
     * La instancia que la concurrencia destapó y que el resto de este archivo no
     * cubría: dos tests tenían un proyecto **auxiliar** con nombre literal
     * (`'trampa-7-mecanismo'` y el vecino de acá). Las bases principales estaban
     * separadas y las auxiliares no, así que dos corridas concurrentes se
     * pisaban igual — el mismo bug, un nivel más abajo.
     *
     * La regla: todo projectId que salga hacia el emulador tiene que derivar de
     * `PROJECT_ID`. Se verifica sobre las URLs de la API del emulador, que son
     * el único camino por el que un projectId llega hasta él.
     */
    const permitidos = new Set(['PROJECT_ID', 'PID', 'pid', 'VECINO', 'projectId']);
    const sospechosos: string[] = [];
    for (const archivo of readdirSync(new URL('.', import.meta.url)).filter((n) =>
      n.endsWith('.test.ts'),
    )) {
      const src = fuente(`tests/${archivo}`);
      // Un projectId escrito a mano dentro de la URL: no puede haber ninguno.
      for (const m of src.matchAll(/projects\/([^$}\n]{0,40}?)[:/]/g)) {
        sospechosos.push(`${archivo}: projects/${m[1]} escrito a mano`);
      }
      // Y los que se interpolan tienen que ser de la lista, y estar definidos a
      // partir de PROJECT_ID.
      for (const m of src.matchAll(/projects\/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) {
        const nombre = m[1]!;
        if (!permitidos.has(nombre)) {
          sospechosos.push(`${archivo}: projects/\${${nombre}} — nombre no previsto`);
          continue;
        }
        const definicion = new RegExp(`(?:const|let)\\s+${nombre}\\s*=\\s*([^;\\n]+)`).exec(src);
        if (definicion && !/PROJECT_ID|proyectoAparte\(/.test(definicion[1]!)) {
          sospechosos.push(`${archivo}: ${nombre} = ${definicion[1]!.trim()} no deriva de PROJECT_ID`);
        }
      }
    }
    expect(sospechosos).toEqual([]);
  });

  it('`vitest.config.ts` importa el projectId, no lo deriva de nuevo', () => {
    const config = fuente('vitest.config.ts');
    expect(config).toContain("from './scripts/project-id-emulador.mjs'");
    expect(config).toContain('PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID_EMULADOR');
  });

  it('el gate en bash lee el mismo valor del mismo lugar', () => {
    /*
     * `verificar-todo.sh` no puede importar un módulo, así que llama al CLI. Lo
     * que no puede hacer es escribir su propia derivación: dos derivaciones del
     * mismo dato es la clase de B-88, y acá el síntoma sería que el paso 4
     * siembra en una base y el paso 3 borra otra.
     */
    const gate = fuente('scripts/verificar-todo.sh');
    expect(gate).toContain('node scripts/project-id-emulador.mjs');
    expect(gate).toContain('export PUBLIC_FIREBASE_PROJECT_ID=');
  });

  it('ningún archivo de integración vuelve al literal del proyecto real', () => {
    // La regresión que se pierde en silencio: escribir `projectId:
    // 'agenda-literaria'` en un archivo nuevo no rompe nada hasta el día que
    // dos worktrees coinciden.
    expect(ARCHIVOS_INTEGRACION.length).toBeGreaterThanOrEqual(7);
    for (const archivo of ARCHIVOS_INTEGRACION) {
      const src = fuente(`tests/${archivo}`);
      expect(src, `${archivo} escribe el projectId a mano`).not.toMatch(
        /projectId:\s*'agenda-literaria'/,
      );
    }
  });

  it('todo archivo que lee con el SDK de cliente empuja las reglas de este checkout', () => {
    /*
     * B-174, y ahora es obligatorio y no una mejora: la base de un working-tree
     * arranca **sin reglas**, así que un archivo que use el SDK de cliente sin
     * llamar a `cargarReglas` no está verificando el `firestore.rules` de al
     * lado — está corriendo contra lo que el emulador tenga cargado por default,
     * que es el archivo de otra rama.
     *
     * Los que usan solo el Admin SDK (el build, el endpoint) no entran: sus
     * credenciales saltean las reglas y cargarlas no cambiaría nada.
     */
    const conClienteYSinReglas = ARCHIVOS_INTEGRACION.filter((archivo) => {
      const src = fuente(`tests/${archivo}`);
      const usaCliente = /@\/lib\/firestore-client|from 'firebase\/firestore'/.test(src);
      return usaCliente && !src.includes('cargarReglas(');
    });
    expect(conClienteYSinReglas).toEqual([]);
  });

  it('un script que un test ejecuta recibe el projectId por el entorno', () => {
    /*
     * B-169 — los tres tests flaky de `opciones.integracion.test.ts` son los que
     * corren `scripts/aprobar-opciones.mjs` de verdad. El script resuelve el
     * proyecto con `process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria'`,
     * o sea que sin pasárselo trabajaría sobre la base compartida mientras el
     * test afirma sobre la de este checkout.
     */
    expect(fuente('scripts/aprobar-opciones.mjs')).toContain('PUBLIC_FIREBASE_PROJECT_ID');
    expect(fuente('tests/opciones.integracion.test.ts')).toContain(
      'PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID',
    );
  });

  /**
   * Y el mismo chequeo como **clase** — B-661, el cierre de B-169.
   *
   * El caso de arriba nombra dos archivos, y por eso protege dos archivos. El
   * bug no era de `aprobar-opciones.mjs`: era la forma «un test de integración
   * lanza un proceso que resuelve el proyecto por su cuenta», y esa forma la
   * repite el segundo script que alguien ejecute desde un test. Hoy es uno; la
   * primera vez que sean dos, el caso de arriba pasa en verde mientras vuelven
   * los tres tests flaky de B-169 con otra cara — que es exactamente el
   * «verificar la clase, no la instancia» de `docs/05-patrones.md`.
   *
   * La lista **se deriva** (`*.integracion.test.ts` del directorio, ya derivada
   * arriba) y el criterio también: si el archivo lanza un proceso, ese proceso
   * tiene que recibir el `projectId`. No hay nada que agregar a mano cuando
   * nazca el próximo.
   *
   * **Por qué no se pone rojo por algo ajeno** (B-180): un archivo de
   * integración nuevo solo lo activa si además lanza un proceso, y en ese caso
   * el rojo es sobre su propio código, con el arreglo escrito en el mensaje.
   *
   * MUTACIÓN PROBADA: sacar el bloque `env:` del `execFileSync` de
   * `opciones.integracion.test.ts` pone este caso en rojo nombrando el archivo.
   */
  it('ningún test de integración lanza un proceso sin pasarle el projectId — B-661', () => {
    /** Los que lanzan un proceso hijo, sea con `node` o con un `.sh`. */
    const LANZA = /\b(?:execFileSync|execSync|spawnSync|execFile|spawn)\s*\(/;

    const lanzadores = ARCHIVOS_INTEGRACION.filter((a) => LANZA.test(fuente(`tests/${a}`)));

    // Control positivo: si nadie lanza nada, el chequeo no compara nada y el
    // verde no significaría que la clase está cubierta.
    expect(
      lanzadores.length,
      'ningún archivo de integración lanza procesos: revisar el regex antes de ' +
        'confiar en el verde de este caso',
    ).toBeGreaterThan(0);

    /*
     * Se exige la forma de **clave de objeto** (`PUBLIC_FIREBASE_PROJECT_ID:`)
     * y no la mención del nombre: los docblocks de estos archivos citan
     * `process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria'` para
     * explicar el bug, y con un `includes` a secas un comentario alcanzaría
     * para satisfacer el chequeo. Fue el primer intento y la mutación lo mostró.
     */
    const sinProjectId = lanzadores.filter(
      (a) => !/PUBLIC_FIREBASE_PROJECT_ID\s*:/.test(fuente(`tests/${a}`)),
    );
    expect(
      sinProjectId,
      'estos tests de integración lanzan un proceso y no le pasan ' +
        '`PUBLIC_FIREBASE_PROJECT_ID` en el `env`: el proceso va a resolver el ' +
        'proyecto por su cuenta (el default es el literal `agenda-literaria`) y ' +
        'va a trabajar sobre una base distinta de la que el test siembra y ' +
        'afirma. Es B-169: el síntoma no es un error, es un test que falla una ' +
        'de cada N corridas.',
    ).toEqual([]);
  });
});
