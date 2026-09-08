import {
  ETIQUETA_VISTA_DEL_PANEL,
  QUE_HACE_LA_VISTA,
  VISTAS_DEL_PANEL,
  type VistaDelPanel,
} from '@/lib/vistaDelPanel';

interface Props {
  vista: VistaDelPanel;
  onCambiar: (vista: VistaDelPanel) => void;
}

/**
 * El interruptor «PC / Celular» — B-814.
 *
 * ── Por qué vive en la cabecera del panel y no en el formulario ───────────
 * Decisión del dueño sobre las tres alternativas: **es una preferencia, y una
 * preferencia se busca donde están las preferencias.** La cabecera se ve en todas
 * las pantallas (es el mismo argumento de D-61 para el botón de ayuda), así que
 * también es el único lugar desde el que se puede cambiar sin haber entrado a una
 * actividad — y quien abre el panel en el teléfono quiere elegir **antes** de
 * empezar a cargar, no en medio.
 *
 * La contra asumida: para cambiarla con el formulario abierto hay que mirar arriba
 * de todo. Se aceptó porque es una elección que se hace una vez y se recuerda; si
 * resultara que se cambia seguido, el atajo en la barra de guardar es la tercera
 * alternativa que quedó escrita.
 *
 * ── Por qué dos botones y no un `<select>` ni una casilla ─────────────────
 * Son dos opciones excluyentes y las dos tienen que estar **a la vista**: el valor
 * de este control es que se vea cuál está activa sin abrirlo. Un `<select>` de dos
 * opciones esconde la mitad, y una casilla («¿vista de celular?») obliga a inferir
 * qué pasa cuando está desmarcada.
 *
 * Va como `radiogroup` y no como dos `button`: es una elección entre alternativas,
 * y así las flechas del teclado la recorren sola. `aria-checked` es lo que lee el
 * lector de pantalla; el color es la mitad visual del mismo estado, nunca la única
 * (§ contraste, B-235/B-243).
 */
export function InterruptorDeVista({ vista, onCambiar }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Forma del formulario de carga"
      className="flex shrink-0 items-center rounded-md border border-borde bg-white p-0.5"
    >
      {VISTAS_DEL_PANEL.map((v) => {
        const activa = v === vista;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={activa}
            title={QUE_HACE_LA_VISTA[v]}
            onClick={() => onCambiar(v)}
            className={`min-h-touch rounded px-2.5 text-xs ${
              activa ? 'bg-tinta font-medium text-papel' : 'text-tinta/55 hover:bg-black/5'
            }`}
          >
            {ETIQUETA_VISTA_DEL_PANEL[v]}
          </button>
        );
      })}
    </div>
  );
}
