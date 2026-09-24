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
 *
 * ── Qué dato es, y por qué falla — B-1410 y B-1412 ─────────────────────────
 * **`que` nombra el dato** («el precio», «el costo de asociarse»): la bandeja de
 * bibliotecas no tiene un precio sino un costo, y un aviso que dice «el precio»
 * sobre una biblioteca se lee como un error del panel.
 *
 * **`sinFecha` cambia la frase, no el botón.** `pideRevision` es verdadero
 * también cuando el `cargadoEn` falta o está roto, y en ese caso el sitio **no
 * publica el dato** (`fraseConFecha` lo devuelve vacío): «más de 60 días» sería
 * falso y escondería lo más grave. El gesto es el mismo —refechar con el reloj
 * del servidor lo arregla—, así que lo único que cambia es qué se dice.
 * Quien llama lo calcula con `diasDesdeLaCarga(...) === null`, igual que
 * `pideRevision`: este componente no sabe leer fechas, y así no lo aprende.
 */
interface Props {
  /** Refecha el dato con el reloj del servidor, sin tocar el valor. */
  onConfirmar: () => Promise<void>;
  /** Cómo se llama el dato, con artículo. Por defecto, «el precio». */
  que?: string;
  /** El dato no tiene fecha usable, así que el sitio no lo está publicando. */
  sinFecha?: boolean;
}

export function AvisoDePrecioViejo({ onConfirmar, que = 'el precio', sinFecha = false }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const confirmar = async () => {
    setEnviando(true);
    setFallo(null);
    try {
      await onConfirmar();
    } catch (e: unknown) {
      setFallo(textoDeFallo(e, { respaldo: `No se pudo confirmar ${que}` }));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <span className="ml-1 text-acento">
        {sinFecha
          ? `· ${que} no se está publicando: falta su fecha`
          : `· conviene revisar ${que} (más de ${DIAS_PARA_REVISAR} días)`}
      </span>{' '}
      <button
        type="button"
        onClick={confirmar}
        disabled={enviando}
        className={`${claseBotonFila} ml-1 border border-borde bg-white hover:bg-black/[0.03]`}
        title={`Deja ${que} como está y le pone la fecha de hoy`}
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
