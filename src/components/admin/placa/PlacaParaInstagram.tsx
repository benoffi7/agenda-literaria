/**
 * **La vista previa de una imagen para Instagram, con sus dos formatos y el
 * botón de bajarla** — la usan la imagen de la semana y las placas (B-2225,
 * B-2226). Qué se dibuja lo pasa quien la usa en `dibujar`.
 */
import { useEffect, useRef, useState } from 'react';
import { FORMATOS, type Formato } from '@/lib/imagenDeLaSemana';
import { bajarComoPng } from '@/components/admin/placa/lienzo';

const ETIQUETA: Record<Formato, string> = {
  feed: 'Para el feed (1080 × 1350)',
  historia: 'Para la historia (1080 × 1920)',
};

interface Props {
  titulo: string;
  ayuda: string;
  /** Lo que nombra la vista previa para un lector de pantalla. */
  descripcion: string;
  /** El nombre del PNG, sin el formato: `esta-semana` → `esta-semana-feed.png`. */
  archivo: string;
  /**
   * Dibuja en el canvas. **Tiene que ser estable** (`useCallback`) o se redibuja
   * en cada render: cambiarla es lo que pide redibujar.
   */
  dibujar: (canvas: HTMLCanvasElement, formato: Formato) => Promise<void>;
}

export function PlacaParaInstagram({ titulo, ayuda, descripcion, archivo, dibujar }: Props) {
  const [formato, setFormato] = useState<Formato>('feed');
  const [lista, setLista] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let vivo = true;
    setLista(false);
    if (canvas.current) {
      void dibujar(canvas.current, formato).then(() => vivo && setLista(true));
    }
    return () => {
      vivo = false;
    };
  }, [dibujar, formato]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{titulo}</p>
      <p className="text-xs text-tinta/65">{ayuda}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Formato de la imagen">
        {(Object.keys(FORMATOS) as Formato[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={formato === f}
            onClick={() => setFormato(f)}
            className={`border px-3 py-1.5 text-xs ${formato === f ? 'border-tinta bg-tinta text-papel' : 'border-borde'}`}
          >
            {ETIQUETA[f]}
          </button>
        ))}
      </div>
      <canvas
        ref={canvas}
        className="w-full max-w-xs border border-borde"
        aria-label={`${descripcion}, ${ETIQUETA[formato]}`}
      />
      <div>
        <button
          type="button"
          disabled={!lista}
          onClick={() => canvas.current && bajarComoPng(canvas.current, `${archivo}-${formato}.png`)}
          className="border border-tinta bg-tinta px-3 py-2 text-sm text-papel disabled:opacity-50"
        >
          Bajar la imagen
        </button>
      </div>
    </div>
  );
}
