import { useMemo, useState } from 'react';
import { claseInput } from '@/components/campos/Campo';
// §4.2 — mismas reglas que el desplegable, un solo módulo puro (B-72).
import { estaAprobada, pistaDeOpcion, resolverEtiqueta, sugerenciasPara } from '@/lib/taxonomia';
import type { CampoMultivalor, ValorOpcion } from '@/types/actividad';

interface Props {
  /**
   * Qué taxonomía multivalor edita. Estaba fijo en `'tags'`; con
   * `incluye-actividad` (B-830) son dos, y parametrizarlo fue más barato que un
   * segundo widget con la misma lógica del §4.2 — que es lo que B-72 prohíbe.
   *
   * Decide de qué documento de `/opciones/*` salen las sugerencias **y** con qué
   * `detalle` se mide la interacción, así que las dos cosas no pueden divergir.
   */
  campo: CampoMultivalor;
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
  /** Slugs seleccionados. */
  value: string[];
  onChange: (slugs: string[], labelsNuevos: Record<string, string>) => void;
  /** B-827 — id del input, para que el `<label>` del `Campo` lo nombre. */
  id?: string;
}

/**
 * §4 — el editor de una taxonomía autogestionada **multivalor**, con el mismo
 * autocompletado que el resto. Las opciones nuevas se registran en el submit
 * (D-02).
 *
 * **Sirve para las dos multivalor** (`tags` e `incluye-actividad`) y por eso
 * recibe `campo`: el nombre dice `Tags` porque nació con `tags` y renombrarlo
 * costaría más de lo que aclara.
 *
 * No se unifica con `TaxonomiaSelect`: un `<select>` con "Otro" y un input de
 * chips son widgets distintos. Lo que se comparte es la lógica del §4.2
 * (`@/lib/taxonomia`), que es la que no puede divergir (B-72).
 */
export function TagsInput({ campo, valores, elegibles, onMedir, value, onChange, id }: Props) {
  const [texto, setTexto] = useState('');
  const [nuevos, setNuevos] = useState<Record<string, string>>({});

  // Solo lo elegible: un tag pendiente de otra persona no se sugiere (§4.3).
  // Sin `mostrarConTextoVacio`: este input está siempre visible y una lista
  // desplegada sin que nadie escriba taparía el resto del formulario.
  const sugerencias = useMemo(
    () => sugerenciasPara(texto, elegibles, { excluir: value }),
    [texto, elegibles, value],
  );

  // Para mostrar se usa la lista completa: un tag ya guardado en la actividad
  // tiene que verse con su etiqueta aunque todavía no esté aprobado.
  const opcion = (slug: string) => valores.find((v) => v.slug === slug);
  const label = (slug: string) => opcion(slug)?.label ?? nuevos[slug] ?? slug;
  const pendiente = (slug: string) => {
    const v = opcion(slug);
    return v ? !estaAprobada(v) : slug in nuevos;
  };

  const agregar = (slug: string, labelNuevo?: string) => {
    if (!slug || value.includes(slug)) {
      setTexto('');
      return;
    }
    const proximosNuevos = labelNuevo ? { ...nuevos, [slug]: labelNuevo } : nuevos;
    setNuevos(proximosNuevos);
    onChange([...value, slug], proximosNuevos);
    setTexto('');
  };

  const confirmar = () => {
    // §4.2 — si ya existe con ese slug se reusa en lugar de duplicar. Se
    // resuelve contra la lista completa: si el tag ya existe como opción
    // pendiente de otra persona hay que reusar su slug igual.
    const { slug, coincidencia, labelNuevo } = resolverEtiqueta(texto, valores);
    if (!slug) return;
    // Un tag que ya está puesto no es una interacción con la taxonomía: se
    // limpia el input y no se mide nada.
    if (value.includes(slug)) {
      setTexto('');
      return;
    }
    // B-73 — el campo de taxonomía con más volumen esperado era el único que no
    // reportaba nada, así que `detalle: 'tags'` no podía aparecer en GA4 aunque
    // el vocabulario lo declara. Mismos eventos que en el desplegable; no hay
    // `taxonomia-otro` porque acá no hay modo "Otro" que abrir: el input es
    // siempre el de tipear.
    onMedir?.(coincidencia ? 'taxonomia-reusada' : 'taxonomia-nueva', campo);
    agregar(slug, labelNuevo);
  };

  return (
    <div className="relative">
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((slug) => (
            <li
              key={slug}
              className="flex items-center gap-1 rounded-full bg-tinta/8 px-2.5 py-1 text-xs"
            >
              {label(slug)}
              {pendiente(slug) && (
                <span className="text-tinta/45" title="Sin aprobar: todavía no la ven las otras cuentas">
                  · sin aprobar
                </span>
              )}
              <button
                type="button"
                aria-label={`Quitar ${label(slug)}`}
                onClick={() => onChange(value.filter((s) => s !== slug), nuevos)}
                className="text-tinta/45 hover:text-acento"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        id={id}
        className={claseInput}
        value={texto}
        placeholder="Escribí un tag y Enter — ej. narrativa, poesía, principiantes"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            confirmar();
          }
          if (e.key === 'Backspace' && !texto && value.length) {
            onChange(value.slice(0, -1), nuevos);
          }
        }}
      />

      {sugerencias.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-borde bg-white shadow-lg">
          {sugerencias.map((v) => (
            <li key={v.slug}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-black/[0.04]"
                onClick={() => {
                  onMedir?.('taxonomia-sugerencia', campo);
                  agregar(v.slug);
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
