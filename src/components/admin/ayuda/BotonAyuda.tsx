import { useCallback, useEffect, useState } from 'react';
import { CentroAyuda } from '@/components/admin/ayuda/CentroAyuda';
import type { ContextoAyuda } from '@/lib/ayuda';
import { NOVEDADES, leerVisto, novedadesNoLeidas } from '@/lib/novedades';

interface Props {
  /** Pantalla desde la que se abre: decide qué capítulo de la guía aparece abierto. */
  contexto: ContextoAyuda;
}

/**
 * Entrada única a la ayuda, en el encabezado del panel (D-61).
 *
 * Está en el encabezado y no dentro de cada pantalla por dos razones: es el
 * único lugar que se ve en todas (listado y formulario), y así el formulario
 * —que están tocando varias manos— no necesita saber que la ayuda existe.
 *
 * **El aviso de novedades es un número al lado del texto, y nada más** (D-64).
 * Sin ventana que se abra sola, sin cartel que haya que cerrar: quien está
 * cargando una actividad a las once de la noche no quiere enterarse de una
 * mejora, quiere guardar. El número espera, y al abrirse una vez se apaga.
 */
export function BotonAyuda({ contexto }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [sinLeer, setSinLeer] = useState<string[]>([]);

  // En un efecto porque lee del navegador: en el primer render no hay nada
  // guardado que consultar y el número no debe parpadear.
  useEffect(() => {
    setSinLeer(novedadesNoLeidas(NOVEDADES, leerVisto()).map((n) => n.id));
  }, []);

  const apagarNumero = useCallback(() => setSinLeer([]), []);

  const cantidad = sinLeer.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={
          cantidad > 0
            ? `Ayuda. ${cantidad} ${cantidad === 1 ? 'novedad' : 'novedades'} sin leer`
            : 'Ayuda'
        }
        className="min-h-touch shrink-0 rounded-md border border-borde bg-white px-3 text-sm"
      >
        Ayuda
        {cantidad > 0 && (
          <span
            aria-hidden
            className="ml-1.5 rounded-full bg-acento px-1.5 py-0.5 text-xs text-white"
          >
            {cantidad}
          </span>
        )}
      </button>

      {abierto && (
        <CentroAyuda
          contexto={contexto}
          idsSinLeer={sinLeer}
          onCerrar={() => setAbierto(false)}
          onNovedadesLeidas={apagarNumero}
        />
      )}
    </>
  );
}
