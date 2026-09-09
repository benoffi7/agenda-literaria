import type { ReactNode } from 'react';

interface Props {
  label: string;
  /**
   * B-827 — **obligatorio**, y es el id del control que este campo rotula.
   *
   * Era opcional y once usos no lo pasaban, así que el `<label>` quedaba
   * huérfano y un lector de pantalla anunciaba «cuadro de texto» y nada más en
   * un formulario de treinta y pico de campos. La asociación era opt-in: el que
   * se agregaba mañana nacía mal por default. Requerido, el compilador enumera
   * los que faltan y el que venga después no puede olvidarse.
   *
   * El hijo tiene que llevar **este mismo** `id` — o, si el campo rotula un
   * grupo de controles y no uno solo, usar `comoGrupo` (ver abajo).
   * `tests/clases-de-bug.test.ts` barre los usos y exige el par.
   */
  htmlFor: string;
  /**
   * El campo rotula un **grupo** de controles, no uno solo: la tira de botones
   * de modalidad, los dos botones de «¿Qué es?», el editor de galería.
   *
   * Un `<label for>` apunta a un único control, así que acá no sirve: el rótulo
   * pasa a ser un `<span id>` y los hijos van dentro de un `role="group"` que lo
   * referencia con `aria-labelledby`. Es la misma garantía —el grupo tiene
   * nombre accesible— con el mecanismo que corresponde, y `htmlFor` sigue
   * siendo obligatorio porque sigue habiendo un id que atar.
   */
  comoGrupo?: boolean;
  error?: string;
  ayuda?: string;
  requerido?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Envoltorio de campo: label, ayuda y error. Un solo lugar para el layout.
 *
 * El campo rechazado queda marcado en el DOM con `data-campo-con-error`, que es
 * lo que el formulario usa para scrollear hasta **el primero** después de un
 * guardado que falló (B-184). Es un atributo y no una lista de ids porque el
 * orden que importa —cuál es el primero— es el del documento, y el DOM ya lo
 * sabe: `querySelector` devuelve justo ese, sin que nadie mantenga el orden a
 * mano.
 */
export function Campo({
  label,
  htmlFor,
  comoGrupo = false,
  error,
  ayuda,
  requerido,
  children,
  className = '',
}: Props) {
  const rotulo = (
    <>
      {label}
      {requerido && <span className="ml-0.5 text-acento">*</span>}
    </>
  );
  const claseRotulo = 'text-sm font-medium text-tinta';

  return (
    <div
      data-campo-con-error={error ? '' : undefined}
      className={`flex min-w-0 scroll-mt-16 flex-col gap-1.5 ${className}`}
    >
      {comoGrupo ? (
        <span id={htmlFor} className={claseRotulo}>
          {rotulo}
        </span>
      ) : (
        <label htmlFor={htmlFor} className={claseRotulo}>
          {rotulo}
        </label>
      )}
      {comoGrupo ? (
        <div role="group" aria-labelledby={htmlFor} className="flex min-w-0 flex-col gap-1.5">
          {children}
        </div>
      ) : (
        children
      )}
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
 * Chip de un grupo donde una opción está elegida y las otras no: el filtro por
 * estado de publicación del calendario, el cambio entre agenda y mes.
 *
 * Son dos clases y no una con un booleano de color suelto en el componente,
 * porque "elegido" es parte del estilo del control y no del layout: si cada uso
 * pinta su propio activo, en dos pantallas ya son dos grises distintos.
 */
const claseChipBase =
  'inline-flex min-h-touch items-center rounded-full border px-3 text-xs font-medium ' +
  'transition-colors sm:min-h-9';

export const claseBotonChip = `${claseChipBase} border-borde bg-white hover:bg-black/[0.03]`;
export const claseBotonChipActivo = `${claseChipBase} border-tinta bg-tinta text-white`;

/**
 * Enlace-acción dentro de una celda apretada — la grilla del calendario, donde
 * no entra un botón con su blanco táctil completo. Es la única variante que se
 * salta el `min-h-touch` a propósito, y por eso está acá y no suelta en el
 * componente: si hace falta otra vez, se reusa esta.
 */
export const claseEnlaceCelda =
  'rounded px-1 text-left text-xs text-acento hover:bg-black/5';

/**
 * Ítem de un menú de acciones desplegable. Ocupa todo el ancho y alinea a la
 * izquierda: en un menú, el texto tiene que empezar todo en la misma columna
 * para poder recorrerlo con el ojo. Mantiene el blanco táctil de 44px incluso
 * en `sm`, porque acá los ítems quedan pegados uno al otro.
 */
export const claseBotonMenu =
  'flex w-full min-h-touch items-center rounded-sm px-3 text-left text-sm ' +
  'transition-colors';
