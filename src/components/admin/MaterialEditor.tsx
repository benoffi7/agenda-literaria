import {
  Campo,
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
  /**
   * B-197 — el mapa entero, no el error de la lista.
   *
   * Antes entraba un solo `error?: string` —el de `material.items`— así que el
   * rechazo de **una** fila puntual solo se leía en la barra de abajo («Título
   * del material») y con dos filas cargadas el mensaje no decía cuál de las
   * dos. Era la única familia de campos del formulario que no mostraba su
   * propio error, y el patrón que la mantenía así era justo este: el editor no
   * recibía con qué.
   *
   * Es la misma prop que recibe `ModalidadesEditor`, y se usa igual: `ruta()`
   * arma la clave con el índice de la fila. Con eso cada `Campo` marca además
   * `data-campo-con-error`, que es lo que hace que un guardado fallido
   * scrollee hasta el campo de material y no hasta el principio de la sección
   * (B-184).
   */
  errorDe: (path: string) => string | undefined;
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
export function MaterialEditor({ items, onChange, errorDe }: Props) {
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

      {errorDe('material.items') && (
        <p data-campo-con-error className="scroll-mt-16 text-xs font-medium text-acento">
          {errorDe('material.items')}
        </p>
      )}

      {items.map((it, i) => {
        /*
         * B-197 — la clave del error de esta fila. Es el mismo `ruta()` que usa
         * `ModalidadesEditor`: el índice va en el medio porque así lo arma el
         * `path` del `superRefine` (`material.items.2.titulo`), y si acá se
         * armara distinto el error existiría en el mapa y no se pintaría nunca.
         */
        const ruta = (sufijo: string) => `material.items.${i}.${sufijo}`;
        return (
        <div key={i} className="rounded-md border border-borde bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Tipo" htmlFor={`material-tipo-${i}`} error={errorDe(ruta('tipo'))}>
              <select
                id={`material-tipo-${i}`}
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
            </Campo>
            <Campo
              label="Entrega"
              htmlFor={`material-entrega-${i}`}
              error={errorDe(ruta('entrega'))}
            >
              <select
                id={`material-entrega-${i}`}
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
            </Campo>
            <Campo
              label="Título"
              htmlFor={`material-titulo-${i}`}
              // Obligatorio al publicar, igual que la sede de una fila
              // presencial: sin título el ítem sale como una línea vacía.
              requerido
              error={errorDe(ruta('titulo'))}
              className="sm:col-span-2"
            >
              <input
                id={`material-titulo-${i}`}
                value={it.titulo}
                onChange={(e) => editar(i, { titulo: e.target.value })}
                placeholder="Pedro Páramo — edición Cátedra"
                className={claseInput}
              />
            </Campo>
            <Campo
              label="URL"
              htmlFor={`material-url-${i}`}
              error={errorDe(ruta('url'))}
              className="sm:col-span-2"
            >
              <input
                id={`material-url-${i}`}
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
            </Campo>
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

          {/*
            B-197 — la casilla no usa `Campo` (el label iría arriba y una casilla
            se lee al lado del texto), así que su error se pinta a mano. Va igual
            y no se saltea: `material.items.N.publico` es una ruta que el schema
            puede rechazar, y la regla es que **ninguna** quede sin lugar donde
            verse. Si un día deja de poder fallar, la ruta sale del vocabulario y
            esto sale con ella.
          */}
          {errorDe(ruta('publico')) && (
            <p
              data-campo-con-error
              role="alert"
              className="mt-1 scroll-mt-16 text-xs font-medium text-acento"
            >
              {errorDe(ruta('publico'))}
            </p>
          )}

          {!it.publico && it.url && (
            <p className="mt-1 text-[11px] text-tinta/50">
              En el sitio público van solo el tipo y el título; la URL no sale (§5.1).
            </p>
          )}
        </div>
        );
      })}
    </div>
  );
}
