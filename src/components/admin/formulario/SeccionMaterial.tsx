/**
 * Lecturas, guías y contexto. Sobre todo en clubes de lectura, que es donde la
 * cascada del §2.2 la deja abierta.
 */
import { Seccion } from '@/components/admin/campos/Seccion';
import { MaterialEditor } from '@/components/admin/MaterialEditor';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';

type Props = Omit<PropsSeccion, 'uid'> & { esClub: boolean };

export function SeccionMaterial({ form, set, errorDe, esClub }: Props) {
  return (
    <Seccion
      titulo="Material"
      descripcion="Lecturas, guías y contexto. Sobre todo en clubes de lectura."
      colapsable
      abiertaPorDefecto={esClub || form.material.tiene}
      insignia={form.material.items.length ? `${form.material.items.length}` : undefined}
    >
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.material.tiene}
          onChange={(e) => set('material', { ...form.material, tiene: e.target.checked })}
        />
        Tiene material asociado
      </label>
      {form.material.tiene && (
        <MaterialEditor
          items={form.material.items}
          onChange={(items) => set('material', { ...form.material, items })}
          error={errorDe('material.items')}
        />
      )}
    </Seccion>
  );
}
