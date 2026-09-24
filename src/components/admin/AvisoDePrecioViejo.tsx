import { useState } from 'react';
import { claseBotonFila } from '@/components/campos/Campo';
import { DIAS_PARA_REVISAR } from '@/lib/datoConFecha';
import { textoDeFallo } from '@/lib/fallosDelPanel';

/**
 * **El aviso de los sesenta días, con su salida** — B-913.
 *
 * El aviso (`pideRevision`, B-837) ya se pintaba en la bandeja de suscripciones y
 * en la de lugares, y le faltaba la mitad: decir «lo revisé y sigue siendo éste».
 * Sin eso la única forma de bajarlo era cambiarle el número al precio, que es
 * mentir, o dejarlo puesto para siempre, que es enseñar a ignorarlo.
 *
 * Es **un solo componente para las dos bandejas** por lo mismo que el predicado
 * es uno solo: «viejo» y «lo revisé» tienen que querer decir lo mismo en las dos
 * pantallas. Y **recibe** la escritura en vez de importarla (§ «Un control
 * compartido recibe, no importa» de `05-patrones.md`): así no sabe de qué
 * colección es, y se prueba montado sin Firestore.
 *
 * Quien lo usa decide **si** se pinta (con `pideRevision`); acá solo se decide
 * cómo se ve y qué pasa al tocar el botón. El aviso desaparece solo cuando el
 * snapshot trae la fecha nueva — no hay estado local que lo esconda antes, así
 * que si la escritura rebota el aviso sigue ahí, que es lo cierto.
 */
interface Props {
  /** Refecha el precio con el reloj del servidor, sin tocar el valor. */
  onConfirmar: () => Promise<void>;
}

export function AvisoDePrecioViejo({ onConfirmar }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const confirmar = async () => {
    setEnviando(true);
    setFallo(null);
    try {
      await onConfirmar();
    } catch (e: unknown) {
      setFallo(textoDeFallo(e, { respaldo: 'No se pudo confirmar el precio' }));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <span className="ml-1 text-acento">
        · conviene revisar el precio (más de {DIAS_PARA_REVISAR} días)
      </span>{' '}
      <button
        type="button"
        onClick={confirmar}
        disabled={enviando}
        className={`${claseBotonFila} ml-1 border border-borde bg-white hover:bg-black/[0.03]`}
        title="Deja el mismo precio y le pone la fecha de hoy"
      >
        {enviando ? 'Confirmando…' : 'Lo revisé: sigue siendo éste'}
      </button>
      {fallo && (
        <span role="alert" className="ml-1 font-medium text-acento">
          {fallo}
        </span>
      )}
    </>
  );
}
