/**
 * Un eje de filtro: `fieldset` + `legend` + los chips — B-227, restilado en B-247.
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
 *
 * ── El chip elegido va con el acento lleno, y eso está medido ─────────────
 * B-227 lo pintaba `bg-acento/10 text-acento`. Sobre la superficie `hondo` esa
 * combinación da **4,38:1**, por debajo del piso AA de 4,5 — y se ve perfecta, que
 * es el modo de falla de B-235 otra vez. El chip lleno (`bg-acento text-papel`) da
 * 5,59:1 sobre cualquier fondo, porque el fondo deja de participar. Lo verifica
 * `tests/tarjeta-del-listado.test.ts`.
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

const base =
  `inline-flex min-h-touch shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${foco}`;
const apagado = `${base} border-borde bg-hondo text-tinta/75 hover:border-acento hover:text-tinta`;
const encendido = `${base} border-acento-hondo bg-acento font-medium text-papel`;

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
      <legend className="mb-2 text-xs font-semibold tracking-[0.12em] text-tinta/70 uppercase">
        {leyenda}
      </legend>
      {/*
        En el teléfono, **una fila con scroll horizontal** y no cuatro filas de
        chips comiéndose la pantalla (§8): `flex-nowrap overflow-x-auto`. De `sm`
        en adelante hay ancho de sobra y conviene ver todos los chips a la vez,
        así que ahí sí envuelven — y `overflow-visible` para que el anillo de foco
        no quede recortado por un contenedor que ya no scrollea.

        `-mx-1 px-1` deja lugar al anillo de foco del primer chip, que con el
        `overflow` del teléfono se cortaría contra el borde.
      */}
      <div
        role="group"
        aria-label={leyenda}
        className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1.5 sm:flex-wrap sm:overflow-visible sm:pb-0"
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
            <span
              aria-hidden="true"
              className={chip.elegido ? 'text-xs text-papel' : 'text-xs text-tinta/70'}
            >
              {chip.cantidad}
            </span>
            <span className="sr-only">{`, ${chip.cantidad} ${chip.cantidad === 1 ? 'actividad' : 'actividades'}`}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
