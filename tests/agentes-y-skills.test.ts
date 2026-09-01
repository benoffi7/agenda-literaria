/**
 * Los agentes y skills de `.claude/` — B-139, cierra B-120.
 *
 * Clase de bug: **una definición que no carga y nadie se entera.** Un `": "`
 * dentro de un valor de YAML sin comillas hace inválido el frontmatter, y
 * entonces el archivo entero se ignora **sin ningún error visible**: el auditor
 * no corre, nadie lo nota, y el cambio se cierra creyendo que se auditó. Ya
 * pasó en este repo con las tres descripciones a la vez.
 *
 * El chequeo era, hasta ahora, "acordate de parsearlo a mano con Ruby". Esto lo
 * hace el CI.
 *
 * No se usa una librería de YAML a propósito: no hay ninguna instalada y el
 * frontmatter de estos archivos es plano (`clave: valor` de una línea). Lo que
 * se verifica es exactamente el modo de falla conocido, no el YAML completo.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const raiz = new URL('..', import.meta.url);
const fuente = (relativo: string) =>
  readFileSync(fileURLToPath(new URL(relativo, raiz)), 'utf8');

const versionados = (): string[] =>
  execFileSync('git', ['ls-files', '-z', '.claude'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);

const AGENTES = versionados().filter((f) => /^\.claude\/agents\/[^/]+\.md$/.test(f));
const SKILLS = versionados().filter((f) => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(f));

type Frontmatter = { claves: Record<string, string>; errores: string[] };

/**
 * Frontmatter del archivo, con los errores que lo harían inválido.
 *
 * Lo que se mira es lo que rompe de verdad: los delimitadores, y un valor sin
 * comillas que contenga `: ` (para YAML eso es un mapa anidado mal formado).
 */
const frontmatter = (src: string): Frontmatter => {
  const errores: string[] = [];
  const claves: Record<string, string> = {};

  if (!src.startsWith('---\n')) {
    errores.push('no arranca con el delimitador `---`');
    return { claves, errores };
  }
  const cierre = src.indexOf('\n---\n', 3);
  if (cierre === -1) {
    errores.push('el frontmatter no se cierra con `---`');
    return { claves, errores };
  }

  for (const linea of src.slice(4, cierre + 1).split('\n')) {
    if (!linea.trim()) continue;
    const m = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(linea);
    if (!m) {
      errores.push(`línea que no es \`clave: valor\`: ${JSON.stringify(linea)}`);
      continue;
    }
    const [, clave, valor] = m as unknown as [string, string, string];
    const entrecomillado = /^['"]/.test(valor.trim());
    if (!entrecomillado && valor.includes(': ')) {
      // EL modo de falla. Sin comillas, el `": "` convierte el valor en un mapa
      // y el archivo entero deja de cargar.
      errores.push(`\`${clave}\` tiene un ": " sin comillas — el YAML es inválido`);
    }
    claves[clave] = valor.trim();
  }

  return { claves, errores };
};

describe('las definiciones de .claude/ cargan de verdad — B-139', () => {
  it('hay agentes y skills, y el descubrimiento los ve', () => {
    // Si esto queda en cero, todo lo de abajo pasaría sin mirar nada.
    expect(AGENTES.length).toBeGreaterThanOrEqual(3);
    expect(SKILLS.length).toBeGreaterThanOrEqual(4);
  });

  it('todos los frontmatter son válidos', () => {
    const malos: string[] = [];
    for (const archivo of [...AGENTES, ...SKILLS]) {
      const { errores } = frontmatter(fuente(archivo));
      for (const e of errores) malos.push(`${archivo}: ${e}`);
    }
    expect(malos).toEqual([]);
  });

  it('el `name` coincide con el nombre del archivo (agentes) o de la carpeta (skills)', () => {
    const desalineados: string[] = [];
    for (const archivo of AGENTES) {
      const esperado = archivo.replace(/^.*\//, '').replace(/\.md$/, '');
      const { claves } = frontmatter(fuente(archivo));
      if (claves.name !== esperado) desalineados.push(`${archivo}: name=${claves.name}`);
    }
    for (const archivo of SKILLS) {
      const esperado = archivo.split('/')[2];
      const { claves } = frontmatter(fuente(archivo));
      if (claves.name !== esperado) desalineados.push(`${archivo}: name=${claves.name}`);
    }
    expect(desalineados).toEqual([]);
  });

  it('cada definición tiene `description`, que es lo que Claude lee para elegirla', () => {
    const sinDescripcion = [...AGENTES, ...SKILLS].filter(
      (a) => (frontmatter(fuente(a)).claves.description ?? '').length < 40,
    );
    expect(sinDescripcion).toEqual([]);
  });

  it('un skill suelto no se carga, así que no hay ninguno', () => {
    // `.claude/skills/<name>.md` (sin carpeta) es ignorado por Claude Code.
    expect(versionados().filter((f) => /^\.claude\/skills\/[^/]+\.md$/.test(f))).toEqual([]);
  });

  it('los auditores son de solo lectura: sin Write ni Edit en `tools`', () => {
    const conEscritura: string[] = [];
    for (const archivo of AGENTES) {
      const { claves } = frontmatter(fuente(archivo));
      const tools = (claves.tools ?? '').split(',').map((t) => t.trim());
      // Sin `tools` hereda TODAS las herramientas, incluida Write: para un
      // agente que "reporta y no arregla" eso es la allowlist vacía al revés.
      if (tools.filter(Boolean).length === 0) conEscritura.push(`${archivo}: sin allowlist`);
      if (tools.includes('Write') || tools.includes('Edit')) {
        conEscritura.push(`${archivo}: puede escribir`);
      }
    }
    expect(conEscritura).toEqual([]);
  });
});

describe('docs/13-agentes.md dice lo que hay — cierra B-120', () => {
  const doc = fuente('docs/13-agentes.md');

  it('nombra todos los agentes y skills que existen', () => {
    // Entre backticks y no como substring: `automatizar` aparece en la prosa
    // ("qué se decidió no automatizar") y eso no es nombrar al skill.
    const nombres = [...AGENTES, ...SKILLS].map((a) => frontmatter(fuente(a)).claves.name!);
    expect(nombres.filter((n) => !doc.includes(`\`${n}\``))).toEqual([]);
  });

  it('no nombra agentes ni skills que ya no existen', () => {
    // El drift al revés: la doc promete un auditor que alguien borró.
    const existentes = new Set(
      [...AGENTES, ...SKILLS].map((a) => frontmatter(fuente(a)).claves.name!),
    );
    const prometidos = [...doc.matchAll(/`(auditor-[a-z-]+)`/g)].map((m) => m[1]!);
    expect([...new Set(prometidos)].filter((n) => !existentes.has(n))).toEqual([]);
  });
});

/**
 * La cuenta de salidas públicas, atada entre sus tres lugares — B-216.
 *
 * `src/lib/textoRedes.ts` (B-95) fue una salida pública desde que existió, y la
 * ficha del `auditor-privacidad` listaba **cuatro**. Ningún test podía fallar: el
 * módulo está bien cubierto por los suyos. Lo que estaba roto era la cadena de
 * invocación — el `description` del agente no nombraba el archivo, así que un
 * cambio que interpolara un campo nuevo en el posteo no lo despertaba, y si
 * alguien lo corría igual, el índice que usa para orientarse no incluía la salida
 * que debía mirar.
 *
 * Es la clase de B-88 aplicada a dos documentos: un productor y un consumidor que
 * derivan la misma lista por separado. Así que se ata acá, y de las tres formas
 * en que puede divergir:
 *
 * 1. las dos tablas tienen que enumerar las mismas salidas,
 * 2. cada archivo productor tiene que estar nombrado en el `description` (que es
 *    lo que decide si el agente se invoca solo),
 * 3. y el archivo productor tiene que existir.
 *
 * Lo que este test NO puede ver: que una salida **nueva** entre a las tablas. Eso
 * sigue siendo criterio, y es el punto 7 de "Cómo auditás" del propio agente.
 */
describe('la cuenta de salidas públicas no puede divergir — B-216', () => {
  const FICHA = '.claude/agents/auditor-privacidad.md';
  const SEGURIDAD = 'docs/07-seguridad.md';

  /**
   * Las filas numeradas de la primera tabla del documento, con el archivo
   * productor de la última columna con contenido. Se corta en la primera línea
   * que no es fila: así una segunda tabla numerada más abajo no se mezcla.
   */
  const salidas = (relativo: string): { n: string; archivo: string; funciones: string[] }[] => {
    const filas: { n: string; archivo: string; funciones: string[] }[] = [];
    let empezo = false;
    for (const linea of fuente(relativo).split('\n')) {
      // El `\s*` inicial es por el skill `campo-nuevo`, donde la tabla va sangrada
      // adentro de un ítem de lista. En los otros dos archivos no cambia nada.
      const m = /^\s*\|\s*(\d)\s*\|(.+)$/.exec(linea);
      if (!m) {
        if (empezo) break;
        continue;
      }
      empezo = true;
      const celdas = m[2]!.split('|').map((c) => c.trim());
      const enBackticks = celdas.flatMap((c) => [...c.matchAll(/`([^`]+)`/g)].map((x) => x[1]!));
      // La celda del productor es la primera que nombra un archivo del repo.
      const archivo = enBackticks.find((x) => /^(?:src|functions)\//.test(x));
      /*
       * Y **las funciones que esa fila nombra**, que es la parte que la primera
       * versión de este chequeo no miraba — ver el `it` de abajo.
       */
      const funciones = enBackticks.filter((x) => /^[a-z][A-Za-z0-9]*$/.test(x));
      filas.push({ n: m[1]!, archivo: archivo ?? '(ninguno)', funciones });
    }
    return filas;
  };

  it('el barrido encuentra las dos tablas', () => {
    // Control positivo: si el parseo se rompiera, las comparaciones de abajo
    // pasarían comparando dos listas vacías entre sí.
    expect(salidas(FICHA).length).toBeGreaterThanOrEqual(4);
    expect(salidas(SEGURIDAD).length).toBeGreaterThanOrEqual(4);
    expect(salidas(FICHA).every((s) => s.archivo !== '(ninguno)')).toBe(true);
    // Y que el extractor de funciones encuentre algo: si devolviera siempre
    // vacío, el `it` de abajo compararía dos listas vacías fila por fila.
    expect(salidas(FICHA).some((s) => s.funciones.length > 0)).toBe(true);
  });

  it('la ficha conoce toda función productora que nombra el documento de seguridad', () => {
    /*
     * B-212 puso una **segunda** función productora en la salida 1
     * (`opcionesPublicas`, para `/opciones/*`), se la agregó a
     * `docs/07-seguridad.md` y **la ficha del agente se quedó atrás**. El `it`
     * de arriba no lo vio: comparaba solo el primer path del repo de cada fila,
     * y las dos filas 1 colapsaban a `src/lib/toPublic.ts`, iguales.
     *
     * O sea: es el modo de falla que este describe vino a cerrar, un nivel más
     * adentro — el índice envejeció y el test que lo ataba miraba el archivo, no
     * qué de ese archivo produce la salida. Lo encontró el `auditor-privacidad`
     * sobre el mismo cambio que lo introdujo.
     *
     * ── Por qué es direccional y no una igualdad ──────────────────────────
     * La primera versión comparaba los dos conjuntos y saltaba con cuatro
     * desalineaciones legítimas: la ficha nombra `construirDescripcion`,
     * `construirUbicacion`, `redactar`… y el documento de seguridad no, porque
     * son documentos con distinto nivel de detalle. La ficha **es** el índice
     * detallado; puede saber más.
     *
     * Lo que no puede pasar es lo contrario: que el documento de seguridad
     * nombre un productor que la ficha no conoce. Ahí el agente audita con un
     * índice incompleto, que es exactamente lo que pasó con `opcionesPublicas`.
     */
    const deFicha = salidas(FICHA);
    const faltantes: string[] = [];

    for (const fila of salidas(SEGURIDAD)) {
      const enFicha = deFicha.find((s) => s.n === fila.n);
      if (!enFicha) continue; // la comparación de filas la hace el `it` de arriba
      for (const f of fila.funciones) {
        if (!enFicha.funciones.includes(f)) faltantes.push(`salida ${fila.n}: ${f}`);
      }
    }

    expect(
      faltantes,
      'la ficha del auditor no conoce un productor que 07-seguridad.md sí nombra',
    ).toEqual([]);
  });

  it('las dos tablas enumeran las mismas salidas, y en el mismo orden', () => {
    expect(salidas(SEGURIDAD).map((s) => `${s.n} ${s.archivo}`)).toEqual(
      salidas(FICHA).map((s) => `${s.n} ${s.archivo}`),
    );
  });

  it('y el skill `campo-nuevo` enumera las mismas — B-265', () => {
    /*
     * **Son tres lugares y este chequeo ataba dos.** Lo encontró el
     * `auditor-privacidad` sobre B-265: la tabla de `07-seguridad.md` y la ficha
     * del agente pasaron a siete salidas, y `.claude/skills/campo-nuevo/SKILL.md`
     * —que es **el** lugar donde alguien decide si un campo nuevo es público—
     * se quedó en seis. El skill tiene escrito «si agregás una salida, se agrega
     * acá en el mismo cambio», y eso es exactamente lo que un test tiene que
     * sostener en vez de pedirlo.
     *
     * Es la repetición de B-244, cuando la lista decía cuatro y faltaban el
     * posteo y la página indexada. La diferencia es el modo de falla: acá no se
     * filtra nada hoy, se rompe **el mecanismo que impide filtrar mañana** —el
     * campo nuevo se decide contra seis celdas y nadie decide la séptima.
     *
     * Se comparan los **números** y no los archivos: el skill nombra un solo
     * productor por fila a propósito (es un checklist, no un índice), así que
     * exigir la misma celda de archivo lo obligaría a repetir los cuatro de la
     * salida 1.
     *
     * MUTACIÓN PROBADA: sacar la fila 7 de la tabla del skill deja los otros dos
     * `it` de este describe en verde y este en rojo.
     */
    const SKILL = '.claude/skills/campo-nuevo/SKILL.md';
    const numeros = (rel: string) => salidas(rel).map((s) => s.n);
    expect(numeros(SKILL).length, 'no se parseó la tabla del skill').toBeGreaterThanOrEqual(4);
    expect(
      numeros(SKILL),
      'el skill `campo-nuevo` no enumera las mismas salidas que 07-seguridad.md: quien ' +
        'agregue un campo va a decidir una celda de menos, y el default de no decidir es ' +
        'publicar (§5.1)',
    ).toEqual(numeros(SEGURIDAD));
  });

  it('el description del agente nombra todos los archivos productores', () => {
    // Es el punto que hace que el agente se invoque solo. Sin esto, la tabla
    // puede estar perfecta y el agente no despertarse nunca.
    const { claves } = frontmatter(fuente(FICHA));
    const sinNombrar = salidas(FICHA)
      .map((s) => s.archivo)
      .filter((archivo) => !(claves.description ?? '').includes(archivo));
    expect(sinNombrar, 'productores ausentes del description').toEqual([]);
  });

  it('todos los archivos productores existen', () => {
    // `versionados()` de arriba lista solo `.claude/`, así que acá se mira el
    // disco: los productores viven en `src/` y en `functions/`.
    const inexistentes = salidas(FICHA)
      .map((s) => s.archivo)
      .filter((archivo) => !existsSync(fileURLToPath(new URL(archivo, raiz))));
    expect(inexistentes).toEqual([]);
  });

  it('y también los tests que la tabla nombra — B-260', () => {
    /*
     * **La otra columna, que no se miraba.** El chequeo de arriba verifica los
     * productores (`src/`, `functions/`) y dejaba pasar los **tests**: B-260
     * renombró `tests/tarjeta-del-listado.test.ts` a
     * `tests/listado-del-sitio.test.ts` y dejó **ocho** referencias muertas
     * repartidas entre `docs/` y `.claude/` — el índice apuntando a un archivo que
     * no existe.
     *
     * No se perdió cobertura: el test nuevo conserva la garantía. Se perdió **el
     * índice**, que es exactamente el modo de falla que este archivo existe para
     * frenar — quien busque «quién verifica esto» encuentra un archivo que no está
     * y concluye que no lo verifica nadie. Lo encontró el `auditor-privacidad`.
     *
     * MUTACIÓN PROBADA: volver a poner `tests/tarjeta-del-listado.test.ts` en la
     * ficha hace fallar este caso.
     */
    const nombrados = [...fuente(FICHA).matchAll(/`(tests\/[\w.-]+\.ts)`/g)].map((m) => m[1]!);
    // Control positivo: la ficha nombra tests de verdad, y si el regex dejara de
    // encontrarlos la lista de inexistentes saldría vacía sin haber mirado nada.
    expect(nombrados.length).toBeGreaterThan(5);

    const inexistentes = [...new Set(nombrados)].filter(
      (t) => !existsSync(fileURLToPath(new URL(t, raiz))),
    );
    expect(
      inexistentes,
      'la ficha nombra tests que no existen: el índice apunta a un archivo ' +
        'borrado o renombrado, y quien lo consulte va a concluir que esa salida ' +
        'no la verifica nadie.',
    ).toEqual([]);
  });
});
