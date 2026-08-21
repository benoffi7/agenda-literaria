import { useMemo, useState } from 'react';
import { claseInput } from '@/components/admin/campos/Campo';
import { useOpciones } from '@/components/admin/useOpciones';
import { normalize } from '@/lib/normalize';
import { slugify } from '@/lib/slugify';

interface Props {
  /** Slugs seleccionados. */
  value: string[];
  onChange: (slugs: string[], labelsNuevos: Record<string, string>) => void;
}

/**
 * §4 — `tags` usa la misma taxonomía autogestionada que el resto, con el mismo
 * autocompletado. Los tags nuevos se registran en el submit.
 */
export function TagsInput({ value, onChange }: Props) {
  const { valores } = useOpciones('tags');
  const [texto, setTexto] = useState('');
  const [nuevos, setNuevos] = useState<Record<string, string>>({});

  const sugerencias = useMemo(() => {
    const q = normalize(texto.trim());
    if (!q) return [];
    return valores
      .filter((v) => normalize(v.label).includes(q) && !value.includes(v.slug))
      .slice(0, 6);
  }, [texto, valores, value]);

  const label = (slug: string) =>
    valores.find((v) => v.slug === slug)?.label ?? nuevos[slug] ?? slug;

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
    // Si ya existe con ese slug, se reusa en lugar de duplicar (§4.2).
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
                {v.usos > 0 && <span className="text-xs text-tinta/40">{v.usos} usos</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
