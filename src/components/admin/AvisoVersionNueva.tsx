import { claseBotonPrimario } from '@/components/admin/campos/Campo';
import type { DecisionVersion } from '@/lib/version';

interface Props {
  decision: DecisionVersion;
  versionActual: string;
  versionPublicada: string | null;
}

/**
 * Aviso de "hay una versión nueva del panel".
 *
 * Cuando no hay nada en juego el panel se recarga solo y este componente no
 * pinta nada: el aviso existe para el caso en que recargar destruiría trabajo
 * (un formulario a medio cargar) o en que recargar ya se probó y no alcanzó.
 *
 * Por qué es fijo arriba y no abajo: la barra de acciones del formulario está
 * fija abajo con su safe-area (§11); un segundo elemento fijo ahí tapaba los
 * botones de guardar, que es justo lo que el aviso le está pidiendo hacer.
 *
 * Por qué no tiene "cerrar": tiene que no poder ignorarse por accidente. Se va
 * cuando el problema se resolvió — y al guardar el formulario se va solo,
 * porque ahí ya no queda nada que perder y la recarga ocurre sin preguntar.
 *
 * Recibe el estado por props en vez de llamar a `useVersionPublicada`: ese hook
 * hace el fetch y el `reload()`, así que dos componentes llamándolo serían dos
 * chequeos en paralelo y, en el peor caso, dos recargas. Lo llama `AdminApp`
 * una sola vez y lo reparte acá y al pie.
 */
export function AvisoVersionNueva({ decision, versionActual, versionPublicada }: Props) {

  if (decision.accion !== 'avisar') return null;

  const esPorElFormulario = decision.motivo === 'cambios-sin-guardar';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-x-0 top-0 z-40 border-b border-amber-400 bg-amber-100/95 px-segura pt-segura pb-3 backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center lg:max-w-4xl">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-amber-950">
            <strong className="font-semibold">Hay una versión nueva del panel.</strong>{' '}
            {esPorElFormulario
              ? 'Guardá lo que estás cargando y después recargá: si recargás ahora, se pierde.'
              : 'Recargar no alcanzó para traerla. Cerrá la pestaña y volvé a abrirla, o recargá forzando (⇧ + recargar).'}
          </p>
          {/* Las dos versiones a la vista: es lo que hay que copiar en un reporte. */}
          <p className="mt-0.5 truncate font-mono text-xs text-amber-900/70">
            {versionActual} → {versionPublicada}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`${claseBotonPrimario} shrink-0`}
        >
          {esPorElFormulario ? 'Recargar sin guardar' : 'Reintentar'}
        </button>
      </div>
    </div>
  );
}
