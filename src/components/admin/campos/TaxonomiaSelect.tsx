import { useEffect, useMemo, useRef, useState } from 'react';
import { useOpciones } from '@/components/admin/useOpciones';
import {
  claseBotonSecundario,
  claseBotonTinta,
  claseInput,
} from '@/components/admin/campos/Campo';
import { medirFuncion } from '@/lib/analytics';
import { estaAprobada } from '@/lib/opciones';
// §4.2 — el autocompletado y la deduplicación por slug son las mismas para los
// dos widgets de taxonomía y viven en un módulo puro (B-72).
import {
  etiquetaConEstado,
  pistaDeOpcion,
  resolverEtiqueta,
  sugerenciasPara,
} from '@/lib/taxonomia';
import type { CampoTaxonomia } from '@/types/actividad';

interface Props {
  campo: CampoTaxonomia;
  /**
   * uid de quien está cargando. Decide qué opciones pendientes de aprobación
   * puede elegir: las propias sí, las de otra persona no (§4.3).
   */
  uid: string;
  /** Slug seleccionado. */
  value: string;
  /**
   * Devuelve el slug elegido y, si es nuevo, el label a persistir.
   * El `upsertOpcion` lo hace el submit, no este componente: si se guardara acá,
   * abandonar el formulario dejaría basura en la taxonomía.
   */
  onChange: (slug: string, labelNuevo?: string) => void;
  id?: string;
  placeholder?: string;
  /**
   * Preselecciona la primera opción del desplegable cuando el campo está
   * vacío, para no obligar a tocar un desplegable que ya muestra lo correcto.
   *
   * Se usa donde equivocarse es barato: `tipo` y `plataforma`. **No** en
   * `arancel`: ahí el default sería "Gratis" y un taller pago que nadie
   * corrige se publica como gratuito, en el sitio y en el calendario. Un clic
   * más por actividad vale menos que eso.
   *
   * No hace nada en taxonomías que arrancan sin opciones base (barrio, tags).
   */
  autoSeleccionarPrimera?: boolean;
}

const OTRO = '__otro__';

/**
 * §4 — desplegable enumerado + casilla "Otro" cuyo valor se incorpora al
 * desplegable para usos futuros.
 *
 * El input de "Otro" tiene autocompletado contra la lista existente (§4.2):
 * si el usuario escribe "gor" y aparece "A la gorra", el 90% de los duplicados
 * no llega a nacer.
 */
export function TaxonomiaSelect({
  campo,
  uid,
  value,
  onChange,
  id,
  placeholder,
  autoSeleccionarPrimera = false,
}: Props) {
  const { valores, elegibles } = useOpciones(campo, uid);
  const [modoOtro, setModoOtro] = useState(false);
  const [texto, setTexto] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Las opciones llegan de Firestore, así que la preselección no se puede
  // hacer en el estado inicial del formulario: recién acá se sabe cuál es la
  // primera. Solo dispara con el campo vacío, así que nunca pisa una elección
  // hecha a mano ni el valor de una actividad que se está editando.
  useEffect(() => {
    if (!autoSeleccionarPrimera || value || elegibles.length === 0) return;
    onChange(elegibles[0]!.slug);
  }, [autoSeleccionarPrimera, value, elegibles, onChange]);

  // El valor puede ser un slug creado por "Otro" que todavía no está en el
  // desplegable de esta sesión (recién tipeado): igual hay que mostrarlo.
  const esConocido = elegibles.some((v) => v.slug === value);

  // §4.3 — o puede ser una opción pendiente creada por OTRA persona: no es
  // elegible, pero la actividad la guardó legítimamente, así que se muestra su
  // etiqueta (mostrar el slug crudo se ve roto) y el select conserva el valor.
  const pendienteAjena = !esConocido && value ? valores.find((v) => v.slug === value) : undefined;

  // Con el input vacío se muestran las primeras: entrar a "Otro" es un paso
  // deliberado y ver qué hay orienta antes de tipear.
  const sugerencias = useMemo(
    () => sugerenciasPara(texto, elegibles, { mostrarConTextoVacio: true }),
    [texto, elegibles],
  );

  // §4.2 — lo tipeado, resuelto contra la lista COMPLETA: si la etiqueta ya
  // existe como opción pendiente de otra persona hay que reusar su slug igual.
  const { slug: slugTipeado, coincidencia, labelNuevo } = resolverEtiqueta(texto, valores);

  const confirmarTexto = () => {
    if (!slugTipeado) return;
    medirFuncion(coincidencia ? 'taxonomia-reusada' : 'taxonomia-nueva', campo);
    // Ya existe: se reusa, no se duplica.
    onChange(slugTipeado, labelNuevo);
    setModoOtro(false);
    setTexto('');
  };

  if (modoOtro) {
    return (
      <div className="relative">
        {/*
          El input y sus dos botones no caben en fila en un teléfono angosto:
          hasta sm el input toma el ancho completo y los botones van abajo,
          repartidos mitad y mitad.
        */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={inputRef}
            autoFocus
            enterKeyHint="done"
            autoCapitalize="sentences"
            className={claseInput}
            value={texto}
            placeholder="Escribí una etiqueta nueva"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmarTexto();
              }
              if (e.key === 'Escape') {
                setModoOtro(false);
                setTexto('');
              }
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className={`${claseBotonTinta} flex-1 sm:flex-none`}
              disabled={!slugTipeado}
              onClick={confirmarTexto}
            >
              Usar
            </button>
            <button
              type="button"
              className={`${claseBotonSecundario} flex-1 sm:flex-none`}
              onClick={() => {
                setModoOtro(false);
                setTexto('');
              }}
            >
              Cancelar
            </button>
          </div>
        </div>

        {coincidencia && (
          <p className="mt-1 text-xs text-acento">
            Ya existe como «{coincidencia.label}»
            {!estaAprobada(coincidencia) && ' (sin aprobar todavía)'} — se va a reusar
            esa.
          </p>
        )}

        {sugerencias.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto overscroll-contain rounded-md border border-borde bg-white shadow-lg">
            {sugerencias.map((v) => (
              <li key={v.slug}>
                <button
                  type="button"
                  className="flex min-h-touch w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-black/[0.04]"
                  onClick={() => {
                    medirFuncion('taxonomia-sugerencia', campo);
                    onChange(v.slug);
                    setModoOtro(false);
                    setTexto('');
                  }}
                >
                  <span>{v.label}</span>
                  <span className="shrink-0 text-xs text-tinta/40">{pistaDeOpcion(v)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <select
      id={id}
      className={claseInput}
      value={value || ''}
      onChange={(e) => {
        if (e.target.value === OTRO) {
          medirFuncion('taxonomia-otro', campo);
          setModoOtro(true);
          return;
        }
        onChange(e.target.value);
      }}
    >
      {/*
        Este option vale "": es un prompt, no una opción. El texto tiene que
        leerse como una instrucción — un placeholder tipo "Gratis, a la
        gorra…" se ve idéntico a un valor ya elegido y hace creer que el
        campo está completo cuando está vacío.
      */}
      <option value="">{placeholder ?? 'Elegí una opción…'}</option>
      {!esConocido && value && (
        <option value={value}>
          {pendienteAjena ? `${pendienteAjena.label} (sin aprobar)` : `${value} (nueva)`}
        </option>
      )}
      {elegibles.map((v) => (
        <option key={v.slug} value={v.slug}>
          {/*
            §4.3 — marcar las propias sin aprobar: si no, quien las creó no
            tiene forma de entender por qué la otra cuenta no las ve.
          */}
          {etiquetaConEstado(v)}
        </option>
      ))}
      <option value={OTRO}>Otro…</option>
    </select>
  );
}
