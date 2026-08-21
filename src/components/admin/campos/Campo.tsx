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
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-tinta">
        {label}
        {requerido && <span className="ml-0.5 text-acento">*</span>}
      </label>
      {children}
      {ayuda && !error && <p className="text-xs text-tinta/55">{ayuda}</p>}
      {error && <p className="text-xs font-medium text-acento">{error}</p>}
    </div>
  );
}

export const claseInput =
  'w-full rounded-md border border-borde bg-white px-3 py-2 text-sm ' +
  'placeholder:text-tinta/35 focus:border-acento focus:outline-none ' +
  'focus:ring-2 focus:ring-acento/15 disabled:bg-black/[0.03]';
