/**
 * El mapa trampa → test → archivo — B-119.
 *
 * `docs/15-mapa-de-trampas.md` dice qué test cubre cada una de las diez trampas
 * del `CLAUDE.md` §13. Un documento así, sin nada que lo verifique, envejece
 * peor que el `grep` que vino a reemplazar: el `grep` al menos mira el repo de
 * hoy. Esto lo verifica contra el repo en cada corrida.
 *
 * ── Lo que se afirma ───────────────────────────────────────────────────────
 * La lista de trampas **se lee del §13**, no se enumera acá: una trampa nueva en
 * el `CLAUDE.md` rompe el test hasta que entre al mapa. Y la lista de trampas
 * descubiertas **se calcula del repo** y se compara contra la que el documento
 * declara, en las dos direcciones: una trampa no puede perder su red sin que el
 * documento lo diga, ni el documento puede declarar sin red algo que sí la
 * tiene.
 *
 * Todo esto se apoya en una convención: **el test que cubre una trampa la nombra
 * `trampa N`**. Está escrita en el documento y este archivo la hace cumplir.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ruta = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const fuente = (rel: string): string => readFileSync(ruta(rel), 'utf8');

const MAPA = 'docs/15-mapa-de-trampas.md';

/** Los números de trampa del §13 del `CLAUDE.md`, leídos de ahí y no copiados. */
const TRAMPAS_DEL_CLAUDE_MD: number[] = (() => {
  const md = fuente('CLAUDE.md');
  const desde = md.indexOf('## 13. Trampas conocidas');
  const hasta = md.indexOf('\n## ', desde + 1);
  const seccion = md.slice(desde, hasta === -1 ? md.length : hasta);
  return [...seccion.matchAll(/^(\d+)\.\s+\*\*/gm)].map((m) => Number(m[1]));
})();

type Fila = { numero: number; archivos: string[]; tests: string[]; sinRed: boolean };

/** Las filas de la tabla del mapa. */
const FILAS: Fila[] = (() => {
  const enBackticks = (celda: string) => [...celda.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
  const filas: Fila[] = [];
  for (const linea of fuente(MAPA).split('\n')) {
    const celdas = linea.split('|').map((c) => c.trim());
    // `| 1 | ... | ... | ... |` → ['', '1', ..., ''].
    if (celdas.length !== 6 || !/^\d+$/.test(celdas[1] ?? '')) continue;
    filas.push({
      numero: Number(celdas[1]),
      archivos: enBackticks(celdas[3]!),
      tests: enBackticks(celdas[4]!),
      sinRed: /sin red/i.test(celdas[4]!),
    });
  }
  return filas;
})();

/** Los archivos de `tests/` versionados, que es el universo donde se busca la red. */
const TESTS_VERSIONADOS = execFileSync('git', ['ls-files', '-z', 'tests'], { encoding: 'utf8' })
  .split('\0')
  .filter((f) => f.endsWith('.ts'));

/** Qué tests nombran cada trampa. Es la convención, aplicada al repo de hoy. */
const testsQueNombran = (numero: number): string[] =>
  TESTS_VERSIONADOS.filter((f) => new RegExp(`trampa ${numero}\\b`, 'i').test(fuente(f)));

describe('el mapa está completo — B-119', () => {
  it('el §13 del CLAUDE.md se leyó y tiene diez trampas numeradas', () => {
    // Si el parseo del §13 se rompiera, el mapa podría estar vacío y todo lo de
    // abajo pasaría por comparar dos listas vacías entre sí.
    expect(TRAMPAS_DEL_CLAUDE_MD.length).toBeGreaterThanOrEqual(10);
    expect(TRAMPAS_DEL_CLAUDE_MD).toEqual(
      Array.from({ length: TRAMPAS_DEL_CLAUDE_MD.length }, (_, i) => i + 1),
    );
  });

  it('el mapa cubre exactamente las trampas del §13', () => {
    // En las dos direcciones: una trampa nueva en el CLAUDE.md que nadie mapeó,
    // y una fila del mapa sobre una trampa que ya no existe.
    expect(FILAS.map((f) => f.numero)).toEqual(TRAMPAS_DEL_CLAUDE_MD);
  });

  it('todos los archivos citados existen', () => {
    const fantasmas = FILAS.flatMap((f) =>
      [...f.archivos, ...f.tests].filter((a) => !existsSync(ruta(a))).map((a) => `${f.numero}: ${a}`),
    );
    expect(fantasmas).toEqual([]);
  });

  it('cada fila dice dónde vive la regla', () => {
    expect(FILAS.filter((f) => f.archivos.length === 0).map((f) => f.numero)).toEqual([]);
  });
});

describe('el mapa dice la verdad sobre la red que hay — B-119', () => {
  it('cada test citado nombra su trampa', () => {
    // La convención que hace posible el `grep` del auditor, hecha cumplir. Si un
    // test se renombra o se parte en dos y pierde la referencia, salta acá —
    // que es exactamente el fallo por el que el auditor reportaba mal.
    const mudos = FILAS.flatMap((f) =>
      f.tests
        .filter((t) => !new RegExp(`trampa ${f.numero}\\b`, 'i').test(fuente(t)))
        .map((t) => `trampa ${f.numero}: ${t} no la nombra`),
    );
    expect(mudos).toEqual([]);
  });

  it('las trampas descubiertas son exactamente las que el mapa declara sin red', () => {
    // El entregable de B-119, y la razón por la que el mapa se verifica en vez
    // de leerse: una trampa no puede quedarse sin red en silencio, y el
    // documento tampoco puede seguir declarando "sin red" algo ya cubierto.
    const calculadas = TRAMPAS_DEL_CLAUDE_MD.filter((n) => testsQueNombran(n).length === 0);
    const declaradas = FILAS.filter((f) => f.sinRed).map((f) => f.numero);
    expect(calculadas, 'trampas sin ningún test que las nombre').toEqual(declaradas);
  });

  it('cada trampa descubierta tiene su ítem de backlog al lado', () => {
    // Sin número de backlog, "sin red" es una queja; con número, es trabajo.
    const seccion = fuente(MAPA).slice(fuente(MAPA).indexOf('## Sin red'));
    for (const f of FILAS.filter((x) => x.sinRed)) {
      const item = new RegExp(`Trampa ${f.numero}\\b[\\s\\S]{0,400}?B-\\d+`).exec(seccion);
      expect(item, `la trampa ${f.numero} no tiene ítem de backlog en "Sin red"`).not.toBeNull();
    }
  });

  it('la mayoría de las trampas tiene red', () => {
    // Control positivo del chequeo de arriba: si `testsQueNombran` dejara de
    // encontrar nada, "las descubiertas son las declaradas" se podría satisfacer
    // declarando las diez, y el mapa quedaría en verde diciendo que no hay red
    // en ninguna parte.
    const conRed = TRAMPAS_DEL_CLAUDE_MD.filter((n) => testsQueNombran(n).length > 0);
    expect(conRed.length).toBeGreaterThanOrEqual(TRAMPAS_DEL_CLAUDE_MD.length - 2);
  });
});
