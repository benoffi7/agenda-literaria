/**
 * El aviso de lo que quedó sin guardar (B-191).
 *
 * Existe porque **recuperar en silencio es peor que no recuperar**: si al abrir
 * una actividad aparece texto que no está guardado, sin decir de dónde salió, la
 * próxima duda es "¿esto lo guardé o no?". Entonces dice tres cosas —que es de
 * este dispositivo, de cuándo es, y que todavía no está guardado— y deja las dos
 * salidas a la vista.
 */
import { claseBotonFila } from '@/components/admin/campos/Campo';

interface Props {
  /** Cuándo se guardó, ya formateado. */
  cuando: string;
  /**
   * ¿Lo guardado tenía tildada alguna casilla de "mostrar el link sin
   * inscribirse"? Se avisa porque al recuperar vuelven a quedar destildadas, y la
   * casilla puede estar en una sección cerrada donde nadie la ve.
   */
  linksSinPublicar?: boolean;
  onRecuperar: () => void;
  onDescartar: () => void;
}

export function AvisoBorradorLocal({
  cuando,
  linksSinPublicar = false,
  onRecuperar,
  onDescartar,
}: Props) {
  return (
    <div className="rounded-md border border-tinta/20 bg-tinta/[0.04] px-3 py-2.5 text-xs">
      <p className="font-medium">Quedó una carga sin terminar en este dispositivo</p>
      <p className="mt-1 text-tinta/70">
        Se guardó solo, acá en el navegador, el <strong>{cuando}</strong>, y no llegó a
        guardarse en la agenda. Podés seguir desde ahí o descartarlo y quedarte con lo
        que estás viendo.
      </p>
      {linksSinPublicar && (
        <p className="mt-1 text-tinta/70">
          Si seguís con eso, los links de la reunión y del material quedan{' '}
          <strong>sin mostrarse</strong> a quien no se inscribió. Si querías mostrarlos,
          volvé a tildar la casilla.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRecuperar}
          className={`${claseBotonFila} border border-borde bg-white hover:bg-black/[0.03]`}
        >
          Seguir con eso
        </button>
        <button
          type="button"
          onClick={onDescartar}
          className={`${claseBotonFila} text-acento hover:bg-acento/10`}
        >
          Descartar
        </button>
      </div>
    </div>
  );
}
