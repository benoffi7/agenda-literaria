import { useEffect, useState } from 'react';
import { PERMISOS, type RolDelPanel } from '@/lib/rolDelPanel';
import { listarUsuarios, mailesPorUid } from '@/lib/usuarios';

/** El mapa vacío, constante de módulo: uno nuevo por render rompería los memos. */
const SIN_MAILES: ReadonlyMap<string, string> = new Map();

/**
 * El directorio `/usuarios` resuelto a `uid → mail` — B-888, tajada 2.
 *
 * Es lo que le pone nombre al filtro «quién la cargó» y a la marca de autoría de
 * cada tarjeta. Sin esto el panel solo tiene uids, que es exactamente el motivo
 * por el que D-74 había descartado ese filtro y por el que la marca decía «otra
 * cuenta» y no cuál (B-130).
 *
 * ── Tres cosas que decide este hook ───────────────────────────────────────
 *
 *  - **No lo pide si el rol no lo puede leer.** La regla le da al publicador
 *    **su** documento por id, y una condición por ruta no es satisfacible en un
 *    `list`: pedir el directorio le devolvería un `permission-denied` limpio y un
 *    error en la pantalla por un dato que no va a usar (no ve el filtro ni las
 *    actividades de nadie más). Es la misma idea que el `where` del listado: no
 *    hacer la llamada que ya sabemos que va a fallar.
 *  - **Un fallo no rompe nada.** Se devuelve el mapa vacío, y con el mapa vacío
 *    el panel se comporta **exactamente** como antes de B-888: el filtro no se
 *    dibuja y la marca dice «La cargó otra cuenta». Es el default del §«Un campo
 *    nuevo se lee con el default que preserva lo anterior», aplicado a una
 *    lectura que puede no estar.
 *  - **Se lee una vez por montaje y no en vivo.** El mail de una cuenta cambia
 *    cuando alguien crea una cuenta nueva, o sea casi nunca; un `onSnapshot`
 *    sobre el directorio sería una suscripción abierta toda la sesión para un
 *    dato que no se mueve. El listado se remonta al cambiar de vista.
 */
export const useMailesDelPanel = (rol: RolDelPanel): ReadonlyMap<string, string> => {
  const [mailes, setMailes] = useState<ReadonlyMap<string, string>>(SIN_MAILES);

  useEffect(() => {
    if (!PERMISOS[rol].leeElDirectorio) {
      setMailes(SIN_MAILES);
      return;
    }
    let vivo = true;
    listarUsuarios()
      .then((us) => vivo && setMailes(mailesPorUid(us)))
      // Silencioso: ver el docblock. Lo peor que pasa es que se lea un uid menos.
      .catch(() => vivo && setMailes(SIN_MAILES));
    return () => {
      vivo = false;
    };
  }, [rol]);

  return mailes;
};
