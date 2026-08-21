import { useState } from 'react';
import {
  Campo,
  claseBotonFila,
  claseBotonSecundario,
  claseInput,
} from '@/components/admin/campos/Campo';
import { formatearGeo, linkMapa, parsearCoordenadas, type Geo } from '@/lib/coordenadas';

interface Props {
  geo: Geo | null;
  onChange: (geo: Geo | null) => void;
  className?: string;
}

const AYUDA =
  'Opcional. Buscá el lugar en Google Maps y pegá el link de la barra de direcciones, ' +
  'o hacé clic derecho sobre el punto exacto y pegá el "lat, lng" que copia.';

/**
 * Captura de `sede.geo` (§3.1). Sirve para lo que abunda en el circuito
 * literario y la dirección sola no resuelve: una librería sin numeración
 * clara, un centro cultural dentro de un predio, una casa en un pasaje. Si hay
 * coordenadas, el link del evento de Calendar apunta al punto exacto en vez de
 * hacer que Google adivine por texto (D-10).
 *
 * El parseo vive en `lib/coordenadas.ts` (puro y testeado). Acá solo el
 * control: pegar, ver qué se cargó, y poder borrarlo para volver a `null`.
 */
export function CoordenadasSede({ geo, onChange, className = '' }: Props) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [advertencia, setAdvertencia] = useState<string | null>(null);

  /** `entrada` explícita porque al pegar se lee del portapapeles, no del state. */
  const aplicar = (entrada: string) => {
    if (!entrada.trim()) {
      // Campo vacío no es un error: es que todavía no cargó nada.
      setError(null);
      setAdvertencia(null);
      return;
    }
    const r = parsearCoordenadas(entrada);
    if (!r.ok) {
      // Falla visible y con instrucción: el silencio acá se paga cuando alguien
      // no encuentra el lugar.
      setError(r.error);
      setAdvertencia(null);
      return;
    }
    setError(null);
    setAdvertencia(r.advertencia);
    setTexto('');
    onChange(r.geo);
  };

  const quitar = () => {
    setError(null);
    setAdvertencia(null);
    setTexto('');
    onChange(null);
  };

  return (
    <Campo
      label="Punto exacto en el mapa"
      ayuda={geo ? undefined : AYUDA}
      error={error ?? undefined}
      className={className}
    >
      {geo ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 truncate text-sm">
            <span aria-hidden>📍</span> Cargado:{' '}
            <span className="font-medium">{formatearGeo(geo)}</span>
          </p>
          {/* Verificar el punto es la mitad del valor de haberlo cargado. */}
          <a
            href={linkMapa(geo)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${claseBotonSecundario} shrink-0`}
          >
            Ver en el mapa
          </a>
          <button
            type="button"
            onClick={quitar}
            className={`${claseBotonFila} shrink-0 text-acento hover:bg-acento/10`}
          >
            Quitar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <input
            className={claseInput}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            // Pegar un link largo desde el teléfono es el caso principal: se
            // resuelve en el propio paste, sin obligar a apretar nada.
            onPaste={(e) => {
              const pegado = e.clipboardData.getData('text');
              if (pegado) {
                e.preventDefault();
                setTexto(pegado);
                aplicar(pegado);
              }
            }}
            onKeyDown={(e) => {
              // El input vive dentro del <form>: sin esto, Enter guarda la
              // actividad en lugar de leer la coordenada.
              if (e.key === 'Enter') {
                e.preventDefault();
                aplicar(texto);
              }
            }}
            onBlur={() => aplicar(texto)}
            placeholder="Link de Google Maps, o -34.5989, -58.4392"
            // Un link no se autocapitaliza ni se autocorrige, y en iOS el
            // teclado con "@" y "/" a mano ahorra dos toques.
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => aplicar(texto)}
            className={`${claseBotonSecundario} shrink-0`}
          >
            Usar
          </button>
        </div>
      )}

      {advertencia && (
        <p role="alert" className="text-xs font-medium text-tinta/70">
          <span aria-hidden>⚠</span> {advertencia}
        </p>
      )}
    </Campo>
  );
}
