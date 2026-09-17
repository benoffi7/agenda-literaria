/**
 * Los comandos que los skills y agentes de `.claude/` dicen correr.
 *
 * ── La clase de bug ───────────────────────────────────────────────────────
 * **Un comando de un skill que apunta a algo que ya no está, y que nadie ve
 * fallar porque el que lo corre es un modelo, no el CI.** Un `grep` que no
 * matchea no devuelve error: devuelve vacío. El agente lee «no hay nada», sigue
 * al paso siguiente y toma la decisión contraria a la que el skill quería.
 *
 * Es la misma familia que B-139 —una definición que no carga y nadie se
 * entera— con el daño un paso más adelante: acá la definición carga bien y lo
 * que está roto es lo que dice adentro.
 *
 * ── Por qué existe este archivo, con el caso que lo pagó ──────────────────
 * `ada6be0` partió el backlog en dos (`docs/BACKLOG.md`, lo que falta;
 * `docs/BACKLOG-cerrados.md`, el rastro), y **369 de los 430 ítems se mudaron
 * al segundo**. Dos skills se quedaron mirando el primero:
 *
 * - `al-backlog` buscaba ids duplicados con `grep -n "B-" docs/BACKLOG.md`, o
 *   sea **sin ver el 86% de los ids que ya existen**. El paso se llama
 *   literalmente «¿ya está?» y contestaba que no sobre un archivo que no tiene
 *   la respuesta. Con varios frentes anotando ítems en paralelo, eso es una
 *   colisión de `B-` garantizada — el choque de B-930, otra vez.
 * - `automatizar` buscaba la tabla de causas con
 *   `grep -n -A2 '^## Cerrados' docs/BACKLOG.md`: ese encabezado da **0** ahí y
 *   **1** en el archivo del rastro. Referencia muerta literal.
 *
 * Los dos se arreglaron el 2026-09-17. Este test es para que el tercero se
 * ponga rojo solo.
 *
 * ── Qué verifica, y por qué corre `grep` de verdad ────────────────────────
 * Se extraen los `grep` de los bloques ```bash de cada definición y **se
 * ejecutan**. No se traduce el patrón a una `RegExp` de JS a propósito: las
 * dialectos no coinciden (BRE, ERE con `-E`, `\b`…), y un chequeo que aproxima
 * el patrón verifica su propia traducción y no el comando. Lo que importa es
 * exactamente la pregunta que el skill hace.
 *
 * Un `grep` que devuelve vacío es rojo. Lo que **no** se verifica es que el
 * resultado sea el correcto: eso es criterio y no entra en un test.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { archivosDelRepo } from './fixtures/archivos-del-repo';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const fuente = (relativo: string) => readFileSync(`${raiz}${relativo}`, 'utf8');

const DEFINICIONES = archivosDelRepo('.claude').filter((f) =>
  /^\.claude\/(agents\/[^/]+|skills\/[^/]+\/SKILL)\.md$/.test(f),
);

/**
 * Comandos que **tienen que poder no encontrar nada**, con el motivo.
 *
 * Son los que buscan una anomalía: encontrarla es la excepción, no la regla, y
 * exigirles resultado sería exigir que el repo esté roto. Se listan por el
 * patrón exacto para que agregar uno sea una decisión y no un descuido.
 */
const PUEDEN_NO_ENCONTRAR = new Map<string, string>([
  ["run:", 'busca pasos duplicados entre workflows: vacío es el estado sano'],
]);

/** Los `grep` de los bloques ```bash, sin lo que venga después de un pipe. */
const grepsDe = (src: string): string[] => {
  const bloques = [...src.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
  return bloques
    .flatMap((b) => b.split('\n'))
    .map((l) => l.trim())
    .filter((l) => l.startsWith('grep '))
    .map((l) => l.split('|')[0].trim());
};

/** `grep -rn 'x' a b` → `['-rn', 'x', 'a', 'b']`, respetando las comillas. */
const argumentosDe = (comando: string): string[] =>
  [...comando.slice('grep '.length).matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map(
    (m) => m[1] ?? m[2] ?? m[3],
  );

describe('los comandos de los skills y agentes de .claude/ — la clase de `ada6be0`', () => {
  const casos = DEFINICIONES.flatMap((archivo) =>
    grepsDe(fuente(archivo)).map((comando) => ({ archivo, comando })),
  );

  it('hay comandos que verificar (si esto baja a cero, el barrido dejó de mirar)', () => {
    expect(casos.length).toBeGreaterThan(0);
  });

  it.each(casos)('$archivo · $comando', ({ comando }) => {
    const args = argumentosDe(comando);
    // `[/]` y no `\/`: un literal que termina en barra escapada deja un `//`
    // literal en el fuente, y el saneador de `sin-comentarios.test.ts` lo lee
    // como el comienzo de un comentario y se come el resto de la línea. Es el
    // control positivo que esa guarda ya tenía escrito (B-876), y lo cobró acá.
    const rutas = args.filter(
      (a) => !a.startsWith('-') && /^(docs|src|tests|scripts|functions|\.github|\.claude)[/]/.test(a),
    );

    // 1 · Las rutas que nombra tienen que existir.
    for (const ruta of rutas) {
      expect(existsSync(`${raiz}${ruta}`), `${comando} apunta a ${ruta}, que no existe`).toBe(true);
    }
    if (rutas.length === 0) return;

    // 2 · Y el patrón tiene que encontrar algo ahí.
    const patron = args.find((a) => !a.startsWith('-') && !rutas.includes(a));
    if (patron !== undefined && PUEDEN_NO_ENCONTRAR.has(patron)) return;

    let salida = '';
    try {
      salida = execFileSync('grep', args, { cwd: raiz, encoding: 'utf8' });
    } catch {
      salida = '';
    }
    expect(
      salida.trim().length,
      `\`${comando}\` no encuentra nada: el skill va a leer vacío y seguir de largo`,
    ).toBeGreaterThan(0);
  });
});

/**
 * La otra mitad, y la más ancha: **las rutas que las definiciones citan.**
 *
 * Un `grep` roto es el caso que pagamos, pero la clase es más grande: una
 * definición nombra archivos del repo en prosa —«mirá `src/lib/toPublic.ts`»,
 * «la tabla de `docs/13-agentes.md`»— y esas citas envejecen igual. La
 * diferencia con un import es que nada las resuelve: el archivo se renombra, la
 * definición sigue mandando al agente a un lugar que no existe, y el agente
 * contesta lo que puede con lo que encuentra.
 *
 * Se miran solo las rutas entre backticks que arrancan con un directorio del
 * repo: alcanza para lo que envejece y no confunde un nombre genérico con una
 * ruta.
 */
describe('las rutas que las definiciones de .claude/ citan siguen existiendo', () => {
  const RUTA = /`((?:docs|src|tests|scripts|functions|\.github|\.claude)\/[A-Za-z0-9_@./+-]+)`/g;

  /**
   * Rutas de mentira, a propósito, con el motivo.
   *
   * `tests/x.test.ts` es el **marcador de ejemplo** de las tres definiciones que
   * explican cómo redactar un hallazgo («"cubierto por `tests/x.test.ts`"»). No
   * nombra un archivo: nombra el lugar donde va un nombre. Si algún día alguien
   * crea ese archivo, la excepción deja de hacer falta y hay que sacarla.
   */
  const MARCADORES = new Set(['tests/x.test.ts']);

  const citas = DEFINICIONES.flatMap((archivo) => {
    const vistas = new Set<string>();
    for (const [, ruta] of fuente(archivo).matchAll(RUTA)) {
      // Los glob y los directorios se verifican por su raíz, no por el patrón.
      if (ruta.includes('*') || ruta.endsWith('/')) continue;
      if (MARCADORES.has(ruta)) continue;
      vistas.add(ruta);
    }
    return [...vistas].map((ruta) => ({ archivo, ruta }));
  });

  it('hay rutas que verificar', () => {
    expect(citas.length).toBeGreaterThan(0);
  });

  it.each(citas)('$archivo cita $ruta', ({ ruta }) => {
    expect(existsSync(`${raiz}${ruta}`), `la cita apunta a ${ruta}, que no existe`).toBe(true);
  });
});
