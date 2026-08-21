import { useEffect, useId, useRef, useState } from 'react';
import { claseBotonFila, claseBotonMenu } from '@/components/admin/campos/Campo';

export interface Accion {
  label: string;
  onSelect: () => void;
  /** Acción destructiva: se pinta con el acento y se separa del resto. */
  peligrosa?: boolean;
}

interface Props {
  acciones: Accion[];
  /** Para el lector de pantalla: "Más acciones de «Taller de crónica»". */
  etiqueta: string;
}

/**
 * Menú de acciones de una fila del listado.
 *
 * Existe por el layout angosto: el listado es tarjeta en mobile y fila desde
 * `sm`, y meter "Editar", "Duplicar" y "Borrar" en fila deja blancos de ~100px
 * en 360px, donde se erra el toque. Con el menú, la fila conserva dos blancos
 * (Editar y "⋯") y de paso "Borrar" queda detrás de un toque deliberado, en
 * lugar de pegado a "Editar".
 *
 * Sin dependencias nuevas: el panel no tiene librería de UI.
 */
export function MenuAcciones({ acciones, etiqueta }: Props) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: PointerEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('pointerdown', afuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', afuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        className={`${claseBotonFila} text-tinta/60 hover:bg-black/5 ${abierto ? 'bg-black/5' : ''}`}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {abierto && (
        <div
          id={id}
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-borde bg-white p-1 shadow-lg"
        >
          {acciones.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              onClick={() => {
                // Se cierra antes de actuar: la acción puede cambiar de vista y
                // dejar el menú abierto colgado en la pantalla siguiente.
                setAbierto(false);
                a.onSelect();
              }}
              className={`${claseBotonMenu} ${
                a.peligrosa ? 'text-acento hover:bg-acento/10' : 'hover:bg-black/5'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
