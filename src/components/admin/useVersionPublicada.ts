import { useCallback, useEffect, useRef, useState } from 'react';
import { hayCambiosSinGuardar, observarCambiosSinGuardar } from '@/lib/formulario-sucio';
import {
  INTERVALO_CHEQUEO_MS,
  RUTA_VERSION,
  VERSION_APP,
  debeChequear,
  decidirAccion,
  parsearInfoVersion,
  type DecisionVersion,
} from '@/lib/version';

/**
 * Marca de "por esta versión ya recargué". Va en `sessionStorage` porque tiene
 * que sobrevivir exactamente a un `location.reload()` y morir con la pestaña.
 */
const CLAVE_RECARGA = 'agenda:version-recargada';

/** Safari en modo privado tira al tocar `sessionStorage`. No vale romper por esto. */
const leerMarca = (): string | null => {
  try {
    return window.sessionStorage.getItem(CLAVE_RECARGA);
  } catch {
    return null;
  }
};

const escribirMarca = (version: string): void => {
  try {
    window.sessionStorage.setItem(CLAVE_RECARGA, version);
  } catch {
    // Sin marca se pierde la protección anti-loop, no la detección. Sigue.
  }
};

/**
 * Detecta que el panel quedó corriendo una versión vieja y decide qué hacer.
 *
 * Cuándo se chequea:
 * - al montar el panel,
 * - **al volver a la pestaña** (`visibilitychange`), que es el momento real: el
 *   panel se deja abierto días y la vuelta a la pestaña es cuando la persona
 *   va a empezar a usarlo,
 * - cada 15 minutos si la pestaña está visible, como red de contención.
 *
 * Con un piso de un chequeo por minuto: `visibilitychange` se dispara mucho.
 *
 * La decisión (recargar sola / avisar / no hacer nada) es lógica pura y vive en
 * `src/lib/version.ts`. Acá está solo el efecto: la red y el `reload()`.
 */
export function useVersionPublicada(): {
  decision: DecisionVersion;
  versionActual: string;
  versionPublicada: string | null;
} {
  const [publicada, setPublicada] = useState<string | null>(null);
  const [sucio, setSucio] = useState<boolean>(hayCambiosSinGuardar);
  const ultimoChequeo = useRef<number | null>(null);

  useEffect(() => observarCambiosSinGuardar(() => setSucio(hayCambiosSinGuardar())), []);

  const chequear = useCallback(async () => {
    const ahora = Date.now();
    if (!debeChequear(ahora, ultimoChequeo.current)) return;
    ultimoChequeo.current = ahora;
    try {
      // `cache: 'no-store'` y una query única además de las cabeceras de
      // Hosting: si algún intermediario ignora el `no-store`, el recurso de
      // versión no puede quedar congelado justamente él.
      const respuesta = await fetch(`${RUTA_VERSION}?t=${ahora}`, { cache: 'no-store' });
      if (!respuesta.ok) return;
      const info = parsearInfoVersion(await respuesta.json());
      if (info) setPublicada(info.version);
    } catch {
      // Sin red, o build sin `/version.json`: no se sabe, se reintenta después.
      // Nunca es motivo para recargar.
    }
  }, []);

  useEffect(() => {
    void chequear();

    const siEstaVisible = () => {
      if (document.visibilityState === 'visible') void chequear();
    };
    document.addEventListener('visibilitychange', siEstaVisible);
    const intervalo = window.setInterval(siEstaVisible, INTERVALO_CHEQUEO_MS);

    return () => {
      document.removeEventListener('visibilitychange', siEstaVisible);
      window.clearInterval(intervalo);
    };
  }, [chequear]);

  const decision = decidirAccion({
    actual: VERSION_APP,
    publicada,
    hayCambiosSinGuardar: sucio,
    yaSeRecargoPara: leerMarca(),
  });

  useEffect(() => {
    if (decision.accion !== 'recargar' || publicada === null) return;
    // La marca va antes del reload: si al volver sigue sin coincidir, la
    // próxima decisión avisa en vez de recargar otra vez.
    escribirMarca(publicada);
    window.location.reload();
  }, [decision.accion, publicada]);

  return { decision, versionActual: VERSION_APP, versionPublicada: publicada };
}
