import { useId, useState, type ReactNode } from 'react';

interface Props {
  titulo: string;
  descripcion?: string;
  /** Las secciones opcionales arrancan colapsadas (§11: acordeón "opcional"). */
  colapsable?: boolean;
  abiertaPorDefecto?: boolean;
  insignia?: string;
  children: ReactNode;
}

export function Seccion({
  titulo,
  descripcion,
  colapsable = false,
  abiertaPorDefecto = true,
  insignia,
  children,
}: Props) {
  const [abierta, setAbierta] = useState(colapsable ? abiertaPorDefecto : true);
  const idPanel = useId();

  const encabezado = (
    <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
      {colapsable && (
        <span
          aria-hidden
          className={`shrink-0 text-tinta/40 transition-transform ${abierta ? 'rotate-90' : ''}`}
        >
          ▶
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="font-serif text-base font-semibold">{titulo}</h2>
        {descripcion && <p className="text-xs text-tinta/55">{descripcion}</p>}
      </div>
      {insignia && (
        <span className="shrink-0 rounded-full bg-acento/10 px-2 py-0.5 text-xs text-acento">
          {insignia}
        </span>
      )}
    </div>
  );

  return (
    <section className="rounded-lg border border-borde bg-white/60">
      {colapsable ? (
        // Un <button> real y no un div con onClick: se abre con teclado, lo
        // anuncia el lector de pantalla, y en mobile el blanco táctil ocupa
        // todo el ancho del encabezado en lugar de solo el texto.
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls={idPanel}
          onClick={() => setAbierta((v) => !v)}
          className="flex min-h-touch w-full items-center px-4 py-3"
        >
          {encabezado}
        </button>
      ) : (
        <header className="flex items-center px-4 py-3">{encabezado}</header>
      )}
      {abierta && (
        <div id={idPanel} className="border-t border-borde px-3 py-4 sm:px-4">
          {children}
        </div>
      )}
    </section>
  );
}
