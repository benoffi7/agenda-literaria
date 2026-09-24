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
 *
 * ── Lo que sí se congela: el corpus — B-1147 ──────────────────────
 * Su gemelo de los `B-` congela la **lista de huérfanos**; acá eso no se puede,
 * por lo de arriba. Lo que sí se puede fijar, y es lo que este archivo suma, es
 * **qué archivos mira el barrido**. Hasta el 2026-09-22 miraba 27 `.md` con un
 * motivo escrito que sonaba razonable —«los enlaces resuelven a un ancla solo en
 * `docs/`»— y por eso nadie lo revisó: D-400 y D-401, citadas doce veces desde
 * `src/` y `tests/`, **no podían aparecer** en el informe, y las tres `.md` de
 * D-88 escondían otras catorce. Un encogimiento así no rompe nada visible: el
 * barrido sigue corriendo, sigue informando, y lo único que cambia es lo que
 * deja de ver. Los casos de `el corpus` son la única forma de que eso dé rojo.
 *
 * **Este archivo queda fuera del corpus a propósito** (`AFUERA` en el script).
 * Sus controles positivos tienen que citar decisiones inventadas —`D-999` es
 * literalmente el caso que hay que ejercitar— así que barrerlo haría que el
 * chequeo se reporte a sí mismo para siempre.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EXTENSIONES as EXTENSIONES_DEL_GEMELO } from '../scripts/items-referenciados.mjs';
import {
  EXTENSIONES,
  decisionesEscritas,
  esProsa,
  huerfanas,
  otraGrafia,
  referenciasDe,
  relevar,
  seBarre,
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

  it('cada entrada tiene la forma canónica de un id de decisión', () => {
    expect(decisionesEscritas(registro).every((d) => /^D-\d+$/.test(d))).toBe(true);
  });

  /**
   * **La red contra `## D-` duplicadas, que ya existía y nadie veía** — B-1128.
   *
   * Este aserto está acá desde el 2026-09-03 y es exactamente la guarda que
   * hacía falta: el 2026-09-17 dos frentes escribieron dos decisiones distintas
   * con el número **D-730**, tomando «la siguiente libre» sin poder ver la del
   * otro, y si las dos hubieran llegado al archivo este caso se ponía rojo
   * nombrando el número.
   *
   * **Lo que falló no fue la red: fue su nombre.** Vivía dentro de un `it`
   * llamado «las entradas leídas están en orden y sin repetir formatos raros»,
   * que no dice lo que verifica y además promete un orden que nadie chequea —ni
   * existe: hay 16 decisiones fuera de orden numérico en el archivo—. Dos
   * documentos distintos concluyeron leyéndolo que la unicidad **no** estaba
   * cubierta: el ítem B-1128 («valida el formato, no su unicidad») y la propia
   * D-740 («nada detecta dos `## D-` repetidos»). Los dos se corrigieron al
   * medirlo.
   *
   * Es D-750 con el signo cambiado: allá una red que parece red y no verifica
   * nada; acá una red que verifica y **no parece**. El daño es el mismo — se
   * escribe dos veces o no se escribe— y la causa también: afirmar cobertura
   * sin medirla.
   *
   * MUTACIÓN PROBADA: agregar un `## D-740 · …` al final de
   * `docs/06-decisiones.md` deja este caso en rojo diciendo «expected 205 to be
   * 206».
   */
  it('ningún número de decisión está escrito dos veces — B-1128', () => {
    const escritas = decisionesEscritas(registro);
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
    expect(sueltas).toEqual([
      { decision: 'D-99', archivos: ['docs/a.md', 'docs/b.md'], desdeCodigo: [] },
    ]);
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

  it('el cero a la izquierda no hace huérfana a una decisión escrita', () => {
    /*
     * **La sexta «huérfana» de B-910 era esto.** El registro escribe las nueve
     * primeras con cero (`## D-09`) y de `D-10` en adelante ninguna lo lleva, así
     * que comparar cadenas reportaba `D-9` como una decisión que nadie escribió
     * teniendo su entrada ahí. Y el daño no es solo el ruido: una lista de
     * huérfanas con una entrada falsa es una lista que se aprende a no mirar, que
     * es el modo de falla de B-180 aplicado a un informe en vez de a un gate.
     *
     * Las dos direcciones, porque la cita puede venir escrita de cualquiera de
     * las dos formas y el registro también puede cambiar de convención.
     */
    expect(huerfanas({ 'docs/a.md': 'ver D-9' }, ['D-09'])).toEqual([]);
    expect(huerfanas({ 'docs/a.md': 'ver D-09' }, ['D-9'])).toEqual([]);
  });
});

describe('las citadas con otra grafía', () => {
  it('se informan aparte, con la grafía que el registro usa', () => {
    // No es una huérfana —la decisión existe— pero `#d-9` no resuelve a
    // `## D-09`, así que si la cita fuera un enlace habría que corregirla.
    expect(otraGrafia({ 'docs/a.md': 'ver D-9', 'docs/b.md': 'ver D-9' }, ['D-09'])).toEqual([
      { citada: 'D-9', escrita: 'D-09', archivos: ['docs/a.md', 'docs/b.md'], desdeCodigo: [] },
    ]);
  });

  it('una cita con la misma grafía que el encabezado no se informa', () => {
    // El control que evita que esta lista se vuelva todo el registro.
    expect(otraGrafia({ 'docs/a.md': 'ver D-09 y D-100' }, ['D-09', 'D-100'])).toEqual([]);
  });

  it('una decisión que no existe es huérfana y no un problema de grafía', () => {
    // La separación entre las dos listas, atada: `D-99` no está escrita de
    // ninguna forma, así que sale por la puerta que pide escribir la decisión.
    expect(otraGrafia({ 'docs/a.md': 'ver D-99' }, ['D-09'])).toEqual([]);
    expect(huerfanas({ 'docs/a.md': 'ver D-99' }, ['D-09'])).toEqual([
      { decision: 'D-99', archivos: ['docs/a.md'], desdeCodigo: [] },
    ]);
  });
});

/**
 * **El corpus: el repo entero, no solo `docs/`** — B-1147.
 *
 * Lo que estos casos fijan es lo único de este barrido que se puede poner rojo
 * sin depender de si hay una tanda en vuelo: **qué archivos mira**. Un barrido
 * que se encoge no falla —sigue corriendo, sigue informando, sigue en verde— y
 * lo único que cambia es lo que deja de ver. Así estuvo desde que nació hasta el
 * 2026-09-22: `D-88` se reportaba nombrando tres `.md` y se la cita desde
 * dieciocho archivos, y D-400/D-401 no aparecían nunca.
 *
 * Por eso los asertos son sobre **la forma** del corpus —que incluya código, que
 * excluya lo que tiene que excluir— y no sobre un número de archivos, que sube
 * con cada commit y haría que este archivo pida mantenimiento sin dar
 * información.
 *
 * MUTACIONES PROBADAS (D-750 — una red que no se probó mutando no se sabe si
 * verifica algo). Las seis se aplicaron al script, se vio el rojo y se
 * revirtieron:
 *
 * 1. volver `relevar` a `docs/` (`.filter((a) => a.startsWith('docs/'))`) → rojo
 *    en «barre el código» y en «sin disco»;
 * 2. sacar este archivo de `AFUERA` → rojo en «el archivo que prueba este
 *    barrido queda afuera»;
 * 3. sacar `REGISTRO` de `AFUERA` → rojo en «el registro no se barre a sí mismo»
 *    y en «sin disco»;
 * 4. `esProsa` devolviendo siempre `true` → rojo en «separa las citas de código»
 *    y en «sin disco»;
 * 5. sacar `.rules` de `EXTENSIONES` → rojo en «la lista de extensiones es
 *    blanca»;
 * 6. `seBarre` sin el filtro de extensiones (lista negra pura) → rojo en tres;
 * 7. sacar el propio script de `AFUERA` → rojo en «no se cuenta a sí mismo»;
 * 8. volver a declarar una `EXTENSIONES` local, aunque sea idéntica → rojo en
 *    «la lista de extensiones es la misma del gemelo».
 *
 * **Y lo que estos casos NO cubren, dicho para que no se lea de más** (del
 * `auditor-trampas`): los tres que verifican `seBarre(x) === false` sobre un
 * archivo de `AFUERA` se satisfacen **igual con `EXTENSIONES` vacía**, porque
 * `AFUERA.has(archivo)` corta el `&&` antes de mirar la extensión. El único
 * aserto que denuncia el colapso del corpus es el `length > 100` del primer
 * caso. No es un agujero —está cubierto— pero si algún día ese primer caso se
 * afloja, los tres de `AFUERA` seguirían en verde sin cubrir nada.
 */
describe('el corpus — B-1147', () => {
  it('barre el código, que es donde una decisión se cita de verdad', () => {
    const { corpus } = relevar();
    expect(corpus.some((a) => a.startsWith('src/')), 'sin `src/` no se ve un docblock').toBe(true);
    expect(corpus.some((a) => a.startsWith('tests/')), 'sin `tests/` no se ve un `describe`').toBe(
      true,
    );
    expect(corpus.some((a) => a.startsWith('scripts/')), 'sin `scripts/` no se ve D-88').toBe(true);
    expect(corpus.some((a) => a.startsWith('docs/')), 'y la prosa sigue adentro').toBe(true);
    // Eran 27 cuando miraba solo los `.md` de `docs/`. El número exacto sube con
    // cada commit; lo que no puede es volver a ese orden de magnitud.
    expect(corpus.length).toBeGreaterThan(100);
  });

  it('el registro no se barre a sí mismo: se cita entero', () => {
    expect(seBarre('docs/06-decisiones.md')).toBe(false);
  });

  it('el archivo que prueba este barrido queda afuera, o no puede quedar limpio nunca', () => {
    /*
     * La excepción está en el script y el motivo vive en los dos lados: los
     * controles positivos de este archivo citan decisiones inventadas a
     * propósito —`D-999` en la cabecera, `D-99999` y `D-88888` acá abajo, `D-99`
     * en el cruce—, que es literalmente el caso que hay que ejercitar. Sin esta
     * exclusión, el informe reportaría para siempre una huérfana que es este
     * archivo haciendo su trabajo — que es la forma en que una lista deja de
     * mirarse (B-180 aplicado a un informe). Misma excepción que
     * `scripts/items-referenciados.mjs` le hace a la suya.
     */
    expect(seBarre('tests/decisiones-referenciadas.test.ts')).toBe(false);
  });

  it('la lista de extensiones es blanca: el binario no entra y el formato raro sí', () => {
    // `.rules` y `.sh` citan decisiones en comentarios y entran a mano; una
    // imagen nueva queda afuera sin que nadie tenga que acordarse de excluirla.
    expect(seBarre('firestore.rules')).toBe(true);
    expect(seBarre('scripts/mail-de-aviso.sh')).toBe(true);
    expect(seBarre('src/components/sitio/Encabezado.astro')).toBe(true);
    expect(seBarre('public/og.png')).toBe(false);
    expect(seBarre('package-lock.json')).toBe(false);
  });

  it('separa las citas de código de las de prosa, que es lo que ordena el informe', () => {
    /*
     * El caso caro, y el que B-1147 midió: un docblock manda a buscar una
     * decisión que nadie escribió. Sin esta marca las dieciocho citas de `D-88`
     * se leen como una sola línea de ruido.
     */
    expect(esProsa('docs/BACKLOG.md')).toBe(true);
    expect(esProsa('src/lib/tortaDelPanel.ts')).toBe(false);

    const sueltas = huerfanas(
      { 'src/lib/cualquiera.ts': '// el motivo está en D-99999\n', 'docs/a.md': 'ver D-99999' },
      [],
    );
    expect(sueltas).toEqual([
      {
        decision: 'D-99999',
        archivos: ['docs/a.md', 'src/lib/cualquiera.ts'],
        desdeCodigo: ['src/lib/cualquiera.ts'],
      },
    ]);
  });

  it('el barrido no se cuenta a sí mismo entre los citantes de su propio ejemplo', () => {
    /*
     * **La cabecera del script nombra `D-88`, que estuvo huérfana hasta B-1330** — es el caso
     * que midió B-1147 y sin nombrarlo la explicación no explica nada. Con el
     * corpus abierto eso hizo que el script apareciera como un archivo más
     * «citando D-88 desde el código», que es justo lo que el informe mide para
     * decir cuán caro sale el hueco: dieciocho archivos donde en realidad son
     * diecisiete. Lo encontró el `auditor-trampas`, y es la trampa que el gemelo
     * ya tenía documentada en `expandir()` («se reportó a sí mismo al
     * escribirlo»).
     *
     * Desde B-1330 D-88 está escrita, así que el caso ya no se puede medir
     * sobre el repo real —la huérfana no existe y el aserto pasaba vacío
     * (B-1350)—: se mide sobre un corpus armado, con una huérfana de mentira
     * citada desde el script y desde un módulo.
     *
     * MUTACIÓN PROBADA: sacar el script de `AFUERA` deja este caso en rojo.
     */
    expect(seBarre('scripts/decisiones-referenciadas.mjs')).toBe(false);

    const contenido = {
      'docs/06-decisiones.md': '## D-01 · La primera\n',
      'scripts/decisiones-referenciadas.mjs': '/** el caso medido es D-77777 */\n',
      'src/lib/otro.ts': '/** ver D-77777 */\n',
    };
    const { sueltas } = relevar({
      archivos: Object.keys(contenido),
      leer: (a) => contenido[a as keyof typeof contenido],
    });
    expect(
      sueltas.find((s) => s.decision === 'D-77777')?.archivos,
      'el barrido se cuenta a sí mismo entre los citantes',
    ).toEqual(['src/lib/otro.ts']);
  });

  it('la lista de extensiones es la misma del gemelo, no una copia — clase D-88', () => {
    /*
     * **Copiar la lista para arreglar un corpus desalineado lo deja listo para
     * volver a desalinearse**, que es B-1147 visto desde el otro lado: la
     * primera versión de este cambio tenía las diecisiete extensiones escritas
     * dos veces, byte a byte, y nada las ataba. Hoy `EXTENSIONES` se importa de
     * `items-referenciados.mjs` y se reexporta, así que este caso no compara dos
     * listas: comprueba que sean **el mismo objeto**, que es lo único que un
     * `.mdx` agregado de un solo lado no puede saltear.
     *
     * MUTACIÓN PROBADA: volver a declarar una `EXTENSIONES` propia en
     * `decisiones-referenciadas.mjs` —aunque sea idéntica— deja este caso en
     * rojo.
     */
    expect(EXTENSIONES).toBe(EXTENSIONES_DEL_GEMELO);
  });

  it('el relevamiento se puede ejercitar sin disco, con el lector inyectado', () => {
    /*
     * El control que hace que los casos de arriba signifiquen algo: si `relevar`
     * no cruzara nada, el corpus podría estar perfecto y el informe vacío.
     */
    const archivos = ['docs/06-decisiones.md', 'src/lib/algo.ts', 'public/x.png'];
    const contenido = {
      'docs/06-decisiones.md': '## D-01 · La primera\n\nrevisita D-99999\n',
      'src/lib/algo.ts': '/** ver D-01 y D-88888 */\n',
      'public/x.png': 'no se lee',
    };
    const { escritas, corpus, sueltas } = relevar({
      archivos,
      leer: (a) => contenido[a as keyof typeof contenido],
    });
    expect(escritas).toEqual(['D-01']);
    // El `.png` no entra, y el registro tampoco: `D-99999` está en su cuerpo y
    // no se reporta.
    expect(corpus).toEqual(['src/lib/algo.ts']);
    expect(sueltas).toEqual([
      { decision: 'D-88888', archivos: ['src/lib/algo.ts'], desdeCodigo: ['src/lib/algo.ts'] },
    ]);
  });
});
