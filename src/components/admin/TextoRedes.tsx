import { useEffect, useMemo, useRef, useState } from 'react';
import {
  claseBotonChip,
  claseBotonChipActivo,
  claseBotonSecundario,
} from '@/components/admin/campos/Campo';
import { useLabelsTaxonomia } from '@/components/admin/useOpciones';
import {
  AYUDA_VARIANTE,
  ETIQUETA_VARIANTE,
  VARIANTES_REDES,
  textoRedesDeForm,
  type VarianteRedes,
} from '@/lib/textoRedes';
import type { LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import type { ActividadForm } from '@/types/actividad';

interface Props {
  form: ActividadForm;
  /**
   * Etiquetas creadas con "Otro" que todavía no están en `/opciones/*` porque se
   * persisten en el submit (D-02). Sin esto el texto diría "A La Gorra" en lugar
   * de "A la gorra" para una opción recién tipeada.
   */
  labelsPendientes?: LabelsTaxonomia;
}

/** Límite de la caption de Instagram. Pasado eso, el texto se corta al pegarlo. */
const LIMITE_CAPTION = 2200;

const claseAviso = 'rounded-md px-3 py-2 text-xs';

/**
 * B-95 — el texto listo para pegar en redes, armado con lo que ya está cargado.
 *
 * Todo el criterio vive en `src/lib/textoRedes.ts`, que es puro y está testeado
 * sin emuladores: acá adentro no se decide qué sale y qué no. Es la misma
 * división que la vista previa del evento (B-12), y por el mismo motivo — las
 * reglas de privacidad del §5.1 no pueden vivir en un `.tsx`, donde ningún test
 * las puede ejecutar.
 *
 * **El botón de copiar degrada.** `navigator.clipboard` no existe en un contexto
 * no seguro (http, un `file://`, un WebView viejo) y puede fallar aunque exista.
 * Cuando eso pasa se selecciona el texto y se dice qué hacer: el texto vive en un
 * `<textarea readOnly>` justamente para que copiarlo a mano sea un gesto, no una
 * pelea con el mouse. Lo que no puede pasar es que el trabajo quede inalcanzable
 * porque el navegador no colaboró.
 */
export function TextoRedes({ form, labelsPendientes }: Props) {
  const [variante, setVariante] = useState<VarianteRedes>('anuncio');
  const [copia, setCopia] = useState<'nada' | 'copiado' | 'manual'>('nada');
  const area = useRef<HTMLTextAreaElement>(null);
  const labels = useLabelsTaxonomia(labelsPendientes);

  const resultado = useMemo(
    // El reloj se lee acá y entra como parámetro (`docs/05-patrones.md`): el
    // módulo puro no llama a `Date.now()`, así que sus tests no dependen de qué
    // día es hoy.
    () => textoRedesDeForm(form, variante, new Date(), labels),
    [form, variante, labels],
  );

  // Un "copiado" que sobrevive al cambio de variante miente sobre qué hay en el
  // portapapeles.
  useEffect(() => setCopia('nada'), [variante, resultado]);

  const copiar = async () => {
    const texto = resultado.ok ? resultado.texto : '';
    if (!texto) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('sin portapapeles');
      await navigator.clipboard.writeText(texto);
      setCopia('copiado');
    } catch {
      // Sin portapapeles: se deja el texto seleccionado y se dice el atajo.
      area.current?.focus();
      area.current?.select();
      setCopia('manual');
    }
  };

  const largo = resultado.ok ? resultado.texto.length : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Variante del texto">
        {VARIANTES_REDES.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === variante}
            title={AYUDA_VARIANTE[v]}
            className={v === variante ? claseBotonChipActivo : claseBotonChip}
            onClick={() => setVariante(v)}
          >
            {ETIQUETA_VARIANTE[v]}
          </button>
        ))}
      </div>
      <p className="text-xs text-tinta/55">{AYUDA_VARIANTE[variante]}</p>

      {!resultado.ok ? (
        <p className="rounded-md border border-borde bg-white px-3 py-2 text-sm text-tinta/60">
          {resultado.motivo}
        </p>
      ) : (
        <>
          {/*
            Texto plano en un `textarea` de solo lectura: conserva los saltos de
            línea, se puede seleccionar entero de un gesto y en el teléfono se
            desplaza solo. `readOnly` y no `disabled`, que impediría seleccionarlo.
          */}
          <textarea
            ref={area}
            readOnly
            aria-label={`Texto para publicar — ${ETIQUETA_VARIANTE[variante]}`}
            value={resultado.texto}
            rows={Math.min(26, resultado.texto.split('\n').length + 1)}
            className="w-full min-w-0 rounded-md border border-borde bg-papel px-3 py-2 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap sm:text-sm"
            onFocus={(e) => e.currentTarget.select()}
          />

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={claseBotonSecundario} onClick={copiar}>
              Copiar el texto
            </button>
            <p aria-live="polite" className="text-xs text-tinta/60">
              {copia === 'copiado' && 'Copiado.'}
              {copia === 'manual' &&
                'No pude usar el portapapeles: el texto quedó seleccionado, copialo con Ctrl+C (⌘+C en Mac).'}
              {copia === 'nada' && `${largo} caracteres`}
            </p>
          </div>

          {largo > LIMITE_CAPTION && (
            <p className={`${claseAviso} border border-amber-300 bg-amber-50 text-amber-900`}>
              El texto tiene {largo} caracteres y una publicación de Instagram admite{' '}
              {LIMITE_CAPTION}: recortá algo antes de pegarlo, o usá «Recordatorio», que es más
              corto.
            </p>
          )}

          {/*
            Lo mismo que hace la vista previa del evento con el link de la
            reunión: decir en pantalla qué NO sale. Acá es más fuerte —un posteo
            no se despublica— y además explica de dónde salen los handles, que es
            la parte que nadie adivina.
          */}
          <p className={`${claseAviso} border border-borde bg-white text-tinta/60`}>
            El link de la reunión no sale nunca, ni con «Publicar el link» tildado: un posteo se
            copia y no se despublica. Las notas internas de Difusión tampoco. Los handles del final
            salen de «Arrobar al publicar», más los Instagram del organizador y de quien está al
            frente, sin repetir.
          </p>
        </>
      )}
    </div>
  );
}
