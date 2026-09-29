import { useId, useMemo, useState } from 'react';
import { claseInput } from '@/components/campos/Campo';
// §4.2 — el mismo autocompletado y la misma resolución por slug que el «Otro…»
// de `TaxonomiaSelect`: un módulo puro, dos widgets (B-72).
import { estaAprobada, pistaDeOpcion, resolverEtiqueta, sugerenciasPara } from '@/lib/taxonomia';
import type { CampoTaxonomia, ValorOpcion } from '@/types/actividad';

interface Props {
  campo: CampoTaxonomia;
  /** Todas las opciones del campo: para reconocer una que ya existe (§4.2). */
  valores: ValorOpcion[];
  /** Las que esta cuenta puede elegir (§4.3): las que se sugieren. */
  elegibles: ValorOpcion[];
  onMedir?: (funcion: 'taxonomia-sugerencia', detalle?: string) => void;
  id?: string;
  value: string;
  onChange: (texto: string) => void;
  /** Lo que se lee debajo cuando lo escrito no está en la lista. */
  avisoDeNuevo: string;
  placeholder?: string;
  describedBy?: string;
}

/**
 * **Una taxonomía que se escribe en vez de elegirse** — roadmap 1.5, B-2172.
 *
 * `TaxonomiaSelect` es un desplegable con «Otro…», y sirve cuando la lista es
 * corta y conocida. Para el organizador no: son cientos (266 al 2026-09-28) y la
 * condición del dueño fue que se **escriba** en una caja libre que autocompleta.
 * Lo escrito es el valor del campo tal cual; qué se hace con él al guardar —reusar
 * la opción o darla de alta— lo decide el formulario, no este control.
 *
 * Lo que el control sí hace es avisar antes, que es lo que evita el duplicado
 * (§4.2): las sugerencias mientras se tipea, y debajo si lo escrito ya existe
 * («se usa ésa») o es nuevo.
 */
export function TextoConSugerencias({
  campo,
  valores,
  elegibles,
  onMedir,
  id,
  value,
  onChange,
  avisoDeNuevo,
  placeholder,
  describedBy,
}: Props) {
  const [abierta, setAbierta] = useState(false);
  const idLista = useId();
  const idAviso = useId();

  const { slug, coincidencia } = resolverEtiqueta(value, valores);
  // Sin mostrar la opción que ya es exactamente lo escrito: sugerir lo mismo
  // que está en la caja es ruido.
  const sugerencias = useMemo(
    () => sugerenciasPara(value, elegibles).filter((v) => v.slug !== slug),
    [value, elegibles, slug],
  );
  const mostrarLista = abierta && sugerencias.length > 0;

  return (
    <div className="relative">
      <input
        id={id}
        className={claseInput}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={mostrarLista}
        aria-controls={idLista}
        aria-describedby={[describedBy, slug ? idAviso : ''].filter(Boolean).join(' ') || undefined}
        autoComplete="off"
        autoCapitalize="sentences"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setAbierta(true);
        }}
        onFocus={() => setAbierta(true)}
        onBlur={() => setAbierta(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setAbierta(false);
        }}
      />

      {slug && (
        <p id={idAviso} className="mt-1 text-xs text-tinta/65">
          {coincidencia ? (
            <>
              Ya está en la lista como «{coincidencia.label}»
              {!estaAprobada(coincidencia) && ' (sin aprobar todavía)'}: se usa ésa.
            </>
          ) : (
            avisoDeNuevo
          )}
        </p>
      )}

      {mostrarLista && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto overscroll-contain rounded-md border border-borde bg-white shadow-lg"
        >
          {sugerencias.map((v) => (
            <li key={v.slug} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex min-h-touch w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-black/[0.04]"
                // `mousedown` y no `click`: el `blur` del input cierra la lista
                // antes de que llegue el click, y la sugerencia no se elegiría.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onMedir?.('taxonomia-sugerencia', campo);
                  onChange(v.label);
                  setAbierta(false);
                }}
              >
                <span>{v.label}</span>
                <span className="shrink-0 text-xs text-tinta/65">{pistaDeOpcion(v)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
