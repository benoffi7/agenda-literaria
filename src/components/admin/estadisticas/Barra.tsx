import { porcentaje } from '@/lib/estadoDelCatalogo';

/**
 * Barra de comparación del tablero. Decorativa: el número siempre está escrito
 * al lado, y por eso va `aria-hidden`.
 *
 * Sale de `EstadisticasPanel.tsx` con B-1081 porque la usan también las dos
 * vistas de tiempo del ritmo (`Ritmo.tsx`): una segunda barra escrita al lado
 * sería la misma pieza en dos lugares, y el día que una cambie de alto el
 * tablero tendría dos gráficos de barras que no se parecen.
 */
export function Barra({ parte, total }: { parte: number; total: number }) {
  return (
    <span
      aria-hidden="true"
      className="block h-1.5 w-full overflow-hidden rounded-sm bg-tinta/8"
    >
      <span
        className="block h-full bg-acento"
        style={{ width: `${porcentaje(parte, total)}%` }}
      />
    </span>
  );
}
