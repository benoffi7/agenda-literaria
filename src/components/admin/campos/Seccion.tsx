import { useState, type ReactNode } from 'react';

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

  return (
    <section className="rounded-lg border border-borde bg-white/60">
      <header
        className={`flex items-center gap-3 px-4 py-3 ${colapsable ? 'cursor-pointer select-none' : ''}`}
        onClick={colapsable ? () => setAbierta((v) => !v) : undefined}
      >
        {colapsable && (
          <span
            aria-hidden
            className={`text-tinta/40 transition-transform ${abierta ? 'rotate-90' : ''}`}
          >
            ▶
          </span>
        )}
        <div className="flex-1">
          <h2 className="font-serif text-base font-semibold">{titulo}</h2>
          {descripcion && <p className="text-xs text-tinta/55">{descripcion}</p>}
        </div>
        {insignia && (
          <span className="rounded-full bg-acento/10 px-2 py-0.5 text-xs text-acento">
            {insignia}
          </span>
        )}
      </header>
      {abierta && <div className="border-t border-borde px-4 py-4">{children}</div>}
    </section>
  );
}
