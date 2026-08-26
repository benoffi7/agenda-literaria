/**
 * El acordeón del §11: tags, imagen y destacado.
 */
import { Campo, claseInput } from '@/components/admin/campos/Campo';
import { Seccion } from '@/components/admin/campos/Seccion';
import { TagsInput } from '@/components/admin/campos/TagsInput';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';

interface Props extends PropsSeccion {
  /** Buffer `slug → label` de los tags tipeados que todavía no se guardaron (D-02). */
  setTagsNuevos: (nuevos: Record<string, string>) => void;
  /**
   * B-184 — sube cuando la barra manda a un campo de esta sección: arranca
   * cerrada, y un error adentro de un acordeón cerrado no se ve en ninguna
   * parte de la pantalla.
   */
  pedidoDeApertura?: number;
}

export function SeccionOpcional({
  form,
  set,
  errorDe,
  uid,
  setTagsNuevos,
  pedidoDeApertura,
}: Props) {
  return (
    <Seccion
      ancla="opcional"
      pedidoDeApertura={pedidoDeApertura}
      titulo="Opcional"
      descripcion="Tags, imagen, destacado."
      colapsable
      abiertaPorDefecto={false}
    >
      <div className="grid gap-4">
        <Campo label="Tags" ayuda="Alimentan los filtros del sitio público.">
          <TagsInput
            uid={uid}
            value={form.tags}
            onChange={(slugs, nuevos) => {
              set('tags', slugs);
              setTagsNuevos(nuevos);
            }}
          />
        </Campo>
        <Campo label="Imagen" error={errorDe('imagenUrl')}>
          <input
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className={claseInput}
            value={form.imagenUrl ?? ''}
            onChange={(e) => set('imagenUrl', e.target.value)}
            placeholder="https://…"
          />
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.destacado}
            onChange={(e) => set('destacado', e.target.checked)}
          />
          Destacar en la portada
        </label>
      </div>
    </Seccion>
  );
}
