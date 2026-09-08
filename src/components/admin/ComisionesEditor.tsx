import { Campo, claseBotonFila, claseBotonSecundario, claseInput } from '@/components/admin/campos/Campo';
import { medirFuncion } from '@/lib/analytics';
import { comisionVacia } from '@/lib/comisiones';
import type { Comision } from '@/types/actividad';

interface Props {
  comisiones: Comision[];
  /** Reemplaza la lista entera. */
  onChange: (c: Comision[]) => void;
  /**
   * Sacar una comisión **desengancha sus encuentros**, y eso toca `sesiones`,
   * que este editor no tiene. Lo hace el que sí las tiene (`sinComision` de
   * `lib/comisiones.ts`): acá solo se avisa cuál se quiere borrar.
   *
   * Está separado del `onChange` a propósito. Con una sola callback, borrar
   * sería «pasame la lista sin esta fila» y el que la recibe tendría que
   * **deducir** qué se fue para desenganchar los encuentros — o peor, olvidarse.
   */
  onBorrar: (id: string) => void;
  /** Cuántos encuentros tiene cada comisión, para decirlo antes de borrarla. */
  encuentrosDe: (id: string) => number;
  errorDe: (path: string) => string | undefined;
}

/**
 * **Las opciones para sumarse a un ciclo** — B-181.
 *
 * El reporte del dueño: «un club de lectura puede darte 4 opciones para
 * sumarte. Pero no son 4 encuentros, sino opciones». En el modelo son
 * `comisiones` (el porqué del nombre está en el tipo `Comision`); acá se llaman
 * como el dueño las llamó, porque es la pantalla.
 *
 * ── Por qué no es un `FilasEditor` ────────────────────────────────────────
 * El chasis compartido (B-224) trae número de fila, duplicar, contador y estado
 * vacío, y acá los cuatro estorban: una comisión es **un** campo de texto, y su
 * lista normal tiene dos o tres filas. Duplicar una comisión no significa nada
 * —el nombre tiene que ser distinto, lo exige el schema— y un bloque con
 * «Comisión 1 / Comisión 2» numerados arriba de una lista de encuentros que
 * también está numerada se lee como dos numeraciones cruzadas.
 *
 * Lo que sí se conserva del chasis es lo que importa: borrar **por id** y nunca
 * por índice (trampa 2).
 */
export function ComisionesEditor({ comisiones, onChange, onBorrar, encuentrosDe, errorDe }: Props) {
  const agregar = () => {
    medirFuncion('comision-agregar', undefined, comisiones.length + 1);
    onChange([...comisiones, comisionVacia()]);
  };

  return (
    <div className="mb-4 border border-borde bg-white p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-titulo text-sm font-semibold">Opciones para sumarse</h4>
        <button type="button" onClick={agregar} className={claseBotonSecundario}>
          + Agregar opción
        </button>
      </div>

      <p className="mt-1 text-xs text-tinta/60">
        Para cuando el mismo ciclo se da en <strong>varios horarios</strong> y cada
        persona va a uno solo: «Martes 19 h», «Sábados 11 h». Después, cada encuentro
        dice de qué opción es.{' '}
        {comisiones.length === 0 && (
          <>
            Si el ciclo tiene un solo horario —lo normal— no hace falta ninguna:
            dejalo vacío.
          </>
        )}
      </p>

      {comisiones.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {comisiones.map((c, i) => {
            const cantidad = encuentrosDe(c.id);
            return (
              <li key={c.id} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[12rem] flex-1">
                  <Campo
                    label={`Opción ${i + 1}`}
                    // El `for` va atado al id de la fila y no a su posición: es
                    // el mismo criterio que `material-titulo-${it.id}` y el que
                    // hace que el label siga apuntando al campo correcto después
                    // de borrar una fila del medio.
                    htmlFor={`comision-${c.id}`}
                    requerido
                    error={errorDe(`comisiones.${i}.etiqueta`)}
                  >
                    <input
                      id={`comision-${c.id}`}
                      value={c.etiqueta}
                      onChange={(e) =>
                        onChange(
                          comisiones.map((x) =>
                            x.id === c.id ? { ...x, etiqueta: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder="Martes 19 h"
                      className={claseInput}
                    />
                  </Campo>
                </div>
                <span className="pb-2 text-xs text-tinta/55">
                  {cantidad === 1 ? '1 encuentro' : `${cantidad} encuentros`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    medirFuncion('comision-borrar', undefined, comisiones.length - 1);
                    onBorrar(c.id);
                  }}
                  aria-label={`Borrar la opción ${c.etiqueta || i + 1}`}
                  className={`${claseBotonFila} mb-1 border border-borde bg-white text-tinta/70 hover:bg-black/[0.03]`}
                >
                  Borrar
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        Lo que pasa al borrar, dicho **antes** de borrar y solo si hay algo que
        perder: los encuentros no se van con la opción —son fechas cargadas a
        mano—, quedan sin opción y el guardado los va a pedir.
      */}
      {comisiones.some((c) => encuentrosDe(c.id) > 0) && (
        <p className="mt-2 text-xs text-tinta/55">
          Al borrar una opción, sus encuentros <strong>no se borran</strong>: quedan
          sin opción, y antes de publicar hay que asignarles otra.
        </p>
      )}
    </div>
  );
}
