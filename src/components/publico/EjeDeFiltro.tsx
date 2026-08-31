/**
 * Un eje de filtro, con el aspecto del **índice de un libro** — B-227, rehecho
 * en B-260 (D-146). Sustituye a `GrupoDeChips.tsx`.
 *
 * ── Lo que cambió, y lo que no se tocó ────────────────────────────────────
 * Cambió **la piel**: donde había una fila de píldoras redondeadas con scroll
 * horizontal, ahora hay una lista vertical de filas separadas por reglas finas,
 * con el valor a la izquierda y su número a la derecha — «una barra de índice:
 * una lista persistente de categorías, con el aspecto del índice de un libro».
 * Radio 0, ninguna sombra.
 *
 * **No cambió nada de cómo funciona**, y eso importa: la referencia dibuja los
 * filtros como `<a href="#">`, o sea decorativos, y los de verdad son controles
 * con estado, multi-selección y conteo por faceta. Se conservan enteros:
 *
 * - **Los valores son `<button aria-pressed>`, no `div`s con `onClick`** (§10 del
 *   diseño): así los anuncia un lector de pantalla como «Taller, botón de
 *   alternancia, no presionado», y así funcionan con Enter y con barra
 *   espaciadora sin que haya que escribir nada.
 * - **Las flechas mueven el foco dentro del grupo**, con la aritmética de
 *   `lib/foco.ts` —la misma que ya usan el menú «⋯» del listado y la capa del
 *   centro de ayuda (B-14, B-64)—: dónde cae el foco al pasar del último y qué
 *   tecla mueve a dónde son exactamente las dos cosas que es fácil escribir mal
 *   dos veces.
 * - **El número de cada faceta** se sigue contando con los demás filtros puestos
 *   y éste no (ver `chipsDe`), que es lo que permite sumar un segundo valor del
 *   mismo eje.
 *
 * Tab sigue funcionando como siempre: `indiceDeTecla` devuelve `null` para
 * cualquier tecla que no sea de navegación, y eso es lo que le dice a este
 * componente que **no** llame a `preventDefault()`.
 *
 * ── El valor elegido va con la tinta plena, y eso está medido ─────────────
 * B-227 lo pintaba `bg-acento/10 text-acento`, que sobre la superficie hundida
 * daba **4,38:1** —por debajo del piso AA de 4,5— y se veía perfecto: el modo de
 * falla de B-235. La fila llena (`bg-acento` con `text-papel`) da **6,33:1**
 * porque el fondo deja de participar, y encima es lo que el sistema pide: «el
 * activo va con fondo primary y texto on-primary».
 *
 * El desplazamiento de 4px del elegido (`translate-x-1`) es del sistema y **no es
 * una sombra**: no simula luz, corre la fila fuera del margen como una entrada
 * marcada a mano en un índice.
 */
import { foco } from '@/components/sitio/estilos';
import { useRef } from 'react';
import { indiceDeTecla } from '@/lib/foco';
import type { Chip } from '@/lib/listadoPublico';

interface Props {
  leyenda: string;
  chips: Chip[];
  onAlternar: (valor: string) => void;
}

/**
 * La fila del índice. `justify-between` deja el número contra el margen derecho,
 * que es lo que hace que la columna de números se lea como una columna.
 */
const base = `label-caps flex min-h-touch w-full items-center justify-between gap-3 px-2 py-2 text-start transition-colors ${foco}`;
const apagado = `${base} text-tinta hover:bg-crema hover:text-acento`;
const encendido = `${base} translate-x-1 bg-acento text-papel`;

export function EjeDeFiltro({ leyenda, chips, onAlternar }: Props) {
  const botones = useRef<(HTMLButtonElement | null)[]>([]);

  if (chips.length === 0) return null;

  const alTeclado = (e: React.KeyboardEvent, i: number) => {
    const destino = indiceDeTecla(e.key, i, chips.length);
    if (destino === null) return;
    e.preventDefault();
    botones.current[destino]?.focus();
  };

  return (
    <fieldset className="min-w-0 border-0 p-0">
      {/*
        La leyenda del eje, en azul tinta y sobre una regla: es el título de una
        sección del índice. `regla-fina` y no un margen — la física del sistema es
        la regla, no el aire.
      */}
      <legend className="label-caps regla-fina mb-1 w-full pb-1 text-azul">{leyenda}</legend>

      <div role="group" aria-label={leyenda} className="flex flex-col">
        {chips.map((chip, i) => (
          <button
            key={chip.valor}
            ref={(el) => {
              botones.current[i] = el;
            }}
            type="button"
            aria-pressed={chip.elegido}
            onClick={() => onAlternar(chip.valor)}
            onKeyDown={(e) => alTeclado(e, i)}
            className={chip.elegido ? encendido : apagado}
          >
            <span className="min-w-0 truncate">{chip.label}</span>
            {/*
              El número no se lee como parte del nombre del valor: «Taller 12»
              suena a un taller número 12. Va aparte y con su propio texto para
              lector de pantalla. `tabular-nums` para que la columna no baile.
            */}
            <span aria-hidden="true" className="shrink-0 tabular-nums">
              {chip.cantidad}
            </span>
            <span className="sr-only">{`, ${chip.cantidad} ${chip.cantidad === 1 ? 'actividad' : 'actividades'}`}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
