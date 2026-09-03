/**
 * Las referencias `D-nnn` de `docs/` contra las entradas que existen — B-124.
 *
 * **La clase de bug: un enlace roto que no se ve roto.** Un `D-999` linkeado a
 * `06-decisiones.md#d-999` **resuelve igual** —abre el documento, sin ancla y
 * sin error— así que una decisión citada y nunca escrita se lee como que
 * existe. Es la forma exacta en que nació uno de los hallazgos del
 * `auditor-documentacion`.
 *
 * ── Lo que este archivo verifica, y lo que a propósito NO ─────────
 * Verifica **el barrido**: que sepa leer las entradas de los encabezados, que
 * encuentre las referencias, y que no confunda una cosa con la otra. Eso es
 * puro y determinístico.
 *
 * **No** afirma que hoy no haya ninguna referencia huérfana, y eso es una
 * decisión escrita: en este repo citar una decisión antes de escribirla es
 * legítimo y frecuente, porque los frentes en paralelo documentan su cambio en
 * una rama y la entrada de `06-decisiones.md` la escribe otro. Un aserto así
 * estaría rojo **mientras la tanda está abierta** — rojo por razones que no son
 * el cambio de quien lo corre, que es el modo de falla de B-180: el gate se
 * aprende a saltear. El juicio de si una huérfana es una tanda en vuelo o una
 * entrada que nadie escribió lo da el `auditor-documentacion`, con la salida de
 * `scripts/decisiones-referenciadas.mjs` en la mano.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  decisionesEscritas,
  huerfanas,
  referenciasDe,
} from '../scripts/decisiones-referenciadas.mjs';

const registro = readFileSync(
  fileURLToPath(new URL('../docs/06-decisiones.md', import.meta.url)),
  'utf8',
);

describe('las entradas se leen de los encabezados, no de cualquier mención', () => {
  it('lee las decisiones que el registro real tiene escritas', () => {
    // Control positivo. Si el regex de los encabezados dejara de matchear, el
    // barrido reportaría el documento entero como huérfano — o, en la
    // dirección que importa, nada quedaría atado a nada.
    expect(decisionesEscritas(registro).length).toBeGreaterThan(100);
  });

  it('las entradas leídas están en orden y sin repetir formatos raros', () => {
    const escritas = decisionesEscritas(registro);
    expect(escritas.every((d) => /^D-\d+$/.test(d))).toBe(true);
    expect(new Set(escritas).size, 'hay dos encabezados con el mismo número').toBe(escritas.length);
  });

  it('un `D-nnn` en el cuerpo de una entrada NO la declara escrita', () => {
    /*
     * El caso que hace que esto sirva de algo. El cuerpo de cada decisión cita
     * otras todo el tiempo («el argumento de D-74 sigue siendo cierto»), así
     * que si el barrido tomara cualquier mención, el documento se declararía
     * completo solo y no encontraría nunca una huérfana.
     */
    const doc = ['## D-01 · La primera', '', 'Esto revisita D-99, que no existe.'].join('\n');
    expect(decisionesEscritas(doc)).toEqual(['D-01']);
  });

  it('un encabezado que solo menciona una decisión tampoco la declara', () => {
    // `### Qué cambia respecto de D-146, y qué no` es un subtítulo real del
    // registro: menciona la decisión, no la define.
    expect(decisionesEscritas('### Qué cambia respecto de D-146, y qué no')).toEqual([]);
  });
});

describe('las referencias', () => {
  it('se juntan sin repetir', () => {
    expect(referenciasDe('D-01 y D-01 y D-02')).toEqual(['D-01', 'D-02']);
  });

  it('un número pegado a otra cosa no es una referencia', () => {
    // `AD-350` o `D-350x` no son citas a una decisión.
    expect(referenciasDe('AD-350 y D-350x')).toEqual([]);
  });
});

describe('el cruce', () => {
  it('nombra la decisión y todos los archivos que la citan', () => {
    const sueltas = huerfanas(
      { 'docs/a.md': 'ver D-99', 'docs/b.md': 'ver D-99 y D-01', 'docs/c.md': 'nada' },
      ['D-01'],
    );
    expect(sueltas).toEqual([{ decision: 'D-99', archivos: ['docs/a.md', 'docs/b.md'] }]);
  });

  it('ordena por número y no alfabéticamente', () => {
    // `D-9` después de `D-100` sería el orden de cadena, y en una lista larga
    // eso hace que nadie encuentre lo que busca.
    const sueltas = huerfanas({ 'docs/a.md': 'D-100 D-9 D-20' }, []);
    expect(sueltas.map((s) => s.decision)).toEqual(['D-9', 'D-20', 'D-100']);
  });

  it('con todo escrito no devuelve nada', () => {
    expect(huerfanas({ 'docs/a.md': 'D-01 y D-02' }, ['D-01', 'D-02'])).toEqual([]);
  });
});
