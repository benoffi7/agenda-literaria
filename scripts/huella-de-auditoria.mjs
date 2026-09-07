/**
 * **La huella que decide si un cambio ya pasó por el `auditor-privacidad`** — la
 * mitad pura de `hook-auditores.mjs`, separada acá para que tenga tests.
 *
 * El sello del hook guarda una huella por auditor; mientras la huella del árbol
 * de trabajo coincida con la sellada, no hay nada nuevo que auditar. Lo que
 * sigue es **qué entra en esa huella**, que es toda la decisión.
 *
 * ── El código, no el archivo — B-794 ──────────────────────────────────────
 * Se hashea el contenido de cada archivo disparador **sin sus comentarios**,
 * porque el orden natural del trabajo es: hacer el cambio, correr el auditor, y
 * **aplicar sus hallazgos** — que es para lo que se lo corrió. Y sus hallazgos
 * aterrizan una y otra vez como un docblock **en el archivo auditado**:
 * «escribí al lado de la decisión por qué esto no sale».
 *
 * Con la huella sobre el archivo entero, aplicar la corrección invalidaba el
 * sello y el commit se bloqueaba otra vez. O sea que el único camino en que el
 * sello servía era «auditar y no cambiar nada» —el caso en que el auditor no
 * encontró nada—; en cuanto encontraba algo, el caso útil, había que gastar la
 * auditoría de nuevo (unos 176 mil tokens, medidos) o saltearla. Es la clase de
 * B-180 con otra cara: el gate fallando por su propia plomería, que es lo que
 * enseña a saltearlo.
 *
 * **Y es seguro por construcción: un comentario no puede publicar un campo.** Lo
 * que el hook cuida es que el código no filtre nada a una salida pública, y el
 * texto de un docblock no llega a ninguna. Cualquier cambio real —una línea de
 * código, un campo nuevo, una interpolación— mueve la huella igual que antes.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * La huella de un conjunto de archivos disparadores.
 *
 * Se lee del disco y no con `git hash-object` porque hay que mirar el contenido
 * para sacarle los comentarios; leer sirve igual para un archivo modificado y
 * para uno nuevo sin rastrear, que es justo lo que `git diff` no cubre. Un
 * archivo que no se puede leer —borrado— entra como literal, así que borrar una
 * salida pública **sí** mueve la huella.
 *
 * Se ordena antes de unir: el orden en que `git status` lista los archivos no
 * puede cambiar la huella.
 */
export const huellaDeAuditoria = (raiz, rutas) => {
  const partes = rutas.map((ruta) => {
    try {
      const codigo = sinComentarios(readFileSync(join(raiz, ruta), 'utf8'));
      return `${createHash('sha256').update(codigo).digest('hex')} ${ruta}`;
    } catch {
      return `borrado ${ruta}`;
    }
  });
  return createHash('sha256').update(partes.sort().join('\n')).digest('hex').slice(0, 16);
};
