import { useEffect, useId, useRef, useState } from 'react';
import { claseBotonFila, claseBotonMenu } from '@/components/admin/campos/Campo';
import { indiceDeTecla } from '@/lib/foco';

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
 *
 * **Teclado (B-14).** Antes los ítems eran alcanzables con Tab y nada más, así
 * que el menú se comportaba como tres botones sueltos que aparecen: Tab desde el
 * último se iba a la fila siguiente del listado, y al cerrar con `Escape` el
 * foco quedaba en la nada. Ahora implementa el patrón de menú de ARIA — ↓/↑ con
 * vuelta, `Home`/`End`, el foco entra al abrirse y **vuelve al "⋯" al cerrar**.
 * Sin lo último, cerrar con `Escape` obligaba a re-tabular el listado entero
 * para volver a la fila donde se estaba.
 *
 * La aritmética del foco vive en `src/lib/foco.ts` y la comparte con la capa del
 * centro de ayuda, que tenía el mismo patrón a medio hacer.
 */
export function MenuAcciones({ acciones, etiqueta }: Props) {
  const [abierto, setAbierto] = useState(false);
  /** Índice enfocado. `-1` = ninguno todavía (recién se abrió con el mouse). */
  const [enfocado, setEnfocado] = useState(-1);
  const contenedor = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  /**
   * Cerrar devolviendo el foco al "⋯". Se usa en todos los caminos de cierre
   * **menos** al elegir una acción: ahí la acción puede cambiar de vista, y
   * devolver el foco a un botón que está por desmontarse no sirve de nada.
   */
  const cerrarYVolverAlDisparador = () => {
    setAbierto(false);
    disparador.current?.focus();
  };

  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: PointerEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarYVolverAlDisparador();
    };
    document.addEventListener('pointerdown', afuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', afuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  // El foco sigue al índice, y no se setea en el `onKeyDown`: así el mismo
  // efecto cubre abrir con el teclado y moverse con las flechas.
  useEffect(() => {
    if (!abierto || enfocado < 0) return;
    items.current[enfocado]?.focus();
  }, [abierto, enfocado]);

  const abrir = (desde: number) => {
    setEnfocado(desde);
    setAbierto(true);
  };

  return (
    <div ref={contenedor} className="relative shrink-0">
      <button
        ref={disparador}
        type="button"
        onClick={() => (abierto ? setAbierto(false) : abrir(-1))}
        onKeyDown={(e) => {
          // Abrir con ↓ o ↑ y caer directo en el primero o en el último es lo
          // que hace que el menú se pueda usar sin sacar la mano del teclado.
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            abrir(e.key === 'ArrowDown' ? 0 : acciones.length - 1);
          }
        }}
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
          onKeyDown={(e) => {
            const destino = indiceDeTecla(e.key, enfocado, acciones.length);
            if (destino === null) return;
            // Solo se frena la tecla que se usa: Tab y Escape siguen andando.
            e.preventDefault();
            setEnfocado(destino);
          }}
          className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-borde bg-white p-1 shadow-lg"
        >
          {acciones.map((a, i) => (
            <button
              key={a.label}
              ref={(el) => {
                items.current[i] = el;
              }}
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
