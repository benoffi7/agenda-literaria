/**
 * §4.2 — normalización de taxonomías.
 * Sin esto, en tres meses hay "A la gorra", "a la gorra ", "A la Gorra"
 * y "Gorra" como cuatro opciones distintas.
 *
 * ── Por qué esto es `.mjs` y no `.ts` (B-919) ─────────────────────────────
 * Porque **dos scripts de node lo necesitan** —`set-admin-claim.mjs`, que
 * slugifica la ciudad del claim, y `sembrar-ciudades.mjs`, que la slugifica en
 * el documento— y node no corre TypeScript. Con una copia en cada script, el
 * permiso del publicador por ciudad dependería de que tres funciones normalicen
 * igual para siempre: es exactamente la clase de B-88 (la misma pregunta
 * contestada por dos derivaciones que se separan sin que nada falle), y acá el
 * síntoma sería el peor de todos, **un permiso que no matchea y nadie entiende
 * por qué**.
 *
 * `src/lib/slugify.ts` sigue existiendo y reexporta esto, así que los ~veinte
 * `import { slugify } from '@/lib/slugify'` del panel y del sitio no cambian.
 * Es el mismo reparto que `@calendario`: una implementación, dos runtimes.
 *
 * @param {string} s
 * @returns {string}
 */
export const slugify = (s) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    /*
     * **Escapes y no los caracteres combinantes literales**, que es como quedó
     * escrito en el primer borrador de este archivo y lo cobró el
     * `auditor-privacidad`: `/[̀-ͯ]/` funciona igual y lleva **dos marcas
     * invisibles** adentro de la clase, así que un copy-paste, un merge o
     * cualquier herramienta que normalice el archivo apaga el borrado de acentos
     * **en silencio** — y el síntoma sería el que este módulo existe para evitar:
     * «Córdoba» slugificada distinto en el claim y en el documento, o sea «no hay
     * actividades de tu ciudad» en vez de «no tenés permiso».
     */
    .replace(/[\u0300-\u036f]/g, '') // saca acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
