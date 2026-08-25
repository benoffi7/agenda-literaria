/**
 * Lista de texto libre, editada como chips (B-133).
 *
 * La lógica vive en `@/lib/formulario/chips`, que es puro y está testeado; acá
 * queda solo el teclado y el pintado. Ver ahí por qué esto no es `TagsInput`.
 */
import { useState } from 'react';
import { claseInput } from '@/components/admin/campos/Campo';
import { agregarChips, quitarChip, traeSeparador } from '@/lib/formulario/chips';

interface Props {
  value: string[];
  onChange: (valores: string[]) => void;
  placeholder?: string;
  /** Para el `aria-label` del botón de cada chip: "Quitar @casabrandon". */
  etiquetaQuitar?: (chip: string) => string;
}

export function ChipsInput({ value, onChange, placeholder, etiquetaQuitar }: Props) {
  const [texto, setTexto] = useState('');

  const confirmar = (entrada: string) => {
    const proximos = agregarChips(value, entrada);
    if (proximos.length !== value.length) onChange(proximos);
    setTexto('');
  };

  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((chip, i) => (
            <li
              key={`${chip}-${i}`}
              className="flex items-center gap-1 rounded-full border border-borde bg-white px-2 py-0.5 text-xs"
            >
              <span className="max-w-40 truncate">{chip}</span>
              <button
                type="button"
                onClick={() => onChange(quitarChip(value, i))}
                aria-label={etiquetaQuitar?.(chip) ?? `Quitar ${chip}`}
                className="text-tinta/45 hover:text-tinta"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        className={claseInput}
        value={texto}
        placeholder={placeholder}
        onChange={(e) => {
          // Escribir la coma confirma en lugar de dejarla en el texto. Antes el
          // `split`/`join` en cada tecla se comía la coma en el momento de
          // tipearla, así que no había forma de cargar un segundo handle.
          if (traeSeparador(e.target.value)) confirmar(e.target.value);
          else setTexto(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Sin esto Enter envía el `<form>`: el campo está adentro, así que
            // confirmar un handle intentaba guardar la actividad entera.
            e.preventDefault();
            confirmar(texto);
            return;
          }
          if (e.key === 'Backspace' && texto === '' && value.length > 0) {
            onChange(quitarChip(value, value.length - 1));
          }
        }}
        // Salir del campo con algo escrito lo confirma: es lo que espera quien
        // tipea y pasa al campo siguiente sin tocar Enter.
        onBlur={() => texto.trim() && confirmar(texto)}
      />
    </div>
  );
}
