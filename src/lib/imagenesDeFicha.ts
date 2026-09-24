/**
 * **La galería de una ficha de la Guía, como sale al sitio** — B-907.
 *
 * Una sola función para los cuatro directorios (librerías, bibliotecas,
 * suscripciones, lugares). Hasta B-907 eran cuatro copias idénticas, una por
 * `*Publica.ts`, que es exactamente la clase de B-88: la quinta pregunta sobre
 * una imagen escrita a mano se separa de las otras sin que nada se ponga rojo.
 *
 * ── Qué garantiza, fila por fila ─────────────────────────────────────────
 * Una regla de Firestore **no itera una lista**: de `imagenes` la regla acota la
 * cantidad (4) y el tipo (`is list`), no la forma de cada elemento. Así que lo
 * que sale al sitio lo decide esto, y no se confía en el documento:
 *
 * | Campo | Qué pasa |
 * |---|---|
 * | `url` | `imagenesPublicables` + `urlSegura`: solo `http(s)`; la fila que no pasa **se descarta** |
 * | `epigrafe` | una cadena o `''` — un mapa o un número no llega a la página |
 * | `ancho`, `alto` | un entero positivo o `null` — van a un `width`/`height` y al JSON |
 * | `storagePath`, `id`, `textoAlternativo`, `origen`, `portada` | **no salen**: whitelist |
 *
 * La portada se busca **después** de filtrar, por lo mismo que en
 * `imagenesDeDetalle`: una portada con la URL rota no puede dejar la ficha sin
 * imagen habiendo otras sanas. Y va primera, que es el orden que las cuatro
 * páginas y sus JSON-LD ya esperaban.
 *
 * ── Hoy un anónimo no llega hasta acá, y esto no depende de eso ───────────
 * Las cuatro reglas exigen `d.origen == 'panel' || d.imagenes.size() == 0`: una
 * ficha que llega de `/guia/<x>/sumar` nace **sin** fotos, y `origen: 'panel'`
 * está atado a `esAdmin()`. Si esa cláusula se aflojara —B-924 quiere fotos en el
 * alta pública—, lo que llega a la página sigue siendo esto.
 *
 * Es puro: lo importan las proyecciones, que corren en el build.
 */
import { imagenesPublicables, portadaDe } from '@/lib/imagenes';
import { urlSegura } from '@/lib/enlaceSeguro';

/** Una imagen de una ficha de la Guía, lista para la página y el JSON. */
export interface ImagenDeFichaPublica {
  /** Ya saneada con `urlSegura`: lo que no era `http(s)` no llegó hasta acá. */
  url: string;
  epigrafe: string;
  ancho: number | null;
  alto: number | null;
}

/** La fila tal como puede venir del documento: nada de su forma está garantizado. */
interface FilaDeDocumento {
  url: string;
  epigrafe?: unknown;
  ancho?: unknown;
  alto?: unknown;
  portada?: unknown;
}

const dimension = (n: unknown): number | null =>
  typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;

const epigrafe = (e: unknown): string => (typeof e === 'string' ? e : '');

export const imagenesDeFichaPublica = (
  imagenes: readonly FilaDeDocumento[] | null | undefined,
): ImagenDeFichaPublica[] => {
  /*
   * `Array.isArray` y no `?? []`: la regla dice `is list`, pero un documento
   * escrito por un script o anterior al campo puede no tenerlo, y `imagenes: {}`
   * haría tirar al `.filter` de adentro, o sea el build entero.
   */
  const filas = Array.isArray(imagenes)
    ? imagenes.filter((i) => i && typeof i === 'object' && typeof i.url === 'string')
    : [];
  const sanas = imagenesPublicables(filas);
  // `portadaDe` y no un `find` propio: «cuál es la portada» tiene una sola
  // derivación en el proyecto, y la tipa `Imagen` solo por su firma.
  const portada = portadaDe(sanas as never[]) as FilaDeDocumento | null;
  const ordenadas = portada ? [portada, ...sanas.filter((i) => i !== portada)] : sanas;
  return ordenadas.map((i) => ({
    url: urlSegura(i.url)!,
    epigrafe: epigrafe(i.epigrafe),
    ancho: dimension(i.ancho),
    alto: dimension(i.alto),
  }));
};
