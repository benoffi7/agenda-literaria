import { useEffect, useId, useState, type ReactNode } from 'react';
import { medirSeccion } from '@/lib/analytics';

interface Props {
  titulo: string;
  descripcion?: string;
  /** Las secciones opcionales arrancan colapsadas (§11: acordeón "opcional"). */
  colapsable?: boolean;
  abiertaPorDefecto?: boolean;
  insignia?: string;
  /**
   * Ancla en el DOM, para que la barra de acciones pueda llevar hasta acá
   * (B-184). Es el `id` de la sección en `lib/formulario/camposFaltantes.ts`.
   */
  ancla?: string;
  /**
   * Contador de pedidos de apertura. Cada vez que sube, la sección se abre.
   *
   * B-184 — un campo rechazado adentro de un acordeón cerrado no está en ninguna
   * parte de la pantalla: el contador decía "3 campos" y se veían cero. Es un
   * contador y no un booleano a propósito, para que un segundo pedido vuelva a
   * abrirla después de que alguien la cerró a mano.
   */
  pedidoDeApertura?: number;
  children: ReactNode;
}

export function Seccion({
  titulo,
  descripcion,
  colapsable = false,
  abiertaPorDefecto = true,
  insignia,
  ancla,
  pedidoDeApertura = 0,
  children,
}: Props) {
  const [abierta, setAbierta] = useState(colapsable ? abiertaPorDefecto : true);
  const idPanel = useId();

  useEffect(() => {
    if (pedidoDeApertura > 0) setAbierta(true);
  }, [pedidoDeApertura]);

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

  // El `scroll-mt` deja aire arriba cuando se scrollea hasta acá desde el
  // mensaje de campos faltantes de la barra.
  return (
    <section id={ancla} className="scroll-mt-4 rounded-lg border border-borde bg-white/60">
      {colapsable ? (
        // Un <button> real y no un div con onClick: se abre con teclado, lo
        // anuncia el lector de pantalla, y en mobile el blanco táctil ocupa
        // todo el ancho del encabezado en lugar de solo el texto.
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls={idPanel}
          onClick={() => {
            // Qué acordeones se despliegan de verdad. Va el slug del título,
            // que es un literal del código (docs/09-analitica.md).
            medirSeccion(titulo, !abierta);
            setAbierta((v) => !v);
          }}
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
