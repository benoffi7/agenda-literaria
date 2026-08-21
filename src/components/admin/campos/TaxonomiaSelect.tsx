import { useMemo, useRef, useState } from 'react';
import { useOpciones } from '@/components/admin/useOpciones';
import { claseInput } from '@/components/admin/campos/Campo';
import { normalize } from '@/lib/normalize';
import { slugify } from '@/lib/slugify';
import type { CampoTaxonomia } from '@/types/actividad';

interface Props {
  campo: CampoTaxonomia;
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
export function TaxonomiaSelect({ campo, value, onChange, id, placeholder }: Props) {
  const { valores } = useOpciones(campo);
  const [modoOtro, setModoOtro] = useState(false);
  const [texto, setTexto] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // El valor puede ser un slug creado por "Otro" que todavía no está en el
  // desplegable de esta sesión (recién tipeado): igual hay que mostrarlo.
  const esConocido = valores.some((v) => v.slug === value);

  const sugerencias = useMemo(() => {
    const q = normalize(texto.trim());
    if (!q) return valores.slice(0, 8);
    return valores.filter((v) => normalize(v.label).includes(q)).slice(0, 8);
  }, [texto, valores]);

  // El slug de lo tipeado; si coincide con algo existente, se reusa (§4.2).
  const slugTipeado = slugify(texto);
  const coincidencia = valores.find((v) => v.slug === slugTipeado);

  const confirmarTexto = () => {
    if (!slugTipeado) return;
    if (coincidencia) {
      // Ya existe: se reusa, no se duplica.
      onChange(coincidencia.slug);
    } else {
      onChange(slugTipeado, texto.trim());
    }
    setModoOtro(false);
    setTexto('');
  };

  if (modoOtro) {
    return (
      <div className="relative">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            autoFocus
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
          <button
            type="button"
            className="shrink-0 rounded-md bg-tinta px-3 py-2 text-sm text-white disabled:opacity-40"
            disabled={!slugTipeado}
            onClick={confirmarTexto}
          >
            Usar
          </button>
          <button
            type="button"
            className="shrink-0 rounded-md border border-borde px-3 py-2 text-sm"
            onClick={() => {
              setModoOtro(false);
              setTexto('');
            }}
          >
            Cancelar
          </button>
        </div>

        {coincidencia && (
          <p className="mt-1 text-xs text-acento">
            Ya existe como «{coincidencia.label}» — se va a reusar esa.
          </p>
        )}

        {sugerencias.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-borde bg-white shadow-lg">
            {sugerencias.map((v) => (
              <li key={v.slug}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-black/[0.04]"
                  onClick={() => {
                    onChange(v.slug);
                    setModoOtro(false);
                    setTexto('');
                  }}
                >
                  <span>{v.label}</span>
                  {v.usos > 0 && (
                    <span className="text-xs text-tinta/40">{v.usos} usos</span>
                  )}
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
          setModoOtro(true);
          return;
        }
        onChange(e.target.value);
      }}
    >
      <option value="">{placeholder ?? 'Elegí una opción…'}</option>
      {!esConocido && value && <option value={value}>{value} (nueva)</option>}
      {valores.map((v) => (
        <option key={v.slug} value={v.slug}>
          {v.label}
        </option>
      ))}
      <option value={OTRO}>Otro…</option>
    </select>
  );
}
