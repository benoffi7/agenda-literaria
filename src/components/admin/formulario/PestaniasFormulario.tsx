/**
 * La fila de solapas del formulario de carga.
 *
 * Pedido del dueño: «que sean tabs y con la barra de guardar siempre visible
 * como ahora». Las pestañas y su agrupación viven en `lib/formulario/pestanias.ts`
 * —derivadas del registro de secciones— y acá queda solo cómo se ven y cómo se
 * manejan con el teclado.
 *
 * ── Tres cosas que este componente hace y no son decoración ───────────────
 *
 * 1 · **El número de campos pendientes en cada solapa.** Es la mitad que hace
 *     que las pestañas no escondan nada: con todo apilado, un campo que falta se
 *     encontraba scrolleando; con nueve pestañas, ocho están fuera de la
 *     pantalla. Sin el número, «no se puede publicar» no diría dónde mirar.
 *
 * 2 · **Es un `tablist` de verdad, no botones que cambian un `useState`.** Con
 *     los roles y `aria-selected`, un lector de pantalla anuncia «Dónde,
 *     pestaña, 3 de 9» y sabe que hay un panel asociado. Y **solo la
 *     seleccionada es una parada de Tab** (`tabIndex`), que es lo que evita que
 *     alguien tenga que pasar por nueve solapas para llegar al primer campo del
 *     formulario: se entra con Tab y se recorre con las flechas, que es el
 *     patrón que el resto del panel ya usa.
 *
 * 3 · **Las flechas usan la aritmética de `lib/foco.ts`** (B-14/B-64), la misma
 *     del menú «⋯», la capa de ayuda y los chips de filtro. Dónde cae el foco al
 *     pasar de la última es exactamente lo que se escribe mal la segunda vez.
 *
 * La fila es **pegajosa arriba** (`sticky top-0`): cambiar de sección no puede
 * costar un scroll hasta arriba, y en un teléfono la fila de nueve solapas se
 * desplaza horizontalmente en vez de partirse en tres renglones —una solapa que
 * se mueve de lugar cuando cambia el ancho no se aprende nunca—.
 */
import { useRef } from 'react';
import { indiceDeTecla } from '@/lib/foco';
import { PESTANIAS, type IdPestania } from '@/lib/formulario/pestanias';

/** El `id` del botón de una solapa. Lo usa el panel para su `aria-labelledby`. */
export const idDeSolapa = (id: IdPestania): string => `solapa-${id}`;
/** El `id` del panel de una pestaña. Lo usa la solapa para su `aria-controls`. */
export const idDePanel = (id: IdPestania): string => `panel-${id}`;

interface Props {
  activa: IdPestania;
  onCambiar: (id: IdPestania) => void;
  /** Cuántos campos pendientes tiene cada pestaña (`faltantesPorPestania`). */
  pendientes: Readonly<Partial<Record<IdPestania, number>>>;
}

/*
 * **La solapa activa se marca con una regla, no con una hoja blanca.** La
 * tentación era el gesto clásico de pestaña —fondo blanco y el borde de abajo
 * abierto, como si la solapa y el panel fueran la misma hoja— y acá no se sostiene:
 * los paneles del panel de carga no son una hoja, son **tarjetas** con su propio
 * borde y su radio (`Seccion`). Una solapa que se abre hacia un panel que no
 * existe se ve como un borde suelto.
 *
 * Así que la marca es una regla de 2px abajo, que es el mismo recurso que usa la
 * navegación del sitio: la regla **marca** y no simula una superficie. Y va con
 * `font-medium` además del color, para que la activa no dependa solo de la tinta.
 */
const base =
  'flex min-h-touch shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm transition-colors';
const apagada = `${base} border-transparent text-tinta/60 hover:border-borde hover:text-tinta`;
const encendida = `${base} border-acento font-medium text-tinta`;

export function PestaniasFormulario({ activa, onCambiar, pendientes }: Props) {
  const botones = useRef<(HTMLButtonElement | null)[]>([]);

  const alTeclado = (e: React.KeyboardEvent, i: number) => {
    const destino = indiceDeTecla(e.key, i, PESTANIAS.length);
    if (destino === null) return;
    e.preventDefault();
    /*
     * Se mueve el foco **y** se cambia de pestaña. Es el patrón de activación
     * automática, y corresponde acá porque cambiar de solapa no cuesta nada: no
     * hay una carga ni una escritura detrás, son paneles que ya están montados.
     */
    const siguiente = PESTANIAS[destino]!;
    onCambiar(siguiente.id);
    botones.current[destino]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Secciones del formulario"
      className="sticky top-0 z-20 flex gap-0.5 overflow-x-auto border-b border-borde bg-papel/95 backdrop-blur"
    >
      {PESTANIAS.map((pestania, i) => {
        const seleccionada = pestania.id === activa;
        const faltan = pendientes[pestania.id] ?? 0;
        return (
          <button
            key={pestania.id}
            ref={(el) => {
              botones.current[i] = el;
            }}
            type="button"
            role="tab"
            id={idDeSolapa(pestania.id)}
            aria-selected={seleccionada}
            aria-controls={idDePanel(pestania.id)}
            tabIndex={seleccionada ? 0 : -1}
            onClick={() => onCambiar(pestania.id)}
            onKeyDown={(e) => alTeclado(e, i)}
            className={seleccionada ? encendida : apagada}
          >
            {pestania.titulo}
            {faltan > 0 && (
              <>
                {/*
                  El número va con su propio texto para lector de pantalla: un
                  «3» pegado al nombre se lee «Dónde 3», que suena a la sección
                  número 3 y no a tres campos pendientes.
                */}
                <span
                  aria-hidden="true"
                  className="rounded-full bg-acento px-1.5 text-[11px] leading-5 text-white tabular-nums"
                >
                  {faltan}
                </span>
                <span className="sr-only">{`, ${faltan} ${faltan === 1 ? 'campo pendiente' : 'campos pendientes'}`}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
