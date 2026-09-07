import { claseBotonPrimario } from '@/components/admin/campos/Campo';
import { PROMESA_DEL_BORRADOR } from '@/lib/carga-diferida';
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
 * ── El texto decía lo contrario de lo que pasa, y eso tenía consecuencias ──
 * Hasta el 2026-09-07 este aviso decía **«si recargás ahora, se pierde»** y el
 * botón «Recargar sin guardar». Las dos cosas eran **falsas desde D-122**: el
 * formulario se guarda solo en este navegador con cada tecla y al abrir ofrece lo
 * que quedó. Recargar no pierde nada.
 *
 * No era un detalle de redacción. El dueño reportó dos veces que «no se pueden
 * subir imágenes», y la cadena era ésta: la pestaña queda vieja → el aviso
 * aparece → dice que recargar destruye el trabajo → nadie recarga → el
 * `import()` del SDK de Storage se lleva un 404 porque su chunk ya no existe →
 * «no se pudo subir la imagen». **El aviso estaba desalentando la única acción
 * que arreglaba el problema.**
 *
 * Hoy dice la verdad, nombra la consecuencia concreta de no recargar —que subir
 * imágenes puede fallar— y el botón se llama «Recargar ahora». Lo que **no**
 * cambió es la decisión de fondo: con el formulario a medio cargar el panel
 * **avisa y no recarga solo**. Que el borrador esté a salvo no vuelve agradable
 * que la pantalla se reinicie sola en medio de una frase.
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
              ? `Conviene recargar. Hasta que recargues, puede fallar subir imágenes.${PROMESA_DEL_BORRADOR}`
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
          {esPorElFormulario ? 'Recargar ahora' : 'Reintentar'}
        </button>
      </div>
    </div>
  );
}
