import { claseBotonFila } from '@/components/admin/campos/Campo';

interface Props {
  /** Los labels tal como se tipearon. Vacío = no se pinta nada. */
  etiquetas: readonly string[];
  /** Lleva a la pantalla de opciones, donde la etiqueta se crea en un clic. */
  onIrAOpciones: () => void;
  onCerrar: () => void;
}

/**
 * B-177 — la etiqueta nueva que se guardó y no quedó registrada.
 *
 * Con el orden de escritura de D-100 la actividad se escribe **primero** y las
 * etiquetas nuevas después, así que un fallo en el segundo paso deja el guardado
 * como un éxito y la etiqueta sin registrar. Ese modo de falla se eligió a
 * propósito —es recuperable tipeándola otra vez, y al revés se perdía la
 * actividad entera— pero hasta acá **no se veía**: `guardarActividad` devolvía el
 * dato y nadie lo miraba.
 *
 * ── Por qué vive acá y no en el formulario ─────────────────────────────────
 * Al guardar, el formulario se desmonta y la pantalla pasa al listado. Las dos
 * salidas que el ítem nombraba eran una franja en el listado o quedarse en el
 * formulario con el aviso; la segunda es peor: la actividad **ya está escrita**,
 * así que un formulario que se queda abierto invita a un segundo guardado que
 * choca contra su propio slug. La franja va entonces en el chasis del panel, que
 * es lo único que sobrevive al cambio de vista, y no depende de a dónde se
 * vuelva (listado o calendario).
 *
 * ── Por qué recién ahora vale la pena ──────────────────────────────────────
 * El ítem decía "vale más el día que exista la UI de taxonomías (B-06), que es
 * donde la etiqueta faltante se arregla en un clic". Ese día llegó (B-170), así
 * que el aviso tiene a dónde mandar y no es solo una mala noticia.
 *
 * El texto le habla a quien organiza actividades: no dice "no se registró en
 * `/opciones`", dice que no quedó en la lista para la próxima vez.
 */
export function AvisoEtiquetas({ etiquetas, onIrAOpciones, onCerrar }: Props) {
  if (etiquetas.length === 0) return null;
  const una = etiquetas.length === 1;

  return (
    <div
      role="status"
      className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
    >
      <p className="font-medium">
        {una
          ? 'La actividad se guardó, pero la etiqueta nueva no quedó en la lista'
          : 'La actividad se guardó, pero las etiquetas nuevas no quedaron en la lista'}
        {': '}
        {etiquetas.map((e) => `«${e}»`).join(', ')}.
      </p>
      <p className="mt-1">
        {/*
          Lo que sí pasó, primero: sin esto el aviso se lee como "se perdió algo"
          y lo que se perdió es chico. La actividad guardó el valor elegido; lo
          que falta es el nombre con el que se escribió, así que el sitio y el
          calendario lo muestran deducido del valor y pueden cambiarle las
          mayúsculas (D-11).
        */}
        La actividad quedó guardada con {una ? 'ella' : 'ellas'}, así que donde se
        publique va a aparecer igual —puede que con las mayúsculas distintas de
        como {una ? 'la' : 'las'} escribiste—. Lo que no pasó es que se{' '}
        {una ? 'sume' : 'sumen'} a la lista de opciones para la próxima vez.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onIrAOpciones}
          className={`${claseBotonFila} border border-amber-300 bg-white text-amber-900 hover:bg-amber-100`}
        >
          Ir a Opciones
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className={`${claseBotonFila} text-amber-900/70 hover:bg-amber-100`}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
