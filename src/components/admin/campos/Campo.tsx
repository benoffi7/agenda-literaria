import type { ReactNode } from 'react';

interface Props {
  label: string;
  htmlFor?: string;
  error?: string;
  ayuda?: string;
  requerido?: boolean;
  children: ReactNode;
  className?: string;
}

/** Envoltorio de campo: label, ayuda y error. Un solo lugar para el layout. */
export function Campo({
  label,
  htmlFor,
  error,
  ayuda,
  requerido,
  children,
  className = '',
}: Props) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-tinta">
        {label}
        {requerido && <span className="ml-0.5 text-acento">*</span>}
      </label>
      {children}
      {ayuda && !error && <p className="text-xs text-tinta/55">{ayuda}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-acento">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Campos de entrada.
 *
 * `min-h-touch` garantiza el blanco de 44px que pide el dedo, y el salto de
 * `text-base` a `text-sm` en sm evita el zoom automático de iOS al enfocar
 * (ver el comentario en global.css). `w-full` + `min-w-0` en el contenedor son
 * lo que impide que un campo largo desborde la grilla en pantalla angosta.
 */
export const claseInput =
  'w-full min-w-0 min-h-touch rounded-md border border-borde bg-white px-3 py-2 ' +
  'text-base sm:text-sm placeholder:text-tinta/35 focus:border-acento ' +
  'focus:outline-none focus:ring-2 focus:ring-acento/15 disabled:bg-black/[0.03]';

/** Botón principal de una acción. */
export const claseBoton =
  'inline-flex min-h-touch items-center justify-center gap-1.5 rounded-md ' +
  'px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50';

export const claseBotonPrimario = `${claseBoton} bg-acento text-white hover:bg-acento/90`;
export const claseBotonSecundario = `${claseBoton} border border-borde bg-white hover:bg-black/[0.03]`;
export const claseBotonTinta = `${claseBoton} bg-tinta text-white hover:bg-tinta/90`;

/**
 * Acciones chicas dentro de una fila (duplicar, borrar). Mantienen el blanco
 * táctil aunque el texto sea chico: en un listado de sesiones estos botones
 * quedan pegados y sin altura mínima se vuelven imposibles de acertar.
 */
export const claseBotonFila =
  'inline-flex min-h-touch items-center rounded-md px-3 text-xs font-medium ' +
  'transition-colors sm:min-h-9';

/**
 * Ítem de un menú de acciones desplegable. Ocupa todo el ancho y alinea a la
 * izquierda: en un menú, el texto tiene que empezar todo en la misma columna
 * para poder recorrerlo con el ojo. Mantiene el blanco táctil de 44px incluso
 * en `sm`, porque acá los ítems quedan pegados uno al otro.
 */
export const claseBotonMenu =
  'flex w-full min-h-touch items-center rounded-sm px-3 text-left text-sm ' +
  'transition-colors';
