/**
 * B-914: el label de «Otro…» no se tira en el `onChange`.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import { fuente, versionados, sinComentarios } from '../fixtures/clases-de-bug';

/**
 * **Clase de B-914 · el `<TaxonomiaSelect>` que tira el label de «Otro…».**
 *
 * ── Lo que pasó, y por qué es la peor forma de fallar ─────────────────────
 * `LibreriaFormulario` escribía `onChange={(v) => set('barrio', v)}` y **tiraba
 * el segundo argumento**, que es el label a persistir (D-02). El chip aparecía,
 * la ficha guardaba el slug, y la opción **nunca se daba de alta** en
 * `/opciones/barrio`: ningún desplegable la volvía a ofrecer y el sitio la
 * mostraba des-slugueada («villa-crespo» en vez de «Villa Crespo»).
 *
 * Es la trampa 6 del §13 por el lado que no está escrito ahí. Aquélla dice que
 * sin slugify quedan cuatro variantes de «a la gorra»; ésta es la contraria:
 * **queda ninguna**. Y no se nota al cargar —el formulario se comporta
 * exactamente igual— sino semanas después, cuando alguien busca el barrio en el
 * desplegable y no está.
 *
 * ── Por qué la clase y no el caso ─────────────────────────────────────────
 * Porque el proyecto pasó de un formulario con taxonomías a **cuatro** en un día,
 * y el que viene se va a escribir copiando alguno. El `onChange` de dos
 * argumentos es una interfaz que TypeScript **no** obliga a usar entera: una
 * arrow de un parámetro tipa perfecto contra una firma de dos, así que el
 * compilador no dice nada — y el test tampoco decía nada.
 *
 * ── Qué verifica, y qué NO ────────────────────────────────────────────────
 * Solo el **borde**: que ningún `<TaxonomiaSelect>` del repo reciba un `onChange`
 * de un solo parámetro. El barrido saca los elementos del fuente y mira **dentro
 * de cada uno**, no el archivo entero: un formulario tiene muchos `onChange` de
 * un parámetro que están perfectos (un `<input>` no tiene label que persistir).
 *
 * **No verifica dónde se persiste**, y es a propósito. `ModalidadesEditor` y las
 * secciones del formulario de actividad reciben el `onChange` del padre y la
 * escritura vive en `lib/formulario/guardar.ts` (B-70) — exigir `upsertOpcion` en
 * cada archivo daría rojo sobre código correcto. Que la escritura vaya en el
 * orden correcto ya lo cuida la clase de B-71, acá arriba.
 */
describe('clase de B-914 · el label de «Otro…» no se tira en el `onChange`', () => {
  /** Cada `<TaxonomiaSelect …>` del repo, con su archivo y su cuerpo. */
  const usosDelControl = () =>
    versionados('src/components')
      .filter((f) => /\.tsx$/.test(f))
      .flatMap((archivo) => {
        const src = sinComentarios(fuente(archivo));
        return [...src.matchAll(/<TaxonomiaSelect\b[\s\S]*?\/>/g)].map((m, i) => ({
          archivo,
          n: i + 1,
          cuerpo: m[0],
        }));
      });

  /** Un `onChange` de **un** parámetro: el label se descarta. */
  const ONCHANGE_DE_UN_PARAMETRO = /onChange=\{\(\s*\w+\s*\)\s*=>/;

  it('el barrido encontró los usos del control', () => {
    // Sin esto, el caso de abajo recorrería una lista vacía y daría verde sin
    // mirar nada — el control positivo que este repo exige.
    const usos = usosDelControl();
    expect(usos.length, 'el barrido dejó de encontrar los <TaxonomiaSelect>').toBeGreaterThanOrEqual(
      6,
    );
    expect(usos.some((u) => u.archivo.endsWith('LibreriaFormulario.tsx'))).toBe(true);
    expect(usos.some((u) => u.archivo.endsWith('SuscripcionFormulario.tsx'))).toBe(true);
  });

  it.each(usosDelControl().map((u) => [`${u.archivo} #${u.n}`, u.cuerpo]))(
    '%s no descarta el label',
    (donde, cuerpo) => {
      expect(
        ONCHANGE_DE_UN_PARAMETRO.test(cuerpo as string),
        `${donde}: el \`onChange\` toma un solo parámetro, y el segundo es el label a ` +
          'persistir. Tirarlo hace que la etiqueta nueva nunca se dé de alta (B-914)',
      ).toBe(false);
    },
  );
});
