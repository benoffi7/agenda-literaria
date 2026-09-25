/**
 * B-88: el consumidor acepta todo lo que el productor produce.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { construirEvento as construirEventoAnalitica } from '@/lib/analytics-eventos';
import { versionesPosibles } from '../../scripts/version.mjs';
import { CAMPOS_TAXONOMIA } from '@/types/actividad';
import { TOPE_TITULO_REPORTE } from '@/types/reporte';
import { raiz, fuente, ARCHIVOS_FUNCTIONS, sinComentarios } from '../fixtures/clases-de-bug';

// ─────────────────────────────────────────────────────────────────────
// Clase de B-88 · el productor de un formato y su consumidor derivan por
// separado
// ─────────────────────────────────────────────────────────────────────

/**
 * Cuando un lado produce un formato y otro lo valida, el acuerdo no está
 * escrito en ninguna parte: son dos derivaciones independientes de la misma
 * idea, y se separan sin que nada falle.
 *
 * La verificación no repite el formato: **saca las formas del productor** y las
 * hace pasar por el consumidor. Una forma nueva en `version.mjs` entra sola.
 */
const SUSTITUCIONES: Record<string, string> = {
  '${pkg.version}': '1.0.1',
  '${sha}': '5e2cb50',
  '${sello(ahora)}': '20260821-2124',
};


/**
 * Las versiones que el build puede llegar a estampar.
 *
 * Sale de `versionesPosibles()` —que el propio `scripts/version.mjs` exporta
 * como el dominio completo de sus salidas (D-98)— y no de un regex sobre sus
 * plantillas. La versión anterior de este helper extraía los literales con
 * backticks y se quedó en cero cuando 1C reescribió el módulo: un chequeo que
 * deja de encontrar lo que busca pasa en verde sin verificar nada.
 *
 * Que el productor declare su dominio es exactamente la forma correcta de atar
 * productor y consumidor, que es la clase de B-88.
 */
const formasDeVersionQueProduceElBuild = (): string[] => versionesPosibles();


const versionSegunLaAnalitica = (v: string) =>
  construirEventoAnalitica('panel_abierto', { version: v })!.params.version;

describe('clase de B-88 · el consumidor acepta todo lo que el productor produce', () => {
  it('las formas se extraen del build y no quedó ningún hueco sin sustituir', () => {
    const formas = formasDeVersionQueProduceElBuild();
    // Tres hoy: limpio, árbol sucio y clone sin `.git`.
    expect(formas.length).toBeGreaterThanOrEqual(3);
    // Si `version.mjs` estrena un `${...}` que acá no está mapeado, esto falla
    // antes de que el chequeo de abajo dé un falso verde sobre un literal.
    for (const forma of formas) expect(forma, forma).not.toContain('${');
  });

  /**
   * **Qué lo haría pasar:** ampliar `FORMATO_VERSION` en
   * `src/lib/analytics-eventos.ts` a las formas que el build produce de verdad
   * (el guion y el largo del sello), sin abrirlo a texto libre.
   */
  it('B-88: la analítica reconoce las tres formas de versión del build', () => {
    const rechazadas = formasDeVersionQueProduceElBuild().filter(
      (v) => versionSegunLaAnalitica(v) !== v,
    );
    expect(rechazadas).toEqual([]);
  });

  /**
   * **B-165** — el formato de versión se declara en UN lugar y el resto lo
   * importa.
   *
   * La instancia: `tests/analytics-privacidad.test.ts` tenía su propia copia del
   * regex y la usaba como predicado de admisibilidad. B-88 amplió el formato real
   * y no tocó esa copia, así que quedó estrictamente más angosta que la del
   * código — un consumidor que deriva el formato por su cuenta, o sea la clase de
   * B-88 dentro del test que la vigila.
   *
   * No podía volverse una fuga (al ser más angosta solo podía dar falsa alarma),
   * y por eso se pudo dejar abierta un rato. Lo que no se puede dejar abierto es
   * que vuelva: una declaración nueva del mismo nombre en cualquier archivo pasa
   * desapercibida, porque el test sigue verde con el regex viejo.
   *
   * Se cuenta sobre el repo entero y no sobre una lista de archivos: la copia
   * puede nacer en cualquier lado.
   */
  it('FORMATO_VERSION se declara una sola vez en todo el repo', () => {
    /*
     * Con `grep -r` sobre el disco y no con `git grep`: éste último solo mira el
     * índice, así que un archivo nuevo sin agregar —el estado de una copia recién
     * escrita— no lo ve. El guarda daría verde justo cuando tiene que hablar.
     */
    const declaraciones = execFileSync(
      'grep',
      [
        '-rnE',
        '--exclude-dir=node_modules',
        '(const|export const|let) FORMATO_VERSION',
        'src',
        'tests',
        'scripts',
        'functions',
      ],
      { cwd: fileURLToPath(raiz), encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);

    // Una, y es la del productor. El mensaje nombra las copias que aparezcan.
    expect(declaraciones.join('\n')).toBe(
      declaraciones.find((l) => l.startsWith('src/lib/analytics-eventos.ts:')) ?? '',
    );
  });

  /**
   * La misma clase, otra instancia — B-190 / D-231. `'a-confirmar'` (la
   * plataforma "todavía no se decidió") se comparaba a mano en
   * `detallePublico.ts` y `textoRedes.ts`, y el `auditor-privacidad` encontró
   * que un tercer consumidor (`tarjetaPublica.ts`) directamente se había
   * quedado afuera — el productor no tenía dueño, así que la lista de
   * consumidores se enumeraba de memoria. Ahora `SLUG_PLATAFORMA_A_CONFIRMAR`
   * vive en `lib/modalidades.ts` y los tres importan de ahí.
   */
  it('B-190 — el slug «a confirmar» no se copia a mano en otro archivo de producción', () => {
    const declaraciones = execFileSync(
      'grep',
      ['-rn', "'a-confirmar'", 'src/lib', 'src/components', 'src/pages', 'functions'],
      { cwd: fileURLToPath(raiz), encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);

    const copias = declaraciones.filter((l) => !l.startsWith('src/lib/modalidades.ts:'));
    expect(copias, 'una copia a mano se desincroniza en silencio si el slug cambia').toEqual([]);
  });

  /**
   * B-906 — el schema de una fila de la galería llegó a estar escrito **cinco**
   * veces (la actividad y las cuatro fichas de la Guía), porque el de
   * `schema.ts` era privado y cada ficha nueva copiaba la anterior. Un campo
   * nuevo de `Imagen` entraba en una y no en las otras, y lo único que las
   * sostenía era que todas tipaban a `Imagen`.
   *
   * Lo que delata una copia es validar el prefijo `img_`: sin eso no es un
   * schema de imagen. Se busca en todo `src/` y no solo en los `*-schema.ts`,
   * porque la sexta copia la va a escribir quien no sabía que existía el
   * módulo, y ese no respeta el nombre.
   *
   * `imagen-schema.ts` depende solo de `zod` a propósito: lo importan los
   * formularios públicos de «sumá una ficha», y si arrastrara `schema.ts` el
   * sitio cargaría el schema entero de la actividad.
   */
  it('B-906 — el schema de la imagen se escribe una sola vez, y no arrastra nada', () => {
    const conPrefijo = execFileSync('grep', ['-rln', String.raw`\^img_`, 'src'], {
      cwd: fileURLToPath(raiz),
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);
    expect(conPrefijo, 'importá imagenSchema de @/lib/imagen-schema en vez de copiarlo').toEqual([
      'src/lib/imagen-schema.ts',
    ]);

    const modulo = sinComentarios(fuente('src/lib/imagen-schema.ts'));
    const imports = [...modulo.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    expect(imports, 'imagen-schema.ts lo importa el bundle público: solo zod').toEqual(['zod']);

    // Control positivo: las cinco entidades con galería lo usan de verdad.
    for (const archivo of [
      'src/lib/schema.ts',
      'src/lib/libreria-schema.ts',
      'src/lib/suscripcion-literaria-schema.ts',
      'src/lib/lugar-schema.ts',
      'src/lib/biblioteca-schema.ts',
    ]) {
      expect(fuente(archivo), archivo).toContain("from '@/lib/imagen-schema'");
    }
  });

  /**
   * El otro lado de la clase, ya resuelto y con guarda: el panel no
   * reimplementa la descripción del evento, importa la del sync por el alias
   * `@calendario` (D-20). Si alguien vuelve a copiarla, las dos versiones se
   * separan y el panel promete algo distinto de lo que se publica.
   */
  it('la vista previa del panel consume el módulo del sync, no una copia', () => {
    const src = fuente('src/lib/vistaPreviaEvento.ts');
    expect(src).toMatch(/from '@calendario'/);
    expect(src).not.toMatch(/timeZone:\s*'America/);
  });

  /**
   * La tercera instancia de la misma clase, y la que produjo B-84: el número
   * del encuentro ("Encuentro 2 de 8") sale en dos pantallas —la descripción
   * del evento público y el "2 de 8" de la vista calendario del panel— y cada
   * lado lo **calculaba por su cuenta**. Coincidían porque los dos habían
   * llegado al mismo criterio, no porque fuera el mismo código: el día que uno
   * cambió, el panel dijo "6 de 8" y el evento "5 de 7" para el mismo
   * encuentro, y nada falló.
   *
   * Desde B-163 la cuenta es `numeroDeEncuentro` de `@calendario` y el panel la
   * importa. Este chequeo es lo que impide que vuelva a copiarse: se lee del
   * fuente porque una copia que hoy da el mismo resultado no rompe ningún test
   * de comportamiento — es justamente el modo de falla de la clase.
   */
  /**
   * La cuarta instancia, y la encontró el `auditor-trampas` sobre el mismo
   * commit que arregló la tercera: al compartir la aritmética del número de
   * encuentro se introdujo `milisDe`, que era letra por letra la `milis` que
   * `rebuild.js` ya tenía —salvo el respaldo—. Dos conversiones de fecha que hoy
   * dan lo mismo: el día que alguien extienda una (un formato nuevo, un
   * `toDate()` en vez de `toMillis`), el orden de las sesiones y el contador de
   * reintentos del rebuild (D-23) divergen y nada falla.
   *
   * Quedó una sola, exportada de `calendario.js` —el archivo que ya comparte el
   * panel— e importada por `rebuild.js`. Se lee del fuente por el mismo motivo
   * que el chequeo de abajo: una copia que da el mismo resultado no rompe
   * ningún test de comportamiento.
   */
  it('la conversión de fechas de functions vive en un solo lugar (D-20)', () => {
    const rebuild = fuente('functions/rebuild.js');
    expect(rebuild).toMatch(/import \{ milisDe \} from '\.\/calendario\.js';/);
    // La copia, en cualquiera de las dos formas en que estaba escrita.
    expect(rebuild).not.toMatch(/typeof t\.toMillis === 'function'/);
    expect(rebuild).not.toMatch(/t instanceof Date/);

    // Y sigue habiendo exactamente una definición en todo `functions/`.
    const definiciones = ARCHIVOS_FUNCTIONS.filter((f) =>
      /typeof t\?*\.toMillis === 'function'/.test(fuente(f)),
    );
    expect(definiciones).toEqual(['functions/calendario.js']);
  });

  /**
   * **La lista de taxonomías de `functions/` está atada a la del modelo** — el
   * test que el docblock de `functions/etiquetas.js` prometía desde D-20 y que
   * no existía. Lo destapó B-830, que agregó la sexta taxonomía y dejó al
   * comentario afirmando algo falso («esta lista es una copia») sin que nada
   * fallara.
   *
   * `functions/` no puede importar de `src/` (D-20), así que la lista está
   * escrita dos veces y las dos pueden divergir en dos direcciones distintas, con
   * dos daños distintos:
   *
   * - **un campo de más** en la lista de la Function → `db.getAll` lee un
   *   documento de `/opciones/*` que no es de ninguna taxonomía, y las etiquetas
   *   de ese campo salen vacías: la descripción del evento publicaría el slug
   *   crudo («a-la-gorra»), que es justo lo que `cargarLabels` existe para evitar;
   * - **un campo de menos** → el evento no puede resolver esa etiqueta. Puede ser
   *   correcto (`incluye-actividad` no sale al evento) o un olvido, y la
   *   diferencia no se ve: las dos se leen igual desde acá.
   *
   * Por eso no se exige que las listas sean **iguales** sino que la de la Function
   * sea un **subconjunto**, y que lo que falte esté nombrado en
   * `TAXONOMIAS_FUERA_DEL_EVENTO` con su motivo. Así la próxima taxonomía obliga a
   * decidir en vez de entrar —o quedar afuera— sola.
   */
  it('las taxonomías de `functions/` son un subconjunto declarado del modelo (D-20, B-830)', async () => {
    const { CAMPOS_TAXONOMIA: enLaFunction, TAXONOMIAS_FUERA_DEL_EVENTO: fuera } = await import(
      '../../functions/etiquetas.js'
    );

    // Control positivo: dos listas vacías satisfarían todo lo de abajo.
    expect(enLaFunction.length).toBeGreaterThan(3);
    expect(CAMPOS_TAXONOMIA.length).toBeGreaterThan(enLaFunction.length - 1);

    const delModelo = new Set<string>(CAMPOS_TAXONOMIA);
    expect(
      enLaFunction.filter((c: string) => !delModelo.has(c)),
      'la Function pediría un documento de `/opciones/*` que no es de ninguna taxonomía: ' +
        'sus etiquetas saldrían vacías y el evento publicaría el slug crudo',
    ).toEqual([]);

    const cubiertas = new Set<string>([...enLaFunction, ...fuera]);
    expect(
      CAMPOS_TAXONOMIA.filter((c) => !cubiertas.has(c)),
      'una taxonomía del modelo que la Function no pide y que nadie declaró como ' +
        'ausente a propósito: si sale al evento, va a publicar el slug crudo; si no ' +
        'sale, decilo en `TAXONOMIAS_FUERA_DEL_EVENTO`',
    ).toEqual([]);

    // Y las ausencias declaradas tienen que ser de verdad ausencias.
    expect(fuera.filter((c: string) => enLaFunction.includes(c))).toEqual([]);
  });

  it('el número del encuentro se cuenta en un solo lugar (B-163, D-20)', () => {
    const src = fuente('src/lib/calendarioPanel.ts');
    expect(src).toMatch(/numeroDeEncuentro[^\n]*from '@calendario'|from '@calendario'/);
    expect(src).toMatch(/numeroDeEncuentro\(/);
    // La aritmética copiada: contar el largo de la lista ordenada, o numerar
    // con el índice del recorrido, es la forma que tenía antes de B-163.
    expect(src).not.toMatch(/total:\s*ordenadas\.length/);
    expect(src).not.toMatch(/indice:\s*i \+ 1/);
  });

  /**
   * Los cuatro pares de prefijo de id del modelo: quien **produce** el id de una
   * fila y quien lo **valida** en el schema derivan cada uno por su cuenta.
   *
   * Es la clase, con cuatro instancias: `ses_`, `img_`, `mod_` y `mat_`
   * (B-342 — lo encontró el `auditor-privacidad`: el cuarto par nació sin
   * entrar a esta lista, exactamente el hueco que el párrafo de abajo
   * anticipaba). El día que un productor cambie de prefijo, el schema rechaza
   * toda fila nueva y el guardado falla por un campo que nadie tocó; el día
   * que se agregue una quinta lista sin su regla, el id deja de verificarse y
   * vuelve la trampa 2 por la puerta de atrás. Se lee del fuente porque el
   * prefijo está en un template literal del productor y en un regex del
   * validador: no hay valor que comparar.
   *
   * Se pide para los cuatro a la vez y no solo para el nuevo: una lista que
   * nombra uno solo no protege a los demás, y agregarlos cuesta una línea.
   */
  it('cada lista con ids de cliente tiene su prefijo validado en el schema', () => {
    // B-906: el schema de la imagen vive en su propio módulo, que `schema.ts`
    // importa; los dos fuentes juntos son «el schema» de la actividad.
    const schema = fuente('src/lib/schema.ts') + fuente('src/lib/imagen-schema.ts');
    const productores: [string, string][] = [
      ['ses_', 'src/lib/sesiones.ts'],
      ['img_', 'src/lib/imagenes.ts'],
      ['mod_', 'src/lib/modalidades.ts'],
      ['mat_', 'src/lib/material.ts'],
    ];
    for (const [prefijo, archivo] of productores) {
      expect(fuente(archivo), `${archivo} ya no produce ids \`${prefijo}\``).toContain(
        `\`${prefijo}`,
      );
      expect(schema, `el schema no valida el prefijo \`${prefijo}\``).toContain(
        `/^${prefijo}/`,
      );
    }
  });

  /**
   * B-364 — el tope de largo del título de un reporte está dicho en tres
   * lugares (`firestore.rules`, `reporte-schema.ts`, el `maxLength` del input
   * de `ReporteFormulario.tsx`), y ninguno referenciaba a otro. No filtraba
   * nada hoy —el recorte de las reglas solo puede partir un placeholder, y
   * desde B-362 el orden garantiza que lo partido no sea un link— pero el día
   * que el tope de las reglas suba a 300, el resto no se enteraría.
   *
   * `TOPE_TITULO_REPORTE` (`src/types/reporte.ts`) es la fuente para los dos
   * lados que pueden importarlo. `firestore.rules` es un runtime aparte y no
   * puede: ese lado se ata leyendo el número de la regla y comparándolo. Los
   * otros dos topes del ítem —el `.slice(0, 200)` de `functions/reportes.js`
   * (el margen que el saneador necesita para expandir) y el 256 de GitHub—
   * son otra cosa y no se atan acá: atarlos sería falso.
   */
  it('B-364: los tres topes de 120 del título de un reporte son el mismo límite', () => {
    const schema = fuente('src/lib/reporte-schema.ts');
    const formulario = fuente('src/components/admin/ReporteFormulario.tsx');
    const reglas = fuente('firestore.rules');

    expect(schema, 'el schema volvió a escribir 120 a mano').toMatch(
      /\.max\(TOPE_TITULO_REPORTE,/,
    );
    expect(formulario, 'el input volvió a escribir 120 a mano').toMatch(
      /maxLength=\{TOPE_TITULO_REPORTE\}/,
    );

    const m = /d\.titulo\.size\(\)\s*<=\s*(\d+)/.exec(reglas);
    if (!m) throw new Error('no se encontró el tope de `d.titulo.size()` en firestore.rules');
    expect(
      Number(m[1]),
      'firestore.rules dejó de decir el mismo número que TOPE_TITULO_REPORTE',
    ).toBe(TOPE_TITULO_REPORTE);
  });
});
