import {
  ETIQUETA_FORMATO_DE_HORA,
  FORMATOS_DE_HORA,
  QUE_HACE_EL_FORMATO,
  type FormatoDeHora,
} from '@/lib/formatoDeHora';

interface Props {
  formato: FormatoDeHora;
  onCambiar: (formato: FormatoDeHora) => void;
  /**
   * **Con la vista en `celular` el control propio no se dibuja** (D-720), así
   * que el interruptor no promete algo que no va a pasar: se muestra atenuado y
   * dice por qué. Esconderlo sería peor — quien lo usó ayer en la compu lo
   * buscaría hoy en el teléfono y concluiría que se rompió.
   *
   * Atenuado quiere decir borde punteado, fondo gris y la opción elegida en
   * gris en vez de en tinta plena — B-1750. No `opacity-55`: se multiplicaba
   * con el `text-tinta/65` de las opciones.
   */
  inerte?: boolean;
}

/**
 * El interruptor «24 h / AM/PM» — B-889, **D-720**.
 *
 * Gemelo del de B-814 y en el mismo lugar por el mismo argumento del dueño: es
 * una **preferencia**, y una preferencia se busca donde están las preferencias.
 * La cabecera se ve en todas las pantallas, así que se puede elegir antes de
 * entrar a cargar y no en medio de un formulario.
 *
 * Va como `radiogroup` por lo mismo que aquél: son dos opciones excluyentes y
 * las dos tienen que verse sin abrir nada. `aria-checked` es lo que lee el
 * lector de pantalla; el color es la mitad visual del mismo estado, nunca la
 * única (§ contraste, B-235/B-243).
 *
 * ── La consecuencia de `localStorage`, dicha y no implícita ───────────────
 * D-720 pide que se diga en la pantalla que la preferencia es **de este
 * navegador**: quien carga desde la compu y desde el teléfono la elige dos
 * veces, y un incógnito la pierde. Va en el `title` del grupo —que es donde
 * cabe— y con todas las letras en la ayuda del panel, que es donde alguien va a
 * buscar por qué se le «borró».
 */
export function InterruptorDeFormato({ formato, onCambiar, inerte = false }: Props) {
  const porQueInerte = 'En la vista de celular las horas se cargan con el control del teléfono.';
  return (
    <div
      role="radiogroup"
      aria-label="Formato de las horas al cargar"
      title={
        (inerte ? `${porQueInerte} ` : '') +
        'La preferencia es de este navegador: en otra computadora se elige de nuevo.'
      }
      className={`flex shrink-0 items-center rounded-md border border-borde p-0.5 ${
        inerte ? 'border-dashed bg-black/[0.03]' : 'bg-white'
      }`}
    >
      {FORMATOS_DE_HORA.map((f) => {
        const activo = f === formato;
        return (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={activo}
            title={QUE_HACE_EL_FORMATO[f]}
            onClick={() => onCambiar(f)}
            className={`min-h-touch rounded px-2.5 text-xs ${
              activo
                ? inerte
                  ? 'bg-black/10 font-medium text-tinta'
                  : 'bg-tinta font-medium text-papel'
                : 'text-tinta/65 hover:bg-black/5'
            }`}
          >
            {ETIQUETA_FORMATO_DE_HORA[f]}
          </button>
        );
      })}
    </div>
  );
}
