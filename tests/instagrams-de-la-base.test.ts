/**
 * **La copia del normalizador de handles no puede divergir del original.**
 *
 * `scripts/instagrams-de-la-base.mjs` arma una página local con todas las
 * cuentas de Instagram de la base. Necesita la misma normalización que el sitio
 * —`handleInstagram`, en `src/lib/enlaceSeguro.ts` (vivía en `detallePublico.ts`
 * hasta B-830, que lo mudó para que la bandeja de propuestas no arrastrara el
 * view-model público entero)— y **no la puede importar**:
 * un `.mjs` que corre con `node` a secas no resuelve los alias `@/` de
 * TypeScript, y arrastrar un loader para un script de una página no vale.
 *
 * Es la misma restricción que **D-20** ya había resuelto para las Functions, y se
 * resuelve igual: hay una copia, y este archivo la ata.
 *
 * ── Por qué esta copia importa más que la mayoría ─────────────────────────
 * Porque lo que las dos funciones deciden es **a qué cuenta apunta un link**. El
 * docblock del original lo dice: «un handle con una barra adentro armaría una URL
 * a otra cuenta». Si la copia se afloja —por ejemplo dejando pasar una barra— la
 * página local mandaría a un perfil que no es el de esa actividad, y quien la usa
 * la usa **para seguir cuentas**: seguiría la equivocada.
 *
 * ── Se comparan las dos, no una contra una tabla ──────────────────────────
 * La batería de abajo es de entradas, no de resultados esperados: lo que se exige
 * es que **contesten lo mismo**. Una tabla de resultados escritos a mano se puede
 * actualizar de un lado y quedar de acuerdo con la copia y en desacuerdo con el
 * sitio, que es exactamente el bug que este archivo previene.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { handleInstagram as delScript } from '../scripts/handle-instagram.mjs';
import { handleInstagram as delSitio } from '@/lib/detallePublico';

/**
 * Las formas en que un Instagram llega cargado, más las que tienen que ser
 * rechazadas.
 *
 * Las dos últimas son **la forma** de dos datos reales que el script encontró al
 * correrlo el 2026-09-07: alguien había cargado un nombre y alguien un mail en el
 * campo de Instagram. Son justo lo que el filtro tiene que rechazar sin romperse.
 *
 * **El mail va inventado y no el real, y eso lo cobró un test.** El primer intento
 * pegó acá la casilla de producción tal cual, y
 * `tests/sin-datos-personales.test.ts` lo puso en rojo: es **la casilla de un
 * tercero en un repo público**, o sea exactamente la fuga de B-246 (una casilla
 * ajena versionada, tres días). Lo que este caso necesita es la **forma** —algo
 * con arroba y un punto, que el alfabeto de Instagram rechaza—, no el valor. Un
 * dato real vale más que uno inventado **salvo cuando el dato real es de otra
 * persona**.
 */
const ENTRADAS = [
  '@casabrandon',
  'casabrandon',
  'https://instagram.com/casabrandon',
  'https://www.instagram.com/casabrandon/',
  'HTTP://INSTAGRAM.COM/CasaBrandon',
  'instagram.com/casabrandon',
  '  @casabrandon  ',
  'casa.brandon',
  'casa_brandon',
  'agenda.leh',
  'casabrandon/',
  'casabrandon//',
  '@',
  '',
  '   ',
  // Lo que tiene que quedar afuera: una barra adentro armaría otra URL.
  'casabrandon/otracuenta',
  'instagram.com/casabrandon/otracuenta',
  '@casa brandon',
  'casa-brandon',
  'ñoño',
  'a'.repeat(31),
  'a'.repeat(30),
  // La forma de dos datos reales que el script encontró (2026-09-07). El nombre va
  // tal cual —es el nombre público de un festival— y el mail va inventado: ver
  // arriba.
  'Festival Argentino de Historieta',
  'unclubdelectura@example.com',
];

/**
 * **Ya no hay dos normalizadores** — B-928.
 *
 * Hasta acá `scripts/handle-instagram.mjs` era una **copia**, y estos casos
 * corrían las dos contra la misma batería exigiendo que contestaran igual. La red
 * funcionó: se puso en rojo apenas B-928 agregó al módulo la tolerancia al
 * `?igsh=…` que pega el botón «Compartir» y el script se quedó atrás.
 *
 * **Y eso mismo mostró su límite**: un test de equivalencia avisa *después* de
 * que alguien arregló una sola de las dos, y el arreglo hay que escribirlo dos
 * veces igual. La implementación pasó a `src/lib/handle-instagram.mjs` —un `.mjs`
 * que un script de Node plano sí puede importar, como `slugify` y `geografia`— y
 * el archivo del script quedó como fachada.
 *
 * Lo que se verifica ahora es **que siga sin haber copia**, que es la afirmación
 * que hoy tiene contenido. Comparar la función consigo misma no prueba nada.
 */
describe('el normalizador es uno solo — B-928', () => {
  it('el archivo del script solo reexporta: no tiene implementación propia', () => {
    const fachada = readFileSync('scripts/handle-instagram.mjs', 'utf8');
    expect(fachada).toContain("export { handleInstagram } from '../src/lib/handle-instagram.mjs'");
    /*
     * MUTACIÓN PROBADA: volver a pegar el cuerpo en el script deja este caso en
     * rojo. Las tres señales son las partes de la regla que una copia repetiría.
     */
    for (const señal of ['.replace(', '.trim()', 'A-Za-z0-9._']) {
      expect(fachada, `el script volvió a tener implementación propia: ${señal}`).not.toContain(
        señal,
      );
    }
  });

  it('y lo que importa el script es exactamente lo que usa el sitio', () => {
    const distintas = ENTRADAS.filter(
      (entrada) => delScript(entrada) !== delSitio(entrada),
    ).map((entrada) => `«${entrada}» → script: ${delScript(entrada)} / sitio: ${delSitio(entrada)}`);

    expect(distintas, 'la fachada dejó de apuntar al módulo del sitio').toEqual([]);
  });

  it('y las dos rechazan lo que armaría una URL a otra cuenta', () => {
    /*
     * El control positivo de la batería: si las dos funciones se rompieran igual
     * —devolviendo siempre `null`, por ejemplo— el caso de arriba pasaría igual.
     * Acá se afirma que el filtro **hace algo**: acepta lo que es un handle y
     * rechaza lo que no.
     */
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
