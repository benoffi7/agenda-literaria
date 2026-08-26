import { useEffect, useId, useRef, useState } from 'react';
import { claseBotonPrimario, claseBotonSecundario } from '@/components/admin/campos/Campo';
import {
  COPIA_POR_DEFECTO,
  SIEMPRE_AL_DUPLICAR,
  type CasillaCopia,
  type QueCopiar,
} from '@/lib/duplicar';
import { SELECTOR_ENFOCABLE, indiceDeTab } from '@/lib/foco';

interface Props {
  /** Título del original, para que se vea qué se está duplicando. */
  titulo: string;
  /** Las filas que aplican a esta actividad (`casillasAplicables`). */
  casillas: readonly CasillaCopia[];
  onCancelar: () => void;
  onConfirmar: (copiar: QueCopiar) => void;
}

/**
 * B-199 — qué se copia al duplicar.
 *
 * **Por qué es una capa y no una pantalla del panel:** duplicar es un paso
 * intermedio de dos toques ("⋯" → "Duplicar") y lo que sigue es el formulario
 * con la copia adentro. Navegar a una pantalla propia para tildar casillas
 * agrega una vuelta al camino que existe justo para ahorrar trabajo.
 *
 * **El modal es para desmarcar.** El default viene de `COPIA_POR_DEFECTO`
 * (decisión del 2026-08-26): prendido lo que hoy se copia, y apagado solo lo
 * riesgoso —la difusión y las imágenes propias—. Si esto abriera con todo
 * apagado, «el mismo club, la temporada que viene» costaría quince tildes y
 * nadie volvería a usar el botón.
 *
 * **Solo se muestran las casillas que aplican** (`casillasAplicables`): una fila
 * para algo que la actividad no tiene no cambia nada y arruina el vistazo. Si no
 * aplica ninguna, el listado duplica directo y esta capa no aparece.
 *
 * La letra chica de abajo son las decisiones tomadas (D-17, D-18, §7.3): el
 * título marcado, el slug propuesto, las fechas corridas y el borrador. No son
 * casillas porque no son opcionales, pero es acá donde se pueden leer antes de
 * duplicar en vez de descubrirlas en el formulario.
 *
 * **Teclado.** Atrapa el Tab y devuelve el foco al cerrarse, igual que la capa
 * de ayuda (B-64), con la aritmética compartida de `src/lib/foco.ts`. El foco
 * vuelve al "⋯" de la fila y no a la nada: `MenuAcciones` lo devuelve al
 * disparador antes de disparar la acción (`devuelveFoco`), así que el elemento
 * que estaba activo al abrirse esta capa sigue montado cuando se cierra (B-14).
 */
export function DialogoDuplicar({ titulo, casillas, onCancelar, onConfirmar }: Props) {
  const [copiar, setCopiar] = useState<QueCopiar>(COPIA_POR_DEFECTO);
  const caja = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const idAyuda = useId();

  /**
   * `onCancelar` vive en un ref y el efecto de abajo se engancha **una sola
   * vez**.
   *
   * Con la función en las dependencias, un `onCancelar={() => …}` escrito
   * inline en el listado —que es lo normal— es una función nueva por render, así
   * que cualquier re-render del listado con la capa abierta correría la limpieza
   * y volvería a montar el efecto: devolvería el foco, lo re-capturaría (para
   * entonces, la casilla que se está tildando) y se lo llevaría a la caja del
   * diálogo. Tildar dos casillas seguidas dejaría de funcionar por un detalle
   * del llamador.
   */
  const alCancelar = useRef(onCancelar);
  alCancelar.current = onCancelar;

  useEffect(() => {
    // Quién tenía el foco antes de abrir, para devolvérselo al cerrar: el "⋯"
    // de la fila que se está duplicando.
    const anterior = document.activeElement as HTMLElement | null;

    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        alCancelar.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const enfocables = [
        ...(caja.current?.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLE) ?? []),
      ];
      if (enfocables.length === 0) return;

      // Solo se intercepta el Tab que se iría afuera del ciclo: adentro, el Tab
      // nativo respeta el orden del documento mejor que cualquier cálculo.
      // `actual === -1` es el foco en la caja, recién abierta.
      const actual = enfocables.indexOf(document.activeElement as HTMLElement);
      const enElBorde =
        actual === -1 || (e.shiftKey ? actual === 0 : actual === enfocables.length - 1);
      if (!enElBorde) return;

      e.preventDefault();
      enfocables[indiceDeTab(actual, enfocables.length, e.shiftKey)]?.focus();
    };

    document.addEventListener('keydown', teclas);
    // Sin esto, la rueda del mouse sobre la capa scrollea el listado de atrás.
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    caja.current?.focus();
    return () => {
      document.removeEventListener('keydown', teclas);
      document.body.style.overflow = previo;
      anterior?.focus();
    };
    // Sin dependencias a propósito: ver `alCancelar`.
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-tinta/40 sm:items-center sm:p-6"
      // El click sobre el fondo cancela; sobre el contenido, no.
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancelar();
      }}
    >
      <div
        ref={caja}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idAyuda}
        className="flex h-full w-full flex-col bg-papel shadow-xl outline-none sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-lg"
      >
        <header className="shrink-0 border-b border-borde px-segura pt-segura pb-3 sm:px-4 sm:pt-4">
          <h2 id={idTitulo} className="font-serif text-lg font-semibold">
            Duplicar «{titulo}»
          </h2>
          <p id={idAyuda} className="mt-1 text-base text-tinta/65 sm:text-sm">
            Se copia todo lo tildado. Destildá lo que sea de la edición anterior.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-segura py-3 sm:px-4">
          <ul className="flex flex-col">
            {casillas.map((c) => (
              <li key={c.clave}>
                {/*
                  El blanco táctil de 44px es del label entero y no de la
                  casilla: en 360px estas filas quedan pegadas una a otra y el
                  cuadradito nativo mide 13px.
                */}
                <label className="flex min-h-touch cursor-pointer items-start gap-2.5 py-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-acento"
                    checked={copiar[c.clave]}
                    onChange={(e) =>
                      setCopiar((q) => ({ ...q, [c.clave]: e.target.checked }))
                    }
                  />
                  <span className="min-w-0">
                    <span className="block text-base text-tinta sm:text-sm">{c.label}</span>
                    <span className="mt-0.5 block text-sm text-tinta/55 sm:text-xs">
                      {c.ayuda}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-3 rounded-md border border-borde bg-white/60 px-3 py-2.5">
            <p className="text-sm font-medium text-tinta/75 sm:text-xs">
              Siempre, tildes lo que tildes:
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {SIEMPRE_AL_DUPLICAR.map((linea) => (
                <li key={linea} className="text-sm text-tinta/60 sm:text-xs">
                  {linea}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="shrink-0 border-t border-borde px-segura pt-3 pb-segura sm:px-4 sm:pb-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancelar}
              className={`${claseBotonSecundario} flex-1 sm:flex-none`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirmar(copiar)}
              className={`${claseBotonPrimario} flex-1 sm:ml-auto sm:flex-none`}
            >
              Duplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
