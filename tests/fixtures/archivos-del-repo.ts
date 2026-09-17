/**
 * Los archivos de este repo, rastreados y sin rastrear — B-964, cierra la
 * clase que dejó abierta B-826.
 *
 * ~30 barridos de este repo enumeran el árbol para verificar que ningún
 * archivo de tal carpeta hace tal cosa. Todos copiaban el mismo
 * `execFileSync('git', ['ls-files', prefijo])` a mano, y eso lista solo lo
 * **rastreado**. Un archivo recién creado —el caso normal mientras se
 * trabaja, antes del `git add`— quedaba afuera del barrido, así que el
 * chequeo daba verde justo en la corrida en la que más falta hacía.
 *
 * Pasó dos veces con la misma forma: primero en `tests/agentes-y-skills.test.ts`
 * (B-826, el skill `/audit` de D-560 con YAML inválido que nadie vio), después
 * en `tests/listado-del-sitio.test.ts` (B-964, el componente nuevo de B-961 que
 * el `auditor-privacidad` encontró sin cubrir). Las dos veces el arreglo fue el
 * mismo par de banderas, escrito a mano cada vez. Esta es la única
 * implementación: lo que la use no puede volver a nacer sin ellas.
 *
 * `--cached` es lo rastreado; `--others --exclude-standard` es lo no
 * rastreado y no ignorado. Se combinan, se deduplican y se ordenan, así el
 * resultado no depende de en qué mitad apareció cada archivo. Usa `-z`
 * (separador NUL) en vez de partir por `\n`, para no romperse con un nombre
 * de archivo con espacios.
 */
import { execFileSync } from 'node:child_process';

/**
 * Lista los archivos del repo bajo uno o más prefijos de ruta (relativos a la
 * raíz del repo). Sin prefijos, lista el árbol entero. Cada elemento es la
 * ruta tal como la devuelve git, relativa a la raíz del repo.
 */
export const archivosDelRepo = (...prefijos: string[]): string[] => {
  const listar = (args: string[]): string[] =>
    execFileSync('git', ['ls-files', '-z', ...args, ...prefijos], { encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);

  return [
    ...new Set([...listar(['--cached']), ...listar(['--others', '--exclude-standard'])]),
  ].sort();
};
