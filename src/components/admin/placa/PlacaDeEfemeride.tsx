/**
 * **La placa de una efeméride, para Instagram** — B-2225.
 *
 * El texto lo arma `placaDeEfemeride` (`lib/placas.ts`); el dibujo,
 * `dibujarPlacaDeEfemeride`. El «hace N años» se cuenta sobre el año de hoy.
 */
import { useCallback, useMemo } from 'react';
import { PlacaParaInstagram } from '@/components/admin/placa/PlacaParaInstagram';
import { dibujarPlacaDeEfemeride } from '@/components/admin/placa/dibujarPlacas';
import type { Formato } from '@/lib/imagenDeLaSemana';
import { placaDeEfemeride } from '@/lib/placas';
import type { EfemerideConId } from '@/types/efemeride';

export function PlacaDeEfemeride({ efemeride }: { efemeride: EfemerideConId }) {
  const placa = useMemo(() => placaDeEfemeride(efemeride, new Date()), [efemeride]);
  const dibujar = useCallback(
    (canvas: HTMLCanvasElement, formato: Formato) => dibujarPlacaDeEfemeride(canvas, placa, formato),
    [placa],
  );
  return (
    <PlacaParaInstagram
      titulo="Placa para Instagram"
      ayuda={
        efemeride.estado === 'publicado'
          ? 'Con la fecha, el dato y la dirección de su página. Se baja como imagen y se sube a mano.'
          : 'Está en borrador: la placa sale sin la dirección de su página, que todavía no existe.'
      }
      descripcion={`Vista previa de la placa de «${efemeride.titulo}»`}
      archivo={`efemeride-${efemeride.slug || 'sin-link'}`}
      dibujar={dibujar}
    />
  );
}
