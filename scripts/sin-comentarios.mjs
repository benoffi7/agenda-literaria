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
 */
/**
 * El archivo **sin comentarios y sin espacios de más**.
 *
 * Cubre las cuatro sintaxis que aparecen en la lista de disparadores:
 * `{/* … *\/}` de JSX **como unidad** —sacando solo el interior quedan las llaves
 * sueltas, y dos llaves son un cambio de código—, `/* … *\/`, `//`, y
 * `<!-- -->` del markup de `.astro`. El `//` se pide precedido de algo que no sea `:` para no comerse el
 * `https://` de una URL.
 *
 * **No pretende ser un parser**, y no hace falta que lo sea: si alguna vez se le
 * pasa un `//` que estaba adentro de un string, el resultado es que la huella
 * cambia cuando no debía y el aviso vuelve. Es el lado seguro del error — se
 * audita de más, nunca de menos.
 */
export const sinComentarios = (texto) =>
  texto
    // `{/* … */}` **primero y como unidad**: sacando solo el `/* … */` de adentro
    // quedan las llaves sueltas, y dos llaves son un cambio de código. Lo agarró
    // el caso del markup — `Buscador.tsx` está en la lista de disparadores y
    // comenta así.
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    /*
     * **El `//` va ANTES del `/* … *\/`, y el orden es el arreglo de un bug que
     * se comía código** — B-830.
     *
     * Estaba al revés, y con eso un `/*` escrito **adentro de un comentario de
     * línea** abría un bloque que corría hasta el próximo `*\/` del archivo. En
     * `firestore.rules` pasó exactamente eso: el comentario
     * `// … escribir en /opciones/*, que es de lectura pública` se comió
     * **quince cláusulas** de `propuestaValida()`, o sea de una regla de
     * seguridad. Y el barrido que consumía esto —la comparación de cotas de
     * `propuestas.test.ts`— habría pasado **sin mirar nada** si la lista de
     * esperadas hubiera sido más corta.
     *
     * **Esto invierte el argumento del docblock de arriba.** «No pretende ser un
     * parser… es el lado seguro del error, se audita de más y nunca de menos» era
     * cierto cuando esto calculaba una huella (B-794): sacar de más solo hacía
     * pedir la auditoría otra vez. Como saneador de un barrido sobre el fuente,
     * sacar de más significa **auditar de menos**, que es el lado inseguro.
     *
     * Con el `//` primero, el caso simétrico —un `//` adentro de un `/* … *\/`—
     * cae del lado seguro: deja un `/*` sin cerrar como residuo, y un residuo
     * hace fallar un barrido, no pasarlo.
     */
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
