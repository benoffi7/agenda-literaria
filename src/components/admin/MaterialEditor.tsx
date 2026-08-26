import {
  claseBotonFila,
  claseBotonTinta,
  claseInput,
} from '@/components/admin/campos/Campo';
import {
  ENTREGAS_MATERIAL,
  TIPOS_MATERIAL,
  type ItemMaterial,
} from '@/types/actividad';
import { ETIQUETA_TIPO_MATERIAL } from '@calendario';

interface Props {
  items: ItemMaterial[];
  onChange: (items: ItemMaterial[]) => void;
  error?: string;
}

const itemVacio = (): ItemMaterial => ({
  tipo: 'lectura',
  titulo: '',
  url: '',
  entrega: 'previo',
  // Por defecto privado: publicar un link por error es más caro que el clic
  // extra de tildarlo (§5.1).
  publico: false,
});

/**
 * En mayúscula inicial: acá es el texto de un desplegable, no una frase. El
 * evento público tiene su propio mapa en minúscula porque ahí cae a mitad de
 * una línea. Esa diferencia es deliberada (ver `functions/calendario.js`).
 */
const ETIQUETA_ENTREGA: Record<(typeof ENTREGAS_MATERIAL)[number], string> = {
  previo: 'Previo al encuentro',
  'al-inscribirse': 'Al inscribirse',
  'durante-el-mes': 'Durante el mes',
  'en-el-encuentro': 'En el encuentro',
};

/** §4 / §5.1 — material, sobre todo de club de lectura. */
export function MaterialEditor({ items, onChange, error }: Props) {
  const editar = (i: number, cambios: Partial<ItemMaterial>) =>
    onChange(items.map((it, j) => (j === i ? { ...it, ...cambios } : it)));

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onChange([...items, itemVacio()])}
        className={`${claseBotonTinta} w-full sm:w-auto sm:self-start`}
      >
        + Agregar material
      </button>

      {error && (
        <p data-campo-con-error className="scroll-mt-16 text-xs font-medium text-acento">
          {error}
        </p>
      )}

      {items.map((it, i) => (
        <div key={i} className="rounded-md border border-borde bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              Tipo
              <select
                value={it.tipo}
                onChange={(e) =>
                  editar(i, { tipo: e.target.value as ItemMaterial['tipo'] })
                }
                className={claseInput}
              >
                {TIPOS_MATERIAL.map((t) => (
                  <option key={t} value={t}>
                    {/*
                      B-134 — pintaba `{t}`, o sea el valor crudo: el
                      desplegable decía "guia" y "autor" mientras el evento
                      público decía "Guía" y "Sobre el autor". Es la misma
                      forma que B-76 y B-132, tercera aparición. El mapa se
                      importa de `@calendario` y no se copia (D-20).
                    */}
                    {ETIQUETA_TIPO_MATERIAL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Entrega
              <select
                value={it.entrega}
                onChange={(e) =>
                  editar(i, { entrega: e.target.value as ItemMaterial['entrega'] })
                }
                className={claseInput}
              >
                {ENTREGAS_MATERIAL.map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_ENTREGA[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              Título
              <input
                value={it.titulo}
                onChange={(e) => editar(i, { titulo: e.target.value })}
                placeholder="Pedro Páramo — edición Cátedra"
                className={claseInput}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              URL
              <input
                type="url"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={it.url}
                onChange={(e) => editar(i, { url: e.target.value })}
                placeholder="https://…"
                className={claseInput}
              />
            </label>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex min-h-touch flex-1 items-center gap-2 text-xs text-tinta/70">
              <input
                type="checkbox"
                className="size-4 shrink-0"
                checked={it.publico}
                onChange={(e) => editar(i, { publico: e.target.checked })}
              />
              El link se muestra sin inscribirse
            </label>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Borrar material ${it.titulo || i + 1}`}
              className={`${claseBotonFila} shrink-0 text-acento hover:bg-acento/10`}
            >
              Borrar
            </button>
          </div>

          {!it.publico && it.url && (
            <p className="mt-1 text-[11px] text-tinta/50">
              En el sitio público van solo el tipo y el título; la URL no sale (§5.1).
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
