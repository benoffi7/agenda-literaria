/**
 * §5.1 / B-821: una marca del navegador tiene clave fija y está declarada.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import { fuente, versionados, sinComentarios } from '../fixtures/clases-de-bug';

describe('clase de la §5.1 · una marca del navegador tiene clave fija y está declarada — B-821', () => {
  /*
   * **La clase, y por qué hacía falta.** `docs/07-seguridad.md` escribió la regla
   * como normativa cerrando B-814: una marca del navegador tiene clave **fija** y
   * no guarda nada que alguien tipeó; si empieza a guardar contenido, deja de ser
   * una marca y le corresponde el tratamiento del borrador —huella del uid,
   * borrado, los 30 días (D-122)—. Lo que no existía era un test que la verificara
   * como clase: había tres de instancia, cada uno escrito junto con su módulo.
   *
   * Es la forma exacta del «se acordaron de sanear los cinco campos que había». Van
   * ocho claves y tres módulos con el mismo `AlmacenDe*` copiado a propósito, así
   * que la novena nacía sin ninguna afirmación — y el modo de falla que importa (una
   * marca que empieza a guardar un valor tipeado, digamos «el último barrio que
   * escribí») dejaba los tres tests de instancia en verde.
   *
   * El barrido va en los **dos sentidos** contra la tabla de la doc: una marca
   * nueva sin fila, y una fila que ya no exista en el código.
   */
  const CLAVES = /'(agenda[-:][A-Za-z0-9:.-]*)'/g;

  /**
   * Los archivos del panel y del sitio que **tocan el almacenamiento del
   * navegador o declaran una de sus claves**.
   *
   * ── Por qué las dos condiciones y no solo la primera — B-848 ────────────
   * El barrido miraba únicamente los archivos que llaman a
   * `getItem`/`setItem`/`removeItem`, y eso deja un agujero con la forma exacta
   * de la clase que este bloque persigue: **un módulo que declara la clave y
   * delega el acceso en otro archivo se escapa entero**. La clave existe, guarda
   * lo que guarde, y no aparece en ninguna de las dos direcciones del chequeo —
   * ni «te falta la fila en la doc», ni «esta fila ya no existe».
   *
   * Lo encontró B-848 sobre sí mismo: `lib/guardadosDelSitio.ts` (puro) declara
   * las claves y `lib/guardadoDelNavegador.ts` (el transporte) toca
   * `window.localStorage`, que es el mismo corte que ya tenían
   * `analyticsSitio.ts` / `medicionSitio.ts`. Aquél no se escapaba **por
   * casualidad**: el módulo puro recibe el almacén como puerto y le llama
   * `getItem` adentro. O sea que la red dependía de un detalle de estilo del
   * archivo auditado, y no de la regla.
   *
   * La segunda condición usa el **mismo patrón** que `declaradas()`: si un
   * archivo declara una constante de clave, entra al barrido aunque no toque el
   * almacén con sus propias manos.
   */
  const conAlmacenamiento = (): string[] =>
    [...versionados('src/lib'), ...versionados('src/components')]
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => {
        const src = sinComentarios(fuente(f));
        return (
          /\.(getItem|setItem|removeItem)\(/.test(src) ||
          /(?:export )?const [A-Z_][A-Z0-9_]* = 'agenda[-:]/.test(src)
        );
      });

  /**
   * Las claves declaradas como **constante del módulo**, con el archivo.
   *
   * `const` con o sin `export`, a diferencia de como lo pedía B-821. Exportarla no
   * agrega ninguna garantía —lo que hace segura a la clave es que sea un literal
   * fijo en un solo lugar— y exigirlo forzaría cinco `export` que nadie importa.
   * Tres de las ocho son privadas del módulo hoy (`PREFIJO_SECCION`,
   * `CLAVE_RECARGA`, `CLAVE_PERFIL`) y está bien que lo sean.
   */
  const declaradas = (): { clave: string; archivo: string }[] =>
    conAlmacenamiento().flatMap((archivo) => {
      const src = sinComentarios(fuente(archivo));
      return [
        ...src.matchAll(/(?:export )?const [A-Z_][A-Z0-9_]* = '(agenda[-:][^']*)'/g),
      ].map((m) => ({ clave: m[1]!, archivo }));
    });

  /** Las filas de la tabla «Las marcas, una por una» de `07-seguridad.md`. */
  const enLaDoc = (): string[] => {
    const doc = fuente('docs/07-seguridad.md');
    const desde = doc.indexOf('### Las marcas, una por una');
    expect(desde, 'se fue la tabla de marcas de 07-seguridad.md').toBeGreaterThan(-1);
    const hasta = doc.indexOf('\nPor qué no es una salida nueva', desde);
    return [...doc.slice(desde, hasta).matchAll(/^\| `(agenda[-:][^`]*)`/gm)].map((m) => m[1]!);
  };

  it('hay marcas que barrer, y módulos que las tocan (control positivo)', () => {
    // Sin esto, un barrido que dejara de encontrar archivos pasaría contra listas
    // vacías y este bloque entero no verificaría nada.
    expect(conAlmacenamiento().length).toBeGreaterThanOrEqual(8);
    expect(declaradas().length).toBeGreaterThanOrEqual(8);
    expect(enLaDoc().length).toBeGreaterThanOrEqual(8);
  });

  it('cada clave del código está en la tabla de la doc', () => {
    /*
     * El sentido que importa: la marca **nueva**. Sin esta afirmación, agregar una
     * clave no obliga a decidir si lo que guarda es una marca o contenido — y «nadie
     * lo decidió» es la causa raíz, no un pendiente.
     */
    const documentadas = new Set(enLaDoc());
    const sinDocumentar = declaradas()
      .filter(({ clave }) => !documentadas.has(clave))
      .map(({ clave, archivo }) => `${clave} (${archivo})`);
    expect(
      sinDocumentar,
      'marcas del navegador que no están en la tabla de `07-seguridad.md`: hay que ' +
        'decidir si lo que guardan es una marca o contenido (§5.1, D-122)',
    ).toEqual([]);
  });

  it('y cada fila de la tabla sigue existiendo en el código', () => {
    // El otro sentido: una fila que quedó de una marca que se borró es doc que
    // afirma algo falso, y encima infla la cuenta del control positivo.
    const enElCodigo = new Set(declaradas().map(({ clave }) => clave));
    expect(
      enLaDoc().filter((c) => !enElCodigo.has(c)),
      'la tabla nombra marcas que ya no existen',
    ).toEqual([]);
  });

  it('ningún archivo arma la clave en el lugar donde la usa', () => {
    /*
     * La clave tiene que estar **declarada** como constante del módulo, no escrita
     * al lado del `setItem`. No es cosmético: una clave inline no se puede nombrar
     * en la doc ni casar con la tabla, así que se escapa del barrido de arriba — y
     * un barrido que se puede esquivar sin querer no es una red.
     */
    const conInline = conAlmacenamiento().filter((archivo) => {
      const src = sinComentarios(fuente(archivo));
      return /\.(getItem|setItem|removeItem)\(\s*'/.test(src);
    });
    expect(
      conInline,
      'la clave va en una constante exportada del módulo, no al lado del `setItem`',
    ).toEqual([]);
  });
});
