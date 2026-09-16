import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import base from '@/lib/opciones-base.json';
import { CAMPOS_TAXONOMIA } from '@/types/actividad';

/**
 * **B-973 — que una taxonomía declarada llegue a producción, y no solo al código.**
 *
 * El bug: agregar un campo a `CAMPOS_TAXONOMIA` no lo siembra en la base, y
 * nada lo decía. Pasó con `provincia`, que además es obligatoria: el panel quedó
 * inguardable con el deploy entero en verde. Y el punto ciego tiene una causa
 * concreta — **el emulador sí se siembra**. `seed-emulador.mjs` lee
 * `opciones-base.json`, así que los seis pasos del gate, el build contra el
 * emulador y esta misma suite corren contra un entorno donde el vocabulario
 * nuevo siempre existe. La asimetría entre los dos entornos es lo que no se ve.
 *
 * La red quedó en dos mitades, y este archivo cubre la que un test puede cubrir:
 *
 *  1. **Acá:** que el semillero tenga una entrada por campo declarado, y que el
 *     chequeo de producción siga cableado donde tiene que estar.
 *  2. **`scripts/taxonomias-en-produccion.mjs`**, en el job `hosting` del
 *     workflow: que el documento exista **en la base real**. Eso ningún test lo
 *     puede afirmar desde acá, porque desde acá no hay producción.
 */
describe('B-973 · una taxonomía declarada llega a producción', () => {
  const script = readFileSync('scripts/taxonomias-en-produccion.mjs', 'utf8');
  const workflow = readFileSync('.github/workflows/push-main.yml', 'utf8');

  /**
   * `CAMPOS_TAXONOMIA` es la lista autoritativa (§4.1) y `opciones-base.json` el
   * semillero. Que coincidan **en las dos direcciones** es lo que hace que
   * sembrar sea suficiente:
   *
   *  - un campo declarado sin semilla no se siembra nunca, ni en el emulador ni
   *    en producción, y el desplegable nace vacío en los dos lados;
   *  - una semilla sin campo declarado escribe un documento que nadie lee, y
   *    —peor— es la que sobrevive a que alguien saque el campo del tipo sin
   *    darse cuenta de que quedó vocabulario colgado.
   */
  it('el semillero tiene exactamente una entrada por campo declarado', () => {
    const declarados = [...CAMPOS_TAXONOMIA].sort();
    const sembrados = Object.keys(base).sort();

    expect(
      declarados.filter((c) => !sembrados.includes(c)),
      'campos en CAMPOS_TAXONOMIA sin entrada en opciones-base.json',
    ).toEqual([]);
    expect(
      sembrados.filter((c) => !(declarados as string[]).includes(c)),
      'entradas de opciones-base.json que ya no son campos declarados',
    ).toEqual([]);
  });

  /**
   * Un chequeo cuyo `exit 1` es opcional deja de ser un chequeo. El script tiene
   * un `--informar` para mirarlo sin que falle, y lo que se verifica acá es que
   * el workflow **no** lo use: es la forma más barata de desactivar la red
   * entera sin borrar nada, y la que un reviewer lee como «sigue estando».
   */
  it('el workflow corre el chequeo sin --informar, antes del build', () => {
    expect(workflow).toContain('node scripts/taxonomias-en-produccion.mjs');
    expect(workflow).not.toContain('taxonomias-en-produccion.mjs --informar');

    const enChequeo = workflow.indexOf('node scripts/taxonomias-en-produccion.mjs');
    const enBuild = workflow.indexOf('run: npm run build');
    expect(enChequeo, 'el chequeo tiene que estar en el workflow').toBeGreaterThan(-1);
    /*
     * **Antes** del build, no después: el build no falla ante un vocabulario
     * faltante —`contenidoDelSitio.ts` hace `snap.data()?.valores ?? []`— y
     * publica los chips vacíos sin decir nada. Verificar después sería verificar
     * un sitio ya roto.
     */
    expect(enChequeo, 'el chequeo va antes del build').toBeLessThan(enBuild);
  });

  /**
   * El script lee `CAMPOS_TAXONOMIA` del fuente con un regex, que es lo que le
   * permite no importar TypeScript. Un regex que deje de matchear devolvería
   * cero campos y el chequeo pasaría afirmando nada — por eso el script aborta
   * con la lista vacía, y por eso acá se corre el mismo regex contra el fuente
   * real: si alguien reformatea la declaración, este test cae antes que el deploy.
   */
  it('el regex del script extrae los mismos campos que el tipo', () => {
    const fuente = readFileSync('src/types/actividad.ts', 'utf8');
    const bloque = /export const CAMPOS_TAXONOMIA = \[([\s\S]*?)\] as const;/.exec(fuente);
    expect(bloque, 'el script no encontraría la declaración').not.toBeNull();

    const sinComentarios = bloque![1]!.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const extraidos = [...sinComentarios.matchAll(/'([a-z][a-z0-9-]*)'/g)].map((m) => m[1]);

    expect(extraidos).toEqual([...CAMPOS_TAXONOMIA]);
  });

  /**
   * **Qué puede imprimir este script, fijado por test.**
   *
   * Es el primer paso del pipeline que lee Firestore de producción y escribe a un
   * log que **es público** —el repo lo es—, y hasta que el `auditor-privacidad`
   * lo señaló no había nada que dijera qué puede salir por ahí. Lo que sale son
   * **nombres de campo y conteos**; el contenido de `/opciones/*` no, porque el
   * array crudo incluye las opciones con `aprobada: false` que `opcionesPublicas`
   * filtra a propósito del `events.json` (§4.3).
   *
   * El riesgo no es el código de hoy: es que cambiar `${n} valores` por
   * `${valores.map((v) => v.label).join(', ')}` —la evolución natural cuando
   * alguien quiere depurar por qué falta un slug— publicaría etiquetas sin
   * aprobar con todo en verde.
   */
  it('informa nombres y conteos, nunca el contenido de `/opciones/*`', () => {
    expect(script).toContain('valores ?? []).length');
    /* Ningún `console.*` que interpole el array de valores en vez de su largo. */
    expect(script).not.toMatch(/console\.\w+\([^)]*\.valores(?!\s*\?\?\s*\[\]\)\.length)/);
  });

  /**
   * **Y que la credencial no pueda llegar al log** (trampa 4, §5.4). V8 mete un
   * prefijo del input en el mensaje de la `SyntaxError` cuando el valor no tiene
   * forma de JSON, y el enmascarado de Actions tapa coincidencias exactas del
   * secreto, no prefijos suyos: un `FIREBASE_SERVICE_ACCOUNT` guardado en base64
   * echaría sus primeros caracteres sin que nadie lo note.
   */
  it('el parseo de la credencial va envuelto y su mensaje no lleva el valor', () => {
    expect(script).toMatch(/try\s*\{[\s\S]{0,120}JSON\.parse\(crudo\)[\s\S]{0,120}\}\s*catch/);
    expect(script).not.toMatch(/console\.\w+\([^)]*crudo/);
  });

  /**
   * Correrlo contra el emulador daría verde siempre —el seed lo siembra— y un
   * chequeo que no puede fallar es peor que ninguno: ocupa el lugar de la red
   * sin ser una. El script aborta si ve `FIRESTORE_EMULATOR_HOST`.
   */
  it('el script se niega a correr contra el emulador', () => {
    expect(script).toContain('FIRESTORE_EMULATOR_HOST');
    expect(script).toMatch(/FIRESTORE_EMULATOR_HOST[\s\S]{0,600}process\.exit\(1\)/);
  });
});
