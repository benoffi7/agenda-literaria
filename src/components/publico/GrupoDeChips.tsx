/**
 * Un eje de filtro: `fieldset` + `legend` + los chips — B-227.
 *
 * **Los chips son `<button aria-pressed>`, no `div`s con `onClick`** (§10 del
 * diseño): así los anuncia un lector de pantalla como «Taller, botón de
 * alternancia, no presionado», y así funcionan con Enter y con barra
 * espaciadora sin que haya que escribir nada.
 *
 * **Las flechas mueven el foco dentro del grupo**, y la aritmética es la de
 * `lib/foco.ts` —la misma que ya usan el menú «⋯» del listado y la capa del
 * centro de ayuda (B-14, B-64)—: dónde cae el foco al pasar del último y qué
 * tecla mueve a dónde son exactamente las dos cosas que es fácil escribir mal dos
 * veces. Acá se importa `indiceDeTecla` y lo único propio es llamar a `focus()`,
 * que es la parte que necesita el `ref`.
 *
 * Tab sigue funcionando como siempre: `indiceDeTecla` devuelve `null` para
 * cualquier tecla que no sea de navegación, y eso es lo que le dice a este
 * componente que **no** llame a `preventDefault()`.
 */
import { useRef } from 'react';
import { indiceDeTecla } from '@/lib/foco';
import type { Chip } from '@/lib/listadoPublico';

interface Props {
  leyenda: string;
  chips: Chip[];
  onAlternar: (valor: string) => void;
}

const base =
  'inline-flex min-h-touch shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento';
const apagado = `${base} border-borde bg-white/60 text-tinta/75 hover:border-tinta/30`;
const encendido = `${base} border-acento bg-acento/10 font-medium text-acento`;

export function GrupoDeChips({ leyenda, chips, onAlternar }: Props) {
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
      <legend className="mb-1.5 text-xs font-semibold tracking-wide text-tinta/65 uppercase">
        {leyenda}
      </legend>
      {/*
        Una fila con scroll horizontal y no cuatro filas de chips comiéndose la
        pantalla (§8). `-mx-1 px-1` para que el anillo de foco del primer chip no
        quede cortado por el `overflow`.
      */}
      <div
        role="group"
        aria-label={leyenda}
        className="-mx-1 flex flex-wrap gap-2 overflow-x-auto px-1 pb-1"
      >
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
            {chip.label}
            {/*
              El número no se lee como parte del nombre del chip: «Taller 12»
              suena a un taller número 12. Va aparte y con su propio texto para
              lector de pantalla.
            */}
            <span aria-hidden="true" className="text-xs text-tinta/65">
              {chip.cantidad}
            </span>
            <span className="sr-only">{`, ${chip.cantidad} ${chip.cantidad === 1 ? 'actividad' : 'actividades'}`}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
