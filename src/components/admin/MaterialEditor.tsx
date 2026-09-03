import { Campo, claseInput } from '@/components/admin/campos/Campo';
import { FilasEditor } from '@/components/admin/campos/FilasEditor';
import { duplicarItemMaterial, itemMaterialVacio } from '@/lib/material';
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

/**
 * §4 / §5.1 — material, sobre todo de club de lectura.
 *
 * B-342 — al chasis compartido `FilasEditor` (B-224), el mismo que
 * `SesionesEditor` y `ModalidadesEditor`: antes era el único editor de filas
 * del panel con su propio botón de agregar, su propio borrar, sin «Duplicar»
 * ni contador ni estado vacío, y editaba, borraba y renderizaba **por
 * índice** (`key={i}`, `editar(i, …)`). No era la trampa 2 —un ítem de
 * material no sincroniza con Calendar, así que renumerarlo no borra nada del
 * otro lado— pero sí su prima chica: `key={i}` reusa el nodo del DOM, y borrar
 * la primera de tres filas movía el foco a la de al lado. Ahora cada fila
 * tiene su `id` de cliente (`lib/material.ts`), igual que sesiones,
 * modalidades e imágenes.
 */
export function MaterialEditor({ items, onChange, errorDe }: Props) {
  return (
    <FilasEditor
      filas={items}
      onChange={onChange}
      singular="material"
      plural="materiales"
      nueva={itemMaterialVacio}
      duplicar={duplicarItemMaterial}
      error={errorDe('material.items')}
      etiquetaBorrar={(it, i) => `Borrar material ${it.titulo || i + 1}`}
    >
      {(it, i, editar) => {
        /*
         * B-197 / B-342 — la clave del error de esta fila, con el índice de la
         * posición (no el `id` de la fila): es donde lo pone el `path` del
         * `superRefine` (`material.items.2.titulo`). Armada distinto, el error
         * existe en el mapa y no se pintaría nunca.
         */
        const ruta = (sufijo: string) => `material.items.${i}.${sufijo}`;
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Tipo" htmlFor={`material-tipo-${it.id}`} error={errorDe(ruta('tipo'))}>
                <select
                  id={`material-tipo-${it.id}`}
                  value={it.tipo}
                  onChange={(e) => editar({ tipo: e.target.value as ItemMaterial['tipo'] })}
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
                htmlFor={`material-entrega-${it.id}`}
                error={errorDe(ruta('entrega'))}
              >
                <select
                  id={`material-entrega-${it.id}`}
                  value={it.entrega}
                  onChange={(e) =>
                    editar({ entrega: e.target.value as ItemMaterial['entrega'] })
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
                htmlFor={`material-titulo-${it.id}`}
                // Obligatorio al publicar, igual que la sede de una fila
                // presencial: sin título el ítem sale como una línea vacía.
                requerido
                error={errorDe(ruta('titulo'))}
                className="sm:col-span-2"
              >
                <input
                  id={`material-titulo-${it.id}`}
                  value={it.titulo}
                  onChange={(e) => editar({ titulo: e.target.value })}
                  placeholder="Pedro Páramo — edición Cátedra"
                  className={claseInput}
                />
              </Campo>
              <Campo
                label="URL"
                htmlFor={`material-url-${it.id}`}
                error={errorDe(ruta('url'))}
                className="sm:col-span-2"
              >
                <input
                  id={`material-url-${it.id}`}
                  type="url"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={it.url}
                  onChange={(e) => editar({ url: e.target.value })}
                  placeholder="https://…"
                  className={claseInput}
                />
              </Campo>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="flex min-h-touch flex-1 items-center gap-2 text-xs text-tinta/70">
                <input
                  type="checkbox"
                  className="size-4 shrink-0"
                  checked={it.publico}
                  onChange={(e) => editar({ publico: e.target.checked })}
                />
                El link se muestra sin inscribirse
              </label>
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
          </>
        );
      }}
    </FilasEditor>
  );
}
