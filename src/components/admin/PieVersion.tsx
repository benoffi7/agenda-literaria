import type { DecisionVersion } from '@/lib/version';

interface Props {
  decision: DecisionVersion;
  versionActual: string;
  versionPublicada: string | null;
  /**
   * **Debajo del mail, en el encabezado** — pedido del dueño (2026-09-07: «la
   * versión del panel subila; tiene que estar debajo del mail»).
   *
   * Cambia solo el envoltorio: sin `<footer>`, sin la regla de arriba y sin el
   * margen que la separaba del contenido, porque ahí ya está adentro del bloque
   * de identidad y una regla más partiría el encabezado en dos.
   *
   * Lo que dice y cuándo lo dice es **idéntico** en las dos formas, y eso es a
   * propósito: es el dato que hace accionable un reporte de bug, y un aviso de
   * versión nueva que apareciera en una posición y no en la otra sería el peor
   * de los dos mundos.
   */
  enLinea?: boolean;
}

/**
 * Pie del panel con la versión que está corriendo, siempre visible.
 *
 * Por qué siempre y no solo cuando hay algo raro: es el dato que hace
 * accionable un reporte de bug. Quien reporta desde el teléfono no va a abrir
 * ninguna consola, y el formulario de reportes ya la manda sola — pero cuando
 * el problema se cuenta por WhatsApp o de palabra, tiene que poder leerse de
 * algún lado.
 *
 * **Desde el 2026-09-07 va debajo del mail, en el encabezado** (pedido del
 * dueño), y no al final del contenido. El motivo del lugar viejo sigue siendo
 * cierto en su parte —no puede ser un tercer elemento **fijo**, con la barra de
 * acciones abajo y el aviso de versión arriba— y lo que cambió es otra cosa: al
 * final del contenido hay que **scrollear** el formulario entero para leerla, y
 * es el dato que se pide cuando algo no funciona. Arriba está al lado de quién
 * está logueado, que es la otra mitad de «contra qué se probó».
 *
 * En las pantallas sin encabezado —login y «sin permisos»— se queda al pie: ahí
 * no hay mail debajo del cual ponerla, y son pantallas de una sola vista.
 *
 * El estado llega por props: `useVersionPublicada` hace el fetch y el
 * `reload()`, así que lo llama `AdminApp` una sola vez (ver `AvisoVersionNueva`).
 */
export function PieVersion({
  decision,
  versionActual,
  versionPublicada,
  enLinea = false,
}: Props) {
  // Hay algo publicado, se pudo leer, y no es lo que está corriendo.
  const hayActualizacion = Boolean(versionPublicada) && versionPublicada !== versionActual;

  const Envoltorio = enLinea ? 'div' : 'footer';

  return (
    <Envoltorio
      className={
        enLinea
          ? 'text-xs text-tinta/45'
          : 'mt-8 border-t border-borde pt-3 pb-2 text-xs text-tinta/45'
      }
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          Panel <span className="font-mono">{versionActual}</span>
        </span>

        {hayActualizacion && (
          <>
            <span aria-hidden>·</span>
            <span className="text-acento">
              Hay una versión nueva:{' '}
              <span className="font-mono">{versionPublicada}</span>
            </span>
            {/*
              El botón aparece solo cuando la recarga automática no va a
              ocurrir. Si `decision.accion` es 'recargar', el panel está por
              recargarse solo y ofrecer un botón sería ruido de un segundo.
            */}
            {decision.accion !== 'recargar' && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="min-h-touch rounded-md px-2 text-xs font-medium text-acento underline hover:bg-acento/10 sm:min-h-0 sm:py-1"
              >
                Actualizar ahora
              </button>
            )}
          </>
        )}

        {/*
          Sin `versionPublicada` no se sabe: puede ser que no haya red, o un
          build sin `/version.json`. Decirlo es mejor que insinuar que está al
          día, porque justamente el caso en que importa es cuando algo falla.
        */}
        {!versionPublicada && <span className="text-tinta/35">· no se pudo verificar</span>}
      </div>
    </Envoltorio>
  );
}
