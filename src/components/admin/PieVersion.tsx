import type { DecisionVersion } from '@/lib/version';

interface Props {
  decision: DecisionVersion;
  versionActual: string;
  versionPublicada: string | null;
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
 * No es fijo: va al final del contenido. Un tercer elemento fijo, con la barra
 * de acciones abajo y el aviso de versión arriba, dejaría el formulario de un
 * teléfono viendo tres franjas y una rendija.
 *
 * El estado llega por props: `useVersionPublicada` hace el fetch y el
 * `reload()`, así que lo llama `AdminApp` una sola vez (ver `AvisoVersionNueva`).
 */
export function PieVersion({ decision, versionActual, versionPublicada }: Props) {
  // Hay algo publicado, se pudo leer, y no es lo que está corriendo.
  const hayActualizacion = Boolean(versionPublicada) && versionPublicada !== versionActual;

  return (
    <footer className="mt-8 border-t border-borde pt-3 pb-2 text-xs text-tinta/45">
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
    </footer>
  );
}
