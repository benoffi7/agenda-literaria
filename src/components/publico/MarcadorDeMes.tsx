/**
 * El **marcador de mes** — «SEPTIEMBRE» en la display a 72px con una regla
 * gruesa debajo. B-260, extraído a su propio archivo en B-113.
 *
 * Es el gesto más fuerte del sistema visual y la única cosa del sitio que va a
 * `display-lg`: no es un separador decorativo, es lo que convierte una lista de
 * 38 fechas en un **programa**. Por eso el nombre del sitio, que en la
 * referencia iba al mismo cuerpo, bajó un escalón (ver `Encabezado`).
 *
 * ── Por qué es un componente y no dos markups iguales ─────────────────────
 * Lo dibujan dos lugares: los separadores del listado agrupado y el encabezado
 * de una **página de mes** (`/agenda/2026-09`), donde la lista entera es un solo
 * grupo. Escrito dos veces queda idéntico hoy y distinto el día que se toque
 * uno: la regla en un lado y no en el otro, el año en versalitas acá y en cuerpo
 * allá. Es la clase de B-88 aplicada al ritmo vertical, y solo se ve abriendo
 * las dos páginas al lado.
 *
 * ── Siempre `h2`, y no es una limitación ──────────────────────────────────
 * Sus dos usos cuelgan del `h1` de su página —el de la home y el de la página de
 * mes—, así que el nivel correcto es el mismo en los dos y no hay nada que
 * elegir. Que sea un `h2` de verdad y no un `div` con estilo es lo que hace
 * navegable la página con lector de pantalla, y es lo mismo que lee el buscador
 * (§10). Los títulos de cada fila son `h3` y cuelgan de éste, sin saltos.
 *
 * ── El año va aparte y chico ──────────────────────────────────────────────
 * «SEPTIEMBRE DE 2026» a 72px no entra en un teléfono y encima agranda el dato
 * que menos importa: casi siempre es el año corriente. El corte lo hace
 * `partesDeMes`, que sale de las partes de `Intl` y no de partir la cadena ya
 * formateada — que es lo que se rompe el día que cambie el formato del idioma.
 *
 * El año **no** lleva `aria-hidden`: es parte del nombre del grupo, y quien
 * escucha la página necesita saber de qué año se habla tanto como quien lo ve.
 *
 * ── La regla va en el encabezado, no en un `<hr>` ─────────────────────────
 * Es el borde de abajo del marcador, así que no puede quedar separada de él.
 */
import { partesDeMes } from '@/lib/fechasPublicas';

interface Props {
  /** La clave del mes, `2026-09`. */
  clave: string;
  /** El `id` al que apunta el `aria-labelledby` de la sección que encabeza. */
  id: string;
}

export function MarcadorDeMes({ clave, id }: Props) {
  const { mes, anio } = partesDeMes(clave);

  return (
    <h2 id={id} className="regla-gruesa flex items-baseline justify-between gap-4 pb-2">
      <span className="display-lg text-acento">{mes}</span>
      {anio && <span className="label-caps shrink-0 text-super">{anio}</span>}
    </h2>
  );
}
