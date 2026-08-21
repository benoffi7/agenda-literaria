import { useMemo, useState } from 'react';
import { claseInput } from '@/components/admin/campos/Campo';
import { useOpciones } from '@/components/admin/useOpciones';
import { normalize } from '@/lib/normalize';
import { estaAprobada } from '@/lib/opciones';
import { slugify } from '@/lib/slugify';

interface Props {
  /** uid de quien carga: decide qué tags pendientes puede elegir (§4.3). */
  uid: string;
  /** Slugs seleccionados. */
  value: string[];
  onChange: (slugs: string[], labelsNuevos: Record<string, string>) => void;
}

/**
 * §4 — `tags` usa la misma taxonomía autogestionada que el resto, con el mismo
 * autocompletado. Los tags nuevos se registran en el submit.
 */
export function TagsInput({ uid, value, onChange }: Props) {
  const { valores, elegibles } = useOpciones('tags', uid);
  const [texto, setTexto] = useState('');
  const [nuevos, setNuevos] = useState<Record<string, string>>({});

  // Solo lo elegible: un tag pendiente de otra persona no se sugiere (§4.3).
  const sugerencias = useMemo(() => {
    const q = normalize(texto.trim());
    if (!q) return [];
    return elegibles
      .filter((v) => normalize(v.label).includes(q) && !value.includes(v.slug))
      .slice(0, 6);
  }, [texto, elegibles, value]);

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
    const slug = slugify(texto);
    if (!slug) return;
    // Si ya existe con ese slug, se reusa en lugar de duplicar (§4.2). Se busca
    // en la lista completa: si el tag ya existe como opción pendiente de otra
    // persona hay que reusar su slug igual, no crear un duplicado.
    const existente = valores.find((v) => v.slug === slug);
    agregar(slug, existente ? undefined : texto.trim());
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
                onClick={() => agregar(v.slug)}
              >
                <span>{v.label}</span>
                <span className="shrink-0 text-xs text-tinta/40">
                  {!estaAprobada(v) ? 'sin aprobar' : v.usos > 0 ? `${v.usos} usos` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
