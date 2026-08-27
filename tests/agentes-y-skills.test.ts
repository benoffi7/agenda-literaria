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
  const salidas = (relativo: string): { n: string; archivo: string }[] => {
    const filas: { n: string; archivo: string }[] = [];
    let empezo = false;
    for (const linea of fuente(relativo).split('\n')) {
      const m = /^\|\s*(\d)\s*\|(.+)$/.exec(linea);
      if (!m) {
        if (empezo) break;
        continue;
      }
      empezo = true;
      const celdas = m[2]!.split('|').map((c) => c.trim());
      // La celda del productor es la primera que nombra un archivo del repo.
      const archivo = celdas
        .flatMap((c) => [...c.matchAll(/`((?:src|functions)\/[\w./-]+)`/g)].map((x) => x[1]!))
        .at(0);
      filas.push({ n: m[1]!, archivo: archivo ?? '(ninguno)' });
    }
    return filas;
  };

  it('el barrido encuentra las dos tablas', () => {
    // Control positivo: si el parseo se rompiera, las comparaciones de abajo
    // pasarían comparando dos listas vacías entre sí.
    expect(salidas(FICHA).length).toBeGreaterThanOrEqual(4);
    expect(salidas(SEGURIDAD).length).toBeGreaterThanOrEqual(4);
    expect(salidas(FICHA).every((s) => s.archivo !== '(ninguno)')).toBe(true);
  });

  it('las dos tablas enumeran las mismas salidas, y en el mismo orden', () => {
    expect(salidas(SEGURIDAD).map((s) => `${s.n} ${s.archivo}`)).toEqual(
      salidas(FICHA).map((s) => `${s.n} ${s.archivo}`),
    );
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
});
