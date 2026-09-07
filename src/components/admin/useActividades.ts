import { useEffect, useState } from 'react';
import { listarActividades } from '@/lib/actividades';
import type { ActividadConId } from '@/types/actividad';

/**
 * **La carga de la colección al montar una vista del panel** — B-215, D-200.
 *
 * Era el mismo `useEffect` **verbatim** en `ListaActividades.tsx` y
 * `CalendarioActividades.tsx`: el flag `vivo`, el `setCargando(true)` adelante,
 * el `.catch` que traduce el error a un string y el `.finally` que apaga el
 * cargando, todo con `[version]` como dependencia. Lo encontró el barrido de
 * duplicación del 2026-08-27 y quedó abierto porque el panel tenía otro dueño;
 * se hace ahora que el backlog se trabaja de a un frente, que era la precondición
 * escrita en el ítem.
 *
 * ── Qué estaba a un typo de distancia ────────────────────────────────────
 * No es la repetición lo que molesta —son diez líneas— es que **las dos copias
 * son el único lugar donde vive la cancelación**. El flag `vivo` existe porque
 * quien cambia de pestaña mientras la lectura viaja desmonta el componente, y un
 * `setActividades` después del desmonte es una advertencia de React y, con el
 * `version` cambiando, una lista vieja pisando la nueva. Arreglar eso en una copia
 * y no en la otra es la divergencia de B-175: dos pantallas a un clic de
 * distancia, una arreglada y la otra no.
 *
 * ── Devuelve los setters, y eso es deliberado ────────────────────────────
 * `ListaActividades` **muta la lista en memoria** después de una acción —marcar
 * cupo completo, borrar— para no releer la colección entera por un campo (§2.5),
 * y usa `fallo` también para los errores de esas acciones («No se pudo cambiar el
 * cupo»). Así que el hook es dueño de *cargar*, y el componente sigue siendo
 * dueño de *lo que hace después con lo cargado*. Esconder los setters obligaría a
 * un segundo estado de error en la misma pantalla, que es peor.
 *
 * ── `EstadisticasPanel` no es un tercer consumidor, y no es un olvido ────
 * También llama a `listarActividades()`, pero su carga hace dos cosas distintas y
 * las dos a propósito: **mide** (`medirFuncion('estadisticas-abrir', …)` con la
 * cantidad, que es lo que decide si vale construir la mitad que lee GA4) y **no
 * tiene rama de error** —su resumen vacío ya sabe decir qué falta, así que el
 * estado de esa pestaña es siempre el mismo objeto—. Meterla acá pediría un
 * callback y un flag para apagar el `fallo`, o sea un hook con dos formas para
 * ahorrar cuatro líneas.
 */
export const useActividades = (version: number) => {
  const [actividades, setActividades] = useState<ActividadConId[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    listarActividades()
      .then((as) => vivo && setActividades(as))
      .catch((e: unknown) => vivo && setFallo(e instanceof Error ? e.message : 'Error al listar'))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [version]);

  return { actividades, setActividades, cargando, fallo, setFallo };
};
