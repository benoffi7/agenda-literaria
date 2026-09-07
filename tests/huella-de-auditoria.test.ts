/**
 * **La huella que decide si un cambio ya pasó por el `auditor-privacidad`** —
 * B-794.
 *
 * El hook de B-124/D-350 frena el `git commit` cuando el diff toca una salida
 * pública y el auditor no corrió, y lo sabe comparando una huella. Lo que este
 * archivo verifica es **qué entra en esa huella**, que es toda la decisión:
 *
 * - **el código sí** — cualquier cambio real vuelve a pedir la auditoría;
 * - **los comentarios no** — porque los hallazgos del auditor aterrizan como
 *   docblocks **en el archivo auditado**, y con la huella sobre el archivo
 *   entero aplicar la corrección invalidaba el sello y el commit se bloqueaba
 *   otra vez. El único camino en que el sello servía era «auditar y no cambiar
 *   nada», o sea el caso en que el auditor no encontró nada. Es la clase de
 *   B-180: un gate que falla por su propia plomería enseña a saltearlo.
 *
 * Y es seguro por construcción: **un comentario no puede publicar un campo**. Lo
 * que el hook cuida es que el código no filtre a una salida pública, y el texto
 * de un docblock no llega a ninguna.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { huellaDeAuditoria, sinComentarios } from '../scripts/huella-de-auditoria.mjs';

/** Un directorio nuevo por caso: la huella se calcula leyendo del disco. */
const carpeta = (): string => mkdtempSync(join(tmpdir(), 'huella-'));

const con = (raiz: string, nombre: string, contenido: string): string => {
  writeFileSync(join(raiz, nombre), contenido);
  return nombre;
};

describe('qué NO mueve la huella: los comentarios — B-794', () => {
  it('agregar un docblock al archivo auditado no invalida el sello', () => {
    /*
     * **El caso por el que este archivo existe**, y es el escenario literal que
     * se vivió cerrando B-791: el auditor pidió escribir al lado de la decisión
     * por qué un campo no sale, se escribió, y el commit se bloqueó de nuevo
     * pidiendo la misma auditoría — que cuesta unos 176 mil tokens.
     */
    const raiz = carpeta();
    const ruta = con(raiz, 'toPublic.ts', "export const toPublic = (a) => ({ titulo: a.titulo });\n");
    const antes = huellaDeAuditoria(raiz, [ruta]);

    con(
      raiz,
      'toPublic.ts',
      [
        '/**',
        ' * Lo que el auditor pidió escribir: `searchText` no sale, y el motivo.',
        ' */',
        'export const toPublic = (a) => ({ titulo: a.titulo }); // ni un campo más',
      ].join('\n'),
    );

    expect(huellaDeAuditoria(raiz, [ruta]), 'un comentario movió la huella').toBe(antes);
  });

  it('ni sacar uno, ni reindentar, ni cambiar los saltos de línea', () => {
    // El corolario: la huella es del código y no del formato. Un `prettier` que
    // pase por encima de una salida pública no vuelve a pedir la auditoría.
    const raiz = carpeta();
    const ruta = con(raiz, 'a.ts', "// viejo\nexport const x = 1;\nexport const y = 2;\n");
    const antes = huellaDeAuditoria(raiz, [ruta]);

    con(raiz, 'a.ts', 'export const x = 1;\n\n\n    export const y = 2;');
    expect(huellaDeAuditoria(raiz, [ruta])).toBe(antes);
  });

  it('los comentarios de JSX y de markup tampoco, que son los de las otras salidas', () => {
    /*
     * `Buscador.tsx` y `AvisoDeCookies.astro` están en la lista de disparadores,
     * y sus comentarios no son `/* *\/` de TypeScript: son `{/* *\/}` y
     * `<!-- -->`. Sin esto, el arreglo valdría para la mitad de los archivos.
     */
    const raiz = carpeta();
    const ruta = con(raiz, 'AvisoDeCookies.astro', '<p>Usamos Google Analytics.</p>\n');
    const antes = huellaDeAuditoria(raiz, [ruta]);

    con(
      raiz,
      'AvisoDeCookies.astro',
      '<!-- el motivo de esta frase -->\n<p>Usamos Google Analytics.</p>\n{/* y esto también */}',
    );
    expect(huellaDeAuditoria(raiz, [ruta])).toBe(antes);
  });
});

describe('qué SÍ mueve la huella: cualquier cambio de código', () => {
  it('un campo nuevo en la proyección', () => {
    /*
     * El control que sostiene todo lo de arriba. Si esto pasara, el arreglo de
     * B-794 habría convertido el hook en un cartel: el peor resultado posible,
     * porque el commit pasaría en silencio.
     */
    const raiz = carpeta();
    const ruta = con(raiz, 'toPublic.ts', 'export const toPublic = (a) => ({ titulo: a.titulo });\n');
    const antes = huellaDeAuditoria(raiz, [ruta]);

    con(raiz, 'toPublic.ts', 'export const toPublic = (a) => ({ titulo: a.titulo, url: a.online.url });\n');
    expect(huellaDeAuditoria(raiz, [ruta]), 'un campo nuevo NO movió la huella').not.toBe(antes);
  });

  it('un archivo disparador más, aunque no haya cambiado ninguno', () => {
    // Tocar una segunda salida pública es un cambio que hay que auditar, incluso
    // si la primera quedó igual.
    const raiz = carpeta();
    const uno = con(raiz, 'toPublic.ts', 'export const toPublic = (a) => a;\n');
    const dos = con(raiz, 'eventsJson.ts', 'export const construirIndice = (x) => x;\n');
    expect(huellaDeAuditoria(raiz, [uno, dos])).not.toBe(huellaDeAuditoria(raiz, [uno]));
  });

  it('borrar una salida pública', () => {
    // Un archivo que no se puede leer entra como literal `borrado`, así que
    // borrar una salida mueve la huella en vez de dejarla igual.
    const raiz = carpeta();
    const ruta = con(raiz, 'cartelera.ts', 'export const cartelera = () => [];\n');
    const conArchivo = huellaDeAuditoria(raiz, [ruta]);
    expect(huellaDeAuditoria(raiz, ['no-existe.ts'])).not.toBe(conArchivo);
  });

  it('y el orden en que se listan los archivos NO la mueve', () => {
    // `git status` no garantiza un orden, y la huella no puede depender de él:
    // si dependiera, el aviso volvería solo, que es la forma de que se ignore.
    const raiz = carpeta();
    const uno = con(raiz, 'a.ts', 'export const a = 1;\n');
    const dos = con(raiz, 'b.ts', 'export const b = 2;\n');
    expect(huellaDeAuditoria(raiz, [uno, dos])).toBe(huellaDeAuditoria(raiz, [dos, uno]));
  });
});

describe('el saneador de comentarios no se pasa de listo', () => {
  it('no se come el `//` de una URL', () => {
    // El error clásico de este regex, y acá tendría consecuencia: las salidas
    // públicas están llenas de URLs (`urlDeCafecito`, el canónico, el sitemap).
    expect(sinComentarios("const u = 'https://agendaleh.ar/apoyar';")).toContain(
      'https://agendaleh.ar/apoyar',
    );
  });

  it('y cuando se equivoca, se equivoca del lado seguro', () => {
    /*
     * Un `//` adentro de un string sí se lo come, y eso está aceptado y escrito:
     * el resultado es que **la huella cambia cuando no debía** y el aviso vuelve.
     * Se audita de más, nunca de menos. El caso lo fija para que nadie lo lea
     * como un bug y lo «arregle» con un parser que sí pueda callar el aviso.
     */
    expect(sinComentarios("const u = 'a // b';")).toBe("const u = 'a");
  });
});
