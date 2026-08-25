/**
 * Barra de acciones del formulario: cancelar, guardar borrador, guardar.
 *
 * Fija abajo, con `pb-segura` para que en un iPhone no quede debajo de la barra
 * de gestos. En mobile los dos botones de guardado van a mitad y mitad del
 * ancho, y "Cancelar" pasa a una línea propia arriba: tres botones en fila en
 * 360 px dan blancos de ~100 px y se erra el toque.
 */
import { claseBotonPrimario, claseBotonSecundario } from '@/components/admin/campos/Campo';

interface Props {
  /** Hay un guardado en curso: los dos botones de guardar se apagan. */
  guardando: boolean;
  /** El motivo del último fallo, si no fue de validación. */
  fallo: string | null;
  /** Cuántos campos rechazó el schema. */
  cantidadErrores: number;
  /** El formulario edita una actividad que ya existe. */
  esEdicion: boolean;
  onCancelar: () => void;
  onGuardarBorrador: () => void;
}

export function BarraAcciones({
  guardando,
  fallo,
  cantidadErrores,
  esEdicion,
  onCancelar,
  onGuardarBorrador,
}: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-papel/95 px-segura pt-3 pb-segura backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center lg:max-w-4xl">
        {/*
          El resumen de errores se reduce a un contador. Listar cuatro rutas
          de campo acá tapaba media pantalla en mobile, y el detalle ya está
          al lado de cada campo.
        */}
        {(fallo || cantidadErrores > 0) && (
          <p role="status" className="text-xs text-acento sm:order-2 sm:flex-1 sm:text-center">
            {cantidadErrores > 0
              ? `${cantidadErrores} ${cantidadErrores === 1 ? 'campo' : 'campos'} para revisar`
              : fallo}
          </p>
        )}

        <button
          type="button"
          onClick={onCancelar}
          className={`${claseBotonSecundario} sm:order-1`}
        >
          Cancelar
        </button>

        <div className="flex gap-2 sm:order-3">
          <button
            type="button"
            disabled={guardando}
            onClick={onGuardarBorrador}
            className={`${claseBotonSecundario} flex-1 sm:flex-none`}
          >
            Guardar borrador
          </button>
          <button
            type="submit"
            disabled={guardando}
            className={`${claseBotonPrimario} flex-1 sm:flex-none`}
          >
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear actividad'}
          </button>
        </div>
      </div>
    </div>
  );
}
