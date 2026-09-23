import { useSyncExternalStore } from 'react';
import { claseBotonPrimario } from '@/components/campos/Campo';
import {
  debeAvisar,
  estadoDeVerificacion,
  EXPLICACION_SIN_VERIFICAR,
  observarVerificacion,
  PASOS_SIN_VERIFICAR,
  TITULO_SIN_VERIFICAR,
  type EstadoVerificacion,
} from '@/lib/verificacionDelNavegador';

/**
 * El estado de la verificación de App Check, para un componente — B-930.
 *
 * `useSyncExternalStore` y no un `useState` + efecto: el store puede cambiar
 * **antes** de que el componente se monte (el token llega mientras se resuelve
 * la sesión), y un efecto que se suscribe después se perdería ese cambio. El
 * tercer argumento es lo que se ve sin navegador: nada que avisar.
 */
export const useVerificacionDelNavegador = (): EstadoVerificacion =>
  useSyncExternalStore(observarVerificacion, estadoDeVerificacion, () => 'no-aplica');

/**
 * **«No pudimos verificar tu navegador»** — el cartel de arriba del panel
 * (B-930, reportado por el dueño).
 *
 * Con App Check exigido en Firestore, un navegador que no consigue token no
 * puede leer ni guardar nada, y el SDK lo cuenta como «se cortó la conexión».
 * Este cartel es lo que convierte «el panel no anda» en algo que la persona
 * resuelve sola, sin que nadie le pida la consola: el triaje en tres pasos, en
 * el orden en que más descarta.
 *
 * ── Por qué no es fijo, a diferencia de `AvisoVersionNueva` ───────────────
 * Aquel se fija arriba porque tiene que sobrevivir al scroll de un formulario
 * largo. Éste aparece **al entrar** —el token se pide en el arranque— y va en
 * el flujo, arriba de todo: si fuera fijo también, los dos se pisarían justo en
 * el caso en que coinciden (una pestaña vieja en una red que bloquea
 * reCAPTCHA).
 *
 * **Sin «cerrar»**, por lo mismo que el de versión nueva: mientras el navegador
 * no esté verificado nada de lo que se haga en el panel va a funcionar, y un
 * cartel que se cierra por reflejo deja a la persona frente a errores que no
 * entiende. Se va solo si el token termina llegando.
 *
 * Recibe el estado por prop para que el render se pruebe sin tocar el store;
 * lo lee `AdminApp` con `useVerificacionDelNavegador`.
 */
export function AvisoVerificacion({ estado }: { estado: EstadoVerificacion }) {
  if (!debeAvisar(estado)) return null;

  return (
    <div
      role="alert"
      className="mx-auto mb-4 max-w-3xl rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950"
    >
      <p>
        <strong className="font-semibold">{TITULO_SIN_VERIFICAR}</strong>{' '}
        {EXPLICACION_SIN_VERIFICAR}
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        {PASOS_SIN_VERIFICAR.map((paso) => (
          <li key={paso}>{paso}</li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className={`${claseBotonPrimario} mt-3`}
      >
        Recargar
      </button>
    </div>
  );
}
