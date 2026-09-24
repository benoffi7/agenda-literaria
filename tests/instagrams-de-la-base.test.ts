/**
 * **El script de los Instagram de la base usa el normalizador único** — B-928,
 * B-1180, B-1331.
 *
 * `scripts/instagrams-de-la-base.mjs` arma una página local con todas las
 * cuentas de Instagram de la base, y lo que decide qué cuenta es cada una es
 * `handleInstagram`. **Hay una sola implementación**: vive en
 * `functions/handle-instagram.js` (B-1145), porque la Function de Calendar
 * publica el mismo `@casabrandon` que la ficha y `functions/` no puede importar
 * `src/` (D-20). Todo lo demás es reexportación:
 *
 * ```
 * scripts/instagrams-de-la-base.mjs
 *   → scripts/handle-instagram.mjs        (fachada, B-928)
 *     → src/lib/handle-instagram.mjs      (fachada, B-1180)
 *       → functions/handle-instagram.js   (la implementación)
 * ```
 *
 * ── Qué decía esto antes, y por qué dejó de probar nada ───────────────────
 * Hasta B-928 el script tenía una **copia** del normalizador, y este archivo la
 * ataba al original corriendo las dos contra una batería de entradas y
 * exigiendo que contestaran lo mismo. La red funcionó —se puso en rojo cuando
 * B-928 agregó al original la tolerancia al `?igsh=…` y la copia se quedó
 * atrás— y la respuesta fue borrar la copia. Pero el caso de equivalencia
 * sobrevivió, y desde entonces comparaba **la función consigo misma**: pasaba
 * siempre, con copia o sin ella. B-1331 lo cambió por lo que hoy tiene
 * contenido, que es **que la cadena termine en el módulo único**.
 *
 * ── Qué cubre esto y qué cubre `tests/calendario.test.ts` ─────────────────
 * Allá (B-1180) está vigilado el eslabón `src/lib/handle-instagram.mjs` →
 * `functions/`: el fuente de esa fachada, y la identidad de lo que llega por
 * `@/lib/enlaceSeguro` —el camino de la ficha—. **No se repite acá.** Lo que
 * ese test no mira es el camino **del script**, que entra por otra fachada, y
 * eso es lo único que se verifica abajo: el fuente de
 * `scripts/handle-instagram.mjs`, la identidad de lo que exporta, y que la
 * página lo importe de ahí.
 *
 * ── Por qué esto importa más que la mayoría ───────────────────────────────
 * Porque lo que el normalizador decide es **a qué cuenta apunta un link**: un
 * handle con una barra adentro armaría una URL a otra cuenta. Quien usa esta
 * página la usa **para seguir cuentas**: con un normalizador propio y flojo,
 * seguiría la equivocada.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { handleInstagram as delScript } from '../scripts/handle-instagram.mjs';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import { handleInstagram as elUnico } from '../functions/handle-instagram.js';

describe('el script usa el normalizador único — B-928, B-1180, B-1331', () => {
  it('la fachada del script solo reexporta: no tiene implementación propia', () => {
    const fachada = readFileSync('scripts/handle-instagram.mjs', 'utf8');
    expect(fachada).toContain("export { handleInstagram } from '../src/lib/handle-instagram.mjs'");
    /*
     * Las señales son las partes de la regla que una copia repetiría, más la
     * flecha o el `function` de un envoltorio. Se buscan **sin comentarios**,
     * como en el caso hermano de `calendario.test.ts`, para que el docblock
     * pueda nombrarlas.
     *
     * El caso de identidad de abajo es el que decide; este está para que el
     * rojo diga **dónde** se reabrió la copia.
     */
    const codigo = sinComentarios(fachada);
    for (const señal of ['.replace(', '.trim()', 'A-Za-z0-9._', '=>', 'function']) {
      expect(codigo, `el script volvió a tener implementación propia: ${señal}`).not.toContain(
        señal,
      );
    }
  });

  /**
   * **Identidad, no equivalencia.** Es lo que reemplaza a la batería de B-928:
   * aquella exigía que el script contestara lo mismo que el sitio, y con la
   * fachada contestaba lo mismo por ser la misma función. `toBe` exige
   * justamente eso —que sea **el mismo objeto** que exporta `functions/`—, así
   * que un cuerpo propio o un envoltorio lo ponen en rojo aunque contesten
   * igual para toda entrada.
   *
   * MUTACIÓN PROBADA (B-1331): reemplazar la reexportación de
   * `scripts/handle-instagram.mjs` por un cuerpo propio que delega en el módulo
   * único —contesta igual para toda entrada— deja en rojo este caso y el de
   * arriba. El viejo caso de equivalencia seguía en verde con esa mutación.
   */
  it('y lo que exporta es exactamente la función de `functions/`, por identidad', () => {
    expect(delScript, 'la fachada del script dejó de apuntar al módulo único').toBe(elUnico);
  });

  it('y la página importa el normalizador por la fachada, no se arma uno', () => {
    const codigo = sinComentarios(readFileSync('scripts/instagrams-de-la-base.mjs', 'utf8'));
    expect(codigo).toContain("import { handleInstagram } from './handle-instagram.mjs';");
    // Lo que una regla propia repetiría: el alfabeto de Instagram.
    expect(codigo, 'la página se armó su propio normalizador').not.toContain('A-Za-z0-9._');
  });

  /**
   * **Los casos de la regla — el control positivo.** Los de identidad prueban que
   * hay una sola función; estos, que esa función **hace algo**: acepta lo que es
   * un handle y rechaza lo que armaría una URL a otra cuenta.
   *
   * Los dos rechazos del medio son **la forma** de dos datos reales que el script
   * encontró al correrlo el 2026-09-07: alguien había cargado un nombre y alguien
   * un mail en el campo de Instagram. **El mail va inventado**, y eso lo cobró un
   * test: el primer intento pegó la casilla de producción tal cual y
   * `tests/sin-datos-personales.test.ts` lo puso en rojo —la casilla de un tercero
   * en un repo público, la fuga de B-246—. Lo que el caso necesita es la forma.
   */
  it('y el normalizador rechaza lo que armaría una URL a otra cuenta', () => {
    expect(delScript('@casabrandon')).toBe('casabrandon');
    expect(delScript('casabrandon/otracuenta')).toBeNull();
    expect(delScript('Festival Argentino de Historieta')).toBeNull();
    expect(delScript('unclubdelectura@example.com')).toBeNull();
    // B-1160 — el corte del `?`/`#` va solo detrás de `instagram.com/`: pelado,
    // `casa#brandon` derivaba a `casa`, que es la cuenta de otra persona.
    expect(delScript('casa#brandon')).toBeNull();
    expect(delScript('taller?2026')).toBeNull();
    expect(delScript('https://www.instagram.com/casabrandon/?igsh=MWx0eXo4a2Rr')).toBe('casabrandon');
    // Y el `undefined`/`null`, que el script puede pasarle desde un campo vacío.
    expect(delScript(undefined)).toBeNull();
    expect(delScript(null)).toBeNull();
  });

  it('la página sale a `.estado/`, que no se versiona ni se publica', () => {
    /*
     * **La decisión que no se puede aflojar.** La lista incluye
     * `difusion.arrobar`, que el §5.1 marca como trabajo interno que **nunca sale
     * al público**. Un archivo en `public/` se publicaría con el próximo build.
     *
     * Se afirma sobre el fuente del script porque el destino es una constante de
     * ahí, y `.estado/` está en el `.gitignore` (verificado en el mismo caso).
     */
    const fuente = readFileSync(`${process.cwd()}/scripts/instagrams-de-la-base.mjs`, 'utf8');
    expect(fuente, 'la salida dejó de ir a .estado/').toMatch(/\.estado\/instagrams\.html/);
    expect(fuente, 'la salida iría a una carpeta que se publica').not.toMatch(
      /(public|dist)\/instagrams/,
    );
    expect(readFileSync(`${process.cwd()}/.gitignore`, 'utf8')).toMatch(/^\.estado\/$/m);
  });

  it('y el script no escribe: es solo lectura contra Firestore', () => {
    /*
     * Lo que hace que correrlo contra producción sea seguro sin ninguna guarda de
     * `--produccion`, a diferencia de los tres de `guardas-de-los-scripts`. Si
     * algún día escribe, necesita esa guarda y este caso es el que lo va a pedir.
     */
    const fuente = readFileSync(`${process.cwd()}/scripts/instagrams-de-la-base.mjs`, 'utf8');

    /*
     * **`.set(` y `.delete(` NO están en esta lista, y es una limitación real que
     * conviene tener escrita:** `Map` tiene los dos métodos con el mismo nombre,
     * y este script usa un `Map` para juntar las cuentas. Buscarlos daría un
     * falso positivo —pasó al escribir este test— y un chequeo que grita por algo
     * que no es el problema se aprende a ignorar (B-180).
     *
     * Lo que sí se busca son los que **solo** existen en Firestore, más `.doc(`:
     * este script no lo usa, y toda escritura de un documento pasa por ahí. Una
     * escritura futura que se escapara de esta lista tendría que ser un
     * `.set()`/`.delete()` sobre un `doc()` — y el `doc(` la delata.
     */
    for (const escritura of ['.doc(', '.update(', '.create(', 'db.batch(', 'FieldValue']) {
      expect(
        fuente,
        `el script escribe (${escritura}) y no tiene guarda de producción`,
      ).not.toContain(escritura);
    }

    // Y el control positivo: que la lectura que hace siga siendo la que se revisó.
    expect(fuente, 'cambió cómo lee la colección').toContain(".collection('actividades').get()");
  });
});
