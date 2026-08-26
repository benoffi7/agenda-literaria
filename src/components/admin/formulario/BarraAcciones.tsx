/**
 * Barra de acciones del formulario: cancelar, guardar borrador, guardar.
 *
 * Fija abajo, con `pb-segura` para que en un iPhone no quede debajo de la barra
 * de gestos. En mobile los dos botones de guardado van a mitad y mitad del
 * ancho, y "Cancelar" pasa a una línea propia arriba: tres botones en fila en
 * 360 px dan blancos de ~100 px y se erra el toque.
 *
 * ── B-184 · el mensaje dice qué falta, y lleva hasta ahí ───────────────────
 * Antes decía «3 campos para revisar». La decisión escrita era esa —listar
 * rutas de campo tapaba media pantalla en mobile— y le faltaba un dato: cuatro
 * secciones arrancan colapsadas, así que el campo rechazado podía no estar en
 * ninguna parte de la pantalla. Ahora nombra los campos (pocos) o las secciones
 * con su cuenta (muchos), y cada nombre es un botón que abre la sección y
 * scrollea hasta el campo. El armado del texto vive en
 * `lib/formulario/camposFaltantes.ts`, que es donde se puede testear.
 */
import { claseBotonPrimario, claseBotonSecundario } from '@/components/admin/campos/Campo';
import {
  nombraSecciones,
  type IdSeccion,
  type ResumenFaltantes,
} from '@/lib/formulario/camposFaltantes';

interface Props {
  /** Hay un guardado en curso: los dos botones de guardar se apagan. */
  guardando: boolean;
  /** El motivo del último fallo, si no fue de validación. */
  fallo: string | null;
  /** Lo que el schema rechazó en el último intento, agrupado por sección. */
  faltantes: ResumenFaltantes;
  /**
   * Lo que le va a faltar para **publicar**, aunque ahora se pueda guardar
   * (B-183). Es aviso, no bloqueo: sin esto, los dos niveles de validación se
   * vuelven una trampa y el bloqueo aparece recién al final.
   */
  pendientesParaPublicar: ResumenFaltantes;
  /** El formulario edita una actividad que ya existe. */
  esEdicion: boolean;
  onCancelar: () => void;
  onGuardarBorrador: () => void;
  /** Abrir la sección y scrollear hasta su primer campo pendiente. */
  onIrASeccion: (id: IdSeccion) => void;
}

/** Los nombres del mensaje, cada uno como botón que lleva a su sección. */
function Nombres({
  resumen,
  onIrASeccion,
}: {
  resumen: ResumenFaltantes;
  onIrASeccion: (id: IdSeccion) => void;
}) {
  const porSeccion = nombraSecciones(resumen);
  return (
    <>
      {resumen.secciones.map((s, i) => (
        <span key={s.id}>
          {i > 0 && ', '}
          <button
            type="button"
            onClick={() => onIrASeccion(s.id)}
            className="underline decoration-dotted underline-offset-2"
          >
            {porSeccion ? `${s.titulo} (${s.cantidad})` : s.etiquetas.join(', ')}
          </button>
        </span>
      ))}
      {/*
        Una ruta que el diccionario no conoce no se esconde: sin nombre no se
        puede llevar a ningún lado, pero decirla igual es mejor que un mensaje
        que avisa que falta algo y no dice qué.
      */}
      {resumen.sinUbicar.map((ruta) => (
        <span key={ruta}>, {ruta}</span>
      ))}
    </>
  );
}

export function BarraAcciones({
  guardando,
  fallo,
  faltantes,
  pendientesParaPublicar,
  esEdicion,
  onCancelar,
  onGuardarBorrador,
  onIrASeccion,
}: Props) {
  const hayFaltantes = faltantes.total > 0;
  const hayPendientes = pendientesParaPublicar.total > 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-papel/95 px-segura pt-3 pb-segura backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center lg:max-w-4xl">
        <div
          role="status"
          className="min-w-0 text-xs empty:hidden sm:order-2 sm:flex-1 sm:text-center"
        >
          {fallo ? (
            <span className="text-acento">{fallo}</span>
          ) : hayFaltantes ? (
            <span className="text-acento">
              Falta completar: <Nombres resumen={faltantes} onIrASeccion={onIrASeccion} />
            </span>
          ) : hayPendientes ? (
            // Gris y no rojo: se puede guardar igual, es lo que va a faltar el
            // día que se publique.
            <span className="text-tinta/60">
              Para publicar falta:{' '}
              <Nombres resumen={pendientesParaPublicar} onIrASeccion={onIrASeccion} />
            </span>
          ) : null}
        </div>

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
