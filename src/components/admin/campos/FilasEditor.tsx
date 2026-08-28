/**
 * El chasis compartido de los editores de filas del panel (B-224).
 *
 * `SesionesEditor` (§11) y `ModalidadesEditor` son la misma pantalla dos veces:
 * una lista numerada de filas con **id de cliente** (trampa 2), un botón para
 * agregar, «Duplicar» y «Borrar» por fila, el contador al costado, el estado
 * vacío y la línea de error del schema. Lo único distinto es el cuerpo de la
 * fila y las acciones extra de la barra.
 *
 * Se extrae en vez de copiarse porque dos listas con el cableado duplicado
 * terminan con el arreglo aplicado en una sola. Acá el
 * cableado —reemplazar, duplicar y borrar **siempre por id, nunca por índice**—
 * vive una vez, y una fila nueva no puede nacer con el bug de la otra.
 *
 * Lo que **no** entra acá y se queda en cada editor: todo lo propio de su
 * dominio (el generador de N encuentros, los saltos de fecha, el selector de
 * modalidad). Un chasis que intente cubrir eso deja de ser un chasis.
 */
import type { ReactNode } from 'react';
import { claseBotonFila, claseBotonTinta } from '@/components/admin/campos/Campo';

/** Lo mínimo que una fila tiene que tener para que este chasis la maneje. */
export interface FilaConId {
  id: string;
}

interface Props<T extends FilaConId> {
  filas: T[];
  onChange: (filas: T[]) => void;
  /** «encuentro» / «encuentros». Arma el botón, el contador y el estado vacío. */
  singular: string;
  plural: string;
  /** Una fila nueva. La llama el botón «+ Agregar …». */
  nueva: (filas: T[]) => T;
  /** La copia de una fila. Si no viene, no se ofrece «Duplicar». */
  duplicar?: (fila: T) => T;
  /**
   * Se avisa después de agregar, duplicar o borrar, con la cantidad resultante.
   * Es el punto por el que cada editor mide sus propias funciones (§9): el
   * chasis no importa la analítica.
   */
  alCambiarCantidad?: (accion: 'agregar' | 'duplicar' | 'borrar', cantidad: number) => void;
  /** Botones extra de la barra de arriba (generar, ordenar…). */
  acciones?: ReactNode;
  /** Debajo de la barra: paneles que el editor despliega (el generador). */
  bajoLaBarra?: ReactNode;
  /** El error del schema para la lista entera. */
  error?: string;
  /** Insignias al lado del número de fila (el «en Calendar» de una sesión). */
  insignias?: (fila: T) => ReactNode;
  /** Qué dice el `aria-label` del botón «Borrar» de esta fila. */
  etiquetaBorrar?: (fila: T, indice: number) => string;
  /** El cuerpo de la fila. `editar` reemplaza esa fila por id. */
  children: (fila: T, indice: number, editar: (cambios: Partial<T>) => void) => ReactNode;
  /** Clases extra del `<li>` (una sesión cancelada se atenúa). */
  claseFila?: (fila: T) => string;
}

export function FilasEditor<T extends FilaConId>({
  filas,
  onChange,
  singular,
  plural,
  nueva,
  duplicar,
  alCambiarCantidad,
  acciones,
  bajoLaBarra,
  error,
  insignias,
  etiquetaBorrar,
  children,
  claseFila,
}: Props<T>) {
  /** Reemplaza una fila por id, nunca por índice (trampa 2). */
  const reemplazar = (id: string, cambios: Partial<T>) =>
    onChange(filas.map((f) => (f.id === id ? { ...f, ...cambios } : f)));

  const agregar = () => {
    alCambiarCantidad?.('agregar', filas.length + 1);
    onChange([...filas, nueva(filas)]);
  };

  /** Borra por id, nunca por índice (trampa 2). */
  const borrar = (id: string) => {
    alCambiarCantidad?.('borrar', filas.length - 1);
    onChange(filas.filter((f) => f.id !== id));
  };

  const duplicarFila = (id: string) => {
    const f = filas.find((x) => x.id === id);
    if (!f || !duplicar) return;
    alCambiarCantidad?.('duplicar', filas.length + 1);
    onChange([...filas, duplicar(f)]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button type="button" onClick={agregar} className={claseBotonTinta}>
          + Agregar {singular}
        </button>
        {acciones}
        <span className="text-xs text-tinta/50 sm:ml-auto">
          {filas.length} {filas.length === 1 ? singular : plural}
        </span>
      </div>

      {bajoLaBarra}

      {error && (
        <p data-campo-con-error className="scroll-mt-16 text-xs font-medium text-acento">
          {error}
        </p>
      )}

      {filas.length === 0 && (
        <p className="rounded-md border border-dashed border-borde px-3 py-6 text-center text-sm text-tinta/50">
          Todavía no hay {plural}.
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {filas.map((fila, i) => (
          <li
            key={fila.id}
            className={`rounded-md border p-3 ${claseFila?.(fila) ?? 'border-borde bg-white'}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-serif text-sm font-semibold capitalize text-tinta/70">
                {singular} {i + 1}
              </span>
              {insignias?.(fila)}
              <div className="ml-auto flex shrink-0 gap-1">
                {duplicar && (
                  <button
                    type="button"
                    onClick={() => duplicarFila(fila.id)}
                    className={`${claseBotonFila} text-tinta/60 hover:bg-black/5`}
                  >
                    Duplicar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => borrar(fila.id)}
                  aria-label={etiquetaBorrar?.(fila, i) ?? `Borrar ${singular} ${i + 1}`}
                  className={`${claseBotonFila} text-acento hover:bg-acento/10`}
                >
                  Borrar
                </button>
              </div>
            </div>

            {children(fila, i, (cambios) => reemplazar(fila.id, cambios))}
          </li>
        ))}
      </ol>
    </div>
  );
}
