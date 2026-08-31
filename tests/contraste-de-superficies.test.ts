import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { AA_TEXTO, contraste, mezclar, oklchASrgb, type Srgb } from '@/lib/contraste';

/**
 * El contraste del sitio **sobre cualquier superficie**, no solo sobre el papel
 * — B-256.
 *
 * ── Qué agrega sobre `contraste-del-sitio.test.ts` ────────────────────────
 * Aquél mide cada `text-tinta/NN` **contra `papel`**, y lo dice él mismo en su
 * docblock: «lo que NO puede ver: texto sobre un fondo que no sea `papel`». Eso
 * estaba bien mientras el sitio tuviera un solo fondo. Con D-141 tiene **tres**
 * —`papel`, `crema`, `hondo`— más los tintes de acento de los avisos, y B-253 los
 * usa todos: la barra de navegación, las tarjetas de las preguntas, el índice de
 * la ayuda, la fila del próximo encuentro.
 *
 * Y la dirección del error es la mala: cada superficie es **más oscura** que el
 * papel, así que el chequeo viejo da un número **optimista**. `text-tinta/65`
 * sobre papel da 5,26 y pasa; el mismo texto sobre `hondo` da 5,04. Hoy los dos
 * pasan, pero nada avisaría el día que una superficie nueva sea un poco más
 * oscura: el test seguiría verde midiendo contra el fondo equivocado.
 *
 * ── Cómo evita ser una lista que se desactualiza ──────────────────────────
 * Las superficies **se leen del markup y de `global.css`**, no se enumeran acá:
 * los tres tokens salen de la hoja de estilos y los tintes de acento salen de
 * buscar `bg-acento/NN` en los archivos del sitio. Una superficie nueva y más
 * oscura entra sola al cálculo y pone en rojo lo que dejó de alcanzar, que es
 * exactamente cuándo hay que revisarlo.
 *
 * ── Lo que queda afuera, con su motivo ────────────────────────────────────
 * Las superficies **oscuras** —`bg-tinta` del salto al contenido y `bg-acento`
 * del botón primario— no entran a la lista de fondos: encima de ellas no va texto
 * atenuado sino `text-papel`, y ese caso tiene su propio aserto abajo. Meterlas
 * en el barrido de atenuaciones haría fallar todo el sitio por un cálculo que no
 * corresponde a ningún píxel real.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const css = (): string => readFileSync(raiz('src/styles/global.css'), 'utf8');

/** Un token de color de la paleta, leído de la hoja de estilos y no copiado. */
const token = (nombre: string): Srgb => {
  const m = css().match(
    new RegExp(`--color-${nombre}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`),
  );
  expect(m, `no se encontró --color-${nombre} en global.css`).not.toBeNull();
  return oklchASrgb(Number(m![1]), Number(m![2]), Number(m![3]));
};

/** El markup del sitio público. El panel tiene su propio criterio y no entra. */
const archivosDelSitio = (): string[] =>
  execFileSync('git', ['ls-files', 'src/pages', 'src/components/sitio'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.astro') && f !== 'src/pages/admin.astro');

const fuentes = (): { donde: string; src: string }[] =>
  archivosDelSitio().map((f) => ({ donde: f, src: readFileSync(raiz(f), 'utf8') }));

/**
 * Las opacidades a las que el sitio usa el acento **como fondo**.
 *
 * Tailwind escribe la fracción de dos maneras —`bg-acento/10` y
 * `bg-acento/[0.07]`— y las dos aparecen en el markup, así que las dos se
 * reconocen. Es la parte que hace que esto no sea una lista a mano: un tinte
 * nuevo y más cargado entra al cálculo sin que nadie se acuerde.
 */
const tintesDeAcento = (): number[] => {
  const encontrados = new Set<number>();
  for (const { src } of fuentes()) {
    for (const m of src.matchAll(/bg-acento\/(?:\[(0?\.\d+)\]|(\d{1,3}))/g)) {
      encontrados.add(m[1] ? Number(m[1]) : Number(m[2]) / 100);
    }
  }
  return [...encontrados];
};

/** Toda superficie clara sobre la que el sitio apoya texto, con su nombre. */
const superficies = (): { nombre: string; color: Srgb }[] => {
  const papel = token('papel');
  const acento = token('acento');
  return [
    { nombre: 'papel', color: papel },
    { nombre: 'crema', color: token('crema') },
    { nombre: 'hondo', color: token('hondo') },
    ...tintesDeAcento().map((o) => ({
      nombre: `acento al ${Math.round(o * 100)}% sobre papel`,
      color: mezclar(acento, papel, o),
    })),
  ];
};

/** La más oscura de todas: si algo pasa acá, pasa en cualquiera. */
const peorSuperficie = (): { nombre: string; color: Srgb } => {
  const papel = token('papel');
  // Se ordena por contraste **contra el papel**: cuanto más contrasta con el
  // fondo más claro, más oscura es. Evita traer una función de luminancia más.
  return [...superficies()].sort(
    (a, b) => contraste(b.color, papel) - contraste(a.color, papel),
  )[0]!;
};

/** Cada `text-tinta/NN` y `marker:text-tinta/NN` del markup, con su línea. */
const atenuaciones = (): { donde: string; clase: string; opacidad: number }[] => {
  const out: { donde: string; clase: string; opacidad: number }[] = [];
  for (const { donde, src } of fuentes()) {
    src.split('\n').forEach((linea, i) => {
      for (const m of linea.matchAll(/((?:marker:)?text-tinta\/(\d{1,3}))/g)) {
        out.push({ donde: `${donde}:${i + 1}`, clase: m[1]!, opacidad: Number(m[2]) / 100 });
      }
    });
  }
  return out;
};

describe('el contraste del sitio sobre las tres superficies — B-256', () => {
  it('el barrido encuentra markup, superficies y atenuaciones de verdad', () => {
    /*
     * Control positivo. Los asertos de abajo afirman que una lista está vacía, y
     * una lista vacía es también lo que devuelve un barrido que no leyó nada.
     */
    expect(archivosDelSitio().length).toBeGreaterThan(3);
    expect(atenuaciones().length).toBeGreaterThan(20);
    // Los tres tokens más al menos un tinte de acento: si el markup dejara de
    // usarlos, este chequeo volvería a ser el de una sola superficie sin decirlo.
    expect(superficies().length).toBeGreaterThan(3);
    expect(tintesDeAcento().length).toBeGreaterThan(0);
  });

  it('la más oscura de las superficies es más oscura que el papel', () => {
    // Sin esto, un parseo fallido de `global.css` dejaría a `papel` como peor
    // superficie y el test entero se volvería el que ya existe.
    const papel = token('papel');
    const peor = peorSuperficie();
    expect(peor.nombre).not.toBe('papel');
    expect(contraste(peor.color, papel)).toBeGreaterThan(1);
  });

  it('ninguna atenuación queda por debajo de AA sobre la superficie más oscura', () => {
    const peor = peorSuperficie();

    const flojas = atenuaciones()
      .map((a) => ({ ...a, ratio: contraste(mezclar(token('tinta'), peor.color, a.opacidad), peor.color) }))
      .filter((a) => a.ratio < AA_TEXTO)
      .map((a) => `${a.donde} — ${a.clase} da ${a.ratio.toFixed(2)}:1`);

    expect(
      flojas,
      `estas atenuaciones no llegan a ${AA_TEXTO}:1 sobre «${peor.nombre}», que es la ` +
        'superficie más oscura del sitio. Subí la opacidad: el piso con esta paleta es /65.',
    ).toEqual([]);
  });

  it('el acento pasa AA como texto sobre cualquier superficie', () => {
    /*
     * El acento es color de texto en todas las páginas: el enlace de un párrafo,
     * la sección activa de la barra (que va sobre `hondo`), «El próximo» de un
     * encuentro (que va sobre un tinte de acento). Sobre papel ya estaba medido
     * en B-227; sobre las otras dos no lo había mirado nadie.
     */
    const acento = token('acento');
    const flojas = superficies()
      .map((s) => ({ ...s, ratio: contraste(acento, s.color) }))
      .filter((s) => s.ratio < AA_TEXTO)
      .map((s) => `${s.nombre}: ${s.ratio.toFixed(2)}:1`);

    expect(flojas, 'el acento no se puede usar como texto sobre estas superficies').toEqual([]);
  });

  it('el color de CUALQUIER tipo de actividad pasa AA como texto sobre cualquier superficie', () => {
    /*
     * La página de detalle escribe el nombre del tipo con `colorDeTipo(slug)`, y
     * `tipo` es una **taxonomía autogestionada** (§4): el tono de un tipo que
     * alguien cree el año que viene se deriva de su slug y hoy no existe.
     *
     * `tests/identidad.test.ts` ya recorre los 360 tonos **sobre papel**, que es
     * lo que la portada generada del listado necesita. Acá se recorren los mismos
     * 360 sobre **todas** las superficies, porque el cintillo del detalle podría
     * mudarse a una tarjeta mañana y el modo de falla sería un rótulo ilegible
     * para un tipo que nadie inventó todavía — o sea, invisible en la revisión.
     *
     * La luminosidad y el croma de la banda se leen de `identidad.ts` por la
     * misma razón por la que los colores se leen de `global.css`: copiarlos acá
     * los dejaría mintiendo con la primera banda nueva.
     */
    const identidad = readFileSync(raiz('src/lib/identidad.ts'), 'utf8');
    const L = Number(/^const L = ([\d.]+);/m.exec(identidad)?.[1]);
    const C = Number(/^const C = ([\d.]+);/m.exec(identidad)?.[1]);
    expect(L, 'no se pudo leer la luminosidad de la banda en identidad.ts').toBeGreaterThan(0);
    expect(C, 'no se pudo leer el croma de la banda en identidad.ts').toBeGreaterThan(0);

    const flojos: string[] = [];
    for (const s of superficies()) {
      for (let h = 0; h < 360; h++) {
        const r = contraste(oklchASrgb(L, C, h), s.color);
        if (r < AA_TEXTO) flojos.push(`${s.nombre}, tono ${h}: ${r.toFixed(2)}:1`);
      }
    }

    expect(
      flojos.slice(0, 5),
      'hay tonos de tipo que quedan ilegibles sobre alguna superficie. Como el tono ' +
        'de un tipo nuevo se deriva de su slug, no se arregla caso por caso: hay que ' +
        'bajar la luminosidad de la banda entera en `identidad.ts`.',
    ).toEqual([]);
  });

  it('el texto del botón primario pasa AA sobre el acento y sobre su hover', () => {
    // El único texto claro sobre fondo oscuro del sitio, y el que más se toca.
    const papel = token('papel');
    expect(contraste(papel, token('acento'))).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(contraste(papel, token('acento-hondo'))).toBeGreaterThanOrEqual(AA_TEXTO);
    // El salto al contenido, que es el primer foco de cada página.
    expect(contraste(papel, token('tinta'))).toBeGreaterThanOrEqual(AA_TEXTO);
  });
});
