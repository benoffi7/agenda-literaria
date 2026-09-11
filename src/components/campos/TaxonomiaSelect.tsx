import { useEffect, useMemo, useRef, useState } from 'react';
import {
  claseBotonSecundario,
  claseBotonTinta,
  claseInput,
} from '@/components/campos/Campo';
import { desSlug } from '@calendario';
// §4.2 — el autocompletado y la deduplicación por slug son las mismas para los
// dos widgets de taxonomía y viven en un módulo puro (B-72).
import {
  estaAprobada,
  etiquetaConEstado,
  pistaDeOpcion,
  resolverEtiqueta,
  sugerenciasPara,
} from '@/lib/taxonomia';
import type { CampoTaxonomia, ValorOpcion } from '@/types/actividad';

interface Props {
  campo: CampoTaxonomia;
  /**
   * Las opciones del campo y las **elegibles** (§4.3), recibidas y no leídas —
   * B-841.
   *
   * Este control llamaba a `useOpciones(campo, uid)`, y esa cadena llega hasta
   * `firebase/firestore`: cualquier página que lo usara se bajaba el SDK pesado
   * que el corte de B-09 mantiene afuera del primer render del panel. Y un
   * formulario público **no las saca de Firestore**: las saca del `events.json`
   * (§4.4 — «las opciones viajan en el JSON»), así que el hook no era solo un
   * peso: era el mecanismo equivocado.
   *
   * El panel las pasa desde `components/admin/campos-del-panel.tsx`, que es el
   * único lugar donde sigue viviendo el hook.
   *
   * `valores` es la lista **completa** —para resolver la etiqueta de algo ya
   * guardado, incluso pendiente de aprobación— y `elegibles` es lo que se
   * ofrece. La diferencia es de §4.3 y la decide quien las trae.
   */
  valores: ValorOpcion[];
  elegibles: ValorOpcion[];
  /**
   * Qué se mide, **recibido y no importado** (B-841): `@/lib/analytics` es la
   * medición del panel y no tiene portón de consentimiento. Sin esta prop no se
   * mide nada, que es lo correcto para una página pública.
   */
  onMedir?: (funcion: 'taxonomia-nueva' | 'taxonomia-reusada' | 'taxonomia-sugerencia' | 'taxonomia-otro', detalle?: string) => void;
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
  /**
   * ¿Se ofrece «Otro…»? — B-888.
   *
   * `true` por default, que es lo que este control hizo siempre: el default
   * preserva lo anterior, y quien necesita cerrarlo lo dice explícito.
   *
   * En `false` el desplegable sigue sirviendo para elegir —incluido el `option`
   * de rescate de un slug ya guardado que no está en `elegibles`— y no ofrece
   * crear. Es lo que corresponde a una cuenta cuyas escrituras a `/opciones/*`
   * las reglas rechazan: ofrecer el alta sería ofrecer algo que siempre falla, y
   * encima en silencio, porque la actividad sí se guarda.
   */
  permitirOtro?: boolean;
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
  valores,
  elegibles,
  onMedir,
  value,
  onChange,
  id,
  placeholder,
  autoSeleccionarPrimera = false,
  permitirOtro = true,
}: Props) {
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
    onMedir?.(coincidencia ? 'taxonomia-reusada' : 'taxonomia-nueva', campo);
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
            /*
             * B-827 — el **mismo** id que el `<select>` de abajo, y no otro: el
             * `<label>` del `Campo` apunta a uno solo, y las dos ramas son
             * excluyentes, así que el id nunca está dos veces en el DOM. Sin
             * esto, entrar en «Otro» —que además hace `autoFocus`— dejaba el
             * campo sin nombre accesible justo en el momento en que se está
             * tipeando en él.
             */
            id={id}
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
                    onMedir?.('taxonomia-sugerencia', campo);
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
        // El `permitirOtro` va **también acá** y no solo en el `option` de
        // abajo: sin esta mitad, el valor centinela seguiría siendo alcanzable
        // por teclado o por un `option` de una versión cacheada, y el control
        // entraría en un modo que la cuenta no puede completar.
        if (permitirOtro && e.target.value === OTRO) {
          onMedir?.('taxonomia-otro', campo);
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
          {/*
            B-132 — `value` es el SLUG, no la etiqueta. Pintarlo pelado hacía
            que al tipear «Villa Crespo» en «Otro…» el desplegable dijera
            `villa-crespo (nueva)`, y al reeditar una actividad cuya etiqueta
            nunca llegó a registrarse, `con-beca-parcial (nueva)`.

            Se resuelve con el MISMO des-slug que usa la descripción del evento
            público, importado de `@calendario` y no copiado (D-20): si el
            respaldo del panel y el del calendario divergen, el mismo slug se
            lee distinto en cada lado y nada falla. El panel era el único lugar
            que todavía mostraba el slug pelado — que es exactamente lo que
            D-11 describe como "se ve roto".
          */}
          {pendienteAjena
            ? `${pendienteAjena.label} (sin aprobar)`
            : `${desSlug(value)} (nueva)`}
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
      {permitirOtro && <option value={OTRO}>Otro…</option>}
    </select>
  );
}
