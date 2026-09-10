/**
 * **El archivo sin sus comentarios** — el saneador que usan los tests que
 * afirman sobre el fuente.
 *
 * ── De dónde viene, porque el motivo original ya no existe ────────────────
 * Nació como la mitad pura de la huella de auditoría (B-794): el sello que
 * decidía si un cambio ya había pasado por el `auditor-privacidad` se calculaba
 * sobre el **código** y no sobre el archivo, porque los hallazgos del auditor
 * aterrizan como un docblock **en el archivo auditado**, y hashear el archivo
 * entero hacía que aplicar la corrección invalidara el sello y volviera a pedir
 * la misma auditoría. Era la clase de B-180 —un gate que falla por su propia
 * plomería enseña a saltearlo— y se arregló sacando los comentarios de la cuenta.
 *
 * **Ese sello se eliminó con D-560**, junto con todo el disparo automático de
 * los auditores: hoy corren solo a pedido, por el skill `/audit`. Así que
 * `huellaDeAuditoria` se fue con él y quedó esto, que sigue teniendo un uso
 * propio y bien vivo: `tests/guardas-de-los-scripts.test.ts` y los demás tests
 * sobre fuente necesitan distinguir **lo que el código hace** de **lo que un
 * comentario dice que hace**. Un docblock que nombra la función que el test
 * busca alcanza para que un chequeo de presencia pase con el cuerpo vacío.
 *
 * El módulo se llamaba `huella-de-auditoria.mjs`; se renombró al renombrar lo
 * que hace. Un archivo con el nombre de un mecanismo que ya no existe es el
 * drift que este repo persigue en la doc, y vale igual para el código.
 *
 * ── Cuál es el lado seguro del error, que cambió con el consumidor ─────────
 * Mientras esto calculaba una huella, equivocarse **borrando de más** era
 * gratis: se volvía a pedir la auditoría y listo. Por eso el docblock viejo
 * prometía que «se audita de más y nunca de menos».
 *
 * **Como saneador de un barrido sobre el fuente esa promesa está al revés, y no
 * hay un único lado seguro.** Los consumidores piden las dos direcciones:
 *
 * | El consumidor pregunta | Borrar de más | Dejar residuo de comentario |
 * |---|---|---|
 * | `not.toContain('online.url')` (barrido de privacidad) | **pasa sin mirar nada** | falla, y alguien mira |
 * | `toContain('setVistaDelPanel')` (chequeo de presencia) | falla, y alguien mira | **pasa con el cuerpo vacío** |
 *
 * O sea que no alcanza con elegir una dirección: **hay que no equivocarse**. Lo
 * que sí se puede elegir es qué pasa en el caso que igual se escape, y ahí el
 * criterio es el de la tabla de `docs/05-patrones.md` §«Verificar la clase»:
 * dejar residuo es un error **acotado** al comentario que lo produjo, y borrar
 * código es un error **sin cota** —B-853 se llevó 34.459 de los 41.363
 * caracteres de `Buscador.tsx`, o sea el 83%, y con ellos `export function
 * Buscador`—. Cuando haya que apostar, se apuesta al residuo.
 */

/**
 * Los tokens que el recorrido reconoce, **en un solo barrido de izquierda a
 * derecha**. Lo que se conserva y lo que se borra sale de cuál de estas
 * alternativas ganó en cada posición.
 *
 * `RegExp#exec` con `g` devuelve siempre la coincidencia **más a la izquierda**,
 * así que la alternativa que abre primero se lleva su interior entero: el `/*`
 * escrito adentro de un `//` nunca se ve como apertura de bloque, el `//`
 * escrito adentro de un `/* … *\/` nunca se ve como comentario de línea, y el
 * `//` de un string nunca se ve, punto. **Ese es el arreglo estructural** — ver
 * el bloque de abajo.
 *
 * Las comillas simples y dobles **no cruzan el salto de línea** a propósito: un
 * apóstrofo suelto en prosa de markup no puede así abrir un «string» que se
 * coma medio archivo; en el peor caso conserva de más una línea, que es el lado
 * acotado del error.
 */
const TOKENS = new RegExp(
  [
    '<!--[\\s\\S]*?-->', // comentario de markup (`.astro`)
    '/\\*[\\s\\S]*?\\*/', // bloque
    '(?<!:)//[^\\n]*', // línea — el `(?<!:)` es para no comerse el `https://`
    '"(?:\\\\[^\\n]|[^"\\\\\\n])*"',
    "'(?:\\\\[^\\n]|[^'\\\\\\n])*'",
    '`(?:\\\\[\\s\\S]|[^`\\\\])*`',
  ].join('|'),
  'g',
);

/**
 * El archivo **sin comentarios y sin espacios de más**.
 *
 * Cubre las cuatro sintaxis que aparecen en la lista de disparadores:
 * `{/* … *\/}` de JSX **como unidad** —sacando solo el interior quedan las llaves
 * sueltas, y dos llaves son un cambio de código—, `/* … *\/`, `//`, y
 * `<!-- -->` del markup de `.astro`.
 *
 * ── Por qué es un recorrido y no cuatro `replace` — B-853 ──────────────────
 * Antes eran cuatro `String#replace` globales, cada uno rebarriendo el archivo
 * entero. Ese diseño tiene un agujero **de familia**, no un caso: cada pasada
 * ve como apertura algo que vive adentro de otra construcción, y una apertura
 * falsa con `[\s\S]*?` no se detiene donde debería sino en el próximo cierre
 * que haya en el archivo. Salieron tres instancias de la misma familia:
 *
 * 1. Un `/*` adentro de un `//` abría un bloque. Pasó en `firestore.rules`
 *    (`// … escribir en /opciones/*, …`) y se llevó **quince cláusulas** de una
 *    regla de seguridad. Se «arregló» invirtiendo el orden de dos pasadas.
 * 2. Un `//` adentro de un `/* … *\/` dejaba el bloque sin cerrar. Quedaba
 *    residuo, que es el lado acotado, así que se documentó como aceptable.
 * 3. **B-853:** el patrón de JSX era `\{\s*\/\*[\s\S]*?\*\/\s*\}`, y ese `\s*`
 *    hace que `interface Props {` seguido del docblock de su primera propiedad
 *    sea una apertura válida. Como el cierre exige `*\/` **pegado a** `}`, la
 *    búsqueda no para en el `*\/` del docblock: sigue hasta el primer `*\/}` del
 *    archivo, que en `Buscador.tsx` estaba 464 líneas más abajo.
 * 4. Un `//` o un `*\/` adentro de un **string** se leía como comentario. Estaba
 *    escrito como aceptable —«se equivoca del lado seguro»— y para un barrido de
 *    privacidad ese lado es el inseguro.
 *
 * Invertir el orden arregló (1) y no tocó (3) ni (4), porque el problema nunca
 * fue el orden: era que **cada pasada arranca de cero sobre un texto que la
 * anterior ya reinterpretó**. Un solo recorrido con `TOKENS` cierra la familia
 * entera: en cada posición gana una construcción, se consume completa, y el
 * barrido sigue **después** de ella. Un `replace` más habría tapado (3) y dejado
 * abierta (4).
 *
 * ── Lo que sigue sin cubrir, y por qué no es un parser ─────────────────────
 * **No lexea literales de expresión regular.** Distinguir `/…/` de una división
 * necesita saber qué token vino antes, y eso ya es la mitad de un parser de
 * JavaScript — que además no serviría para los otros dos lenguajes que pasan por
 * acá (`.astro` y `firestore.rules`, que no son JS). Así que un `//` o un `/*`
 * escrito adentro de una expresión regular se lee como comentario y borra de
 * más.
 *
 * Eso no se deja librado a la suerte: `tests/sin-comentarios.test.ts` corre un
 * barrido sobre **todos** los `.ts`/`.tsx`/`.mjs`/`.js` del repo comparando
 * contra el **parser** de TypeScript, y falla si el saneador borra un
 * identificador que el parser dice que es código. El día que alguien escriba esa expresión regular, el test
 * se pone rojo y viene a decidir acá — que es exactamente lo que B-853 no tuvo.
 */
export const sinComentarios = (texto) => {
  let salida = '';
  let ultimo = 0;
  let m;
  TOKENS.lastIndex = 0;

  while ((m = TOKENS.exec(texto)) !== null) {
    const token = m[0];
    // Los strings se conservan tal cual: es lo que hace que un `//` o un `*/`
    // escrito adentro de uno no se lea como comentario.
    if (token[0] === '"' || token[0] === "'" || token[0] === '`') continue;

    let inicio = m.index;
    let fin = TOKENS.lastIndex;

    // `{/* … */}` de JSX **como unidad**. Se exige el `{` y el `}` **pegados**,
    // sin espacio en el medio: así se escriben los comentarios de JSX en este
    // repo, y así un `{ /* nada */ }` —un objeto vacío con una nota adentro— no
    // pierde las llaves. El `*/` que se mira es el del propio comentario, no
    // «el próximo del archivo»: el token ya vino delimitado.
    if (token.startsWith('/*') && texto[inicio - 1] === '{' && texto[fin] === '}') {
      inicio -= 1;
      fin += 1;
      TOKENS.lastIndex = fin;
    }

    salida += texto.slice(ultimo, inicio);
    ultimo = fin;
  }

  return (salida + texto.slice(ultimo)).replace(/\s+/g, ' ').trim();
};
