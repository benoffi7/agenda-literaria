/**
 * §2.2 — un ciclo de ocho encuentros es una actividad con ocho sesiones, no
 * ocho actividades.
 */
import { Seccion } from '@/components/admin/campos/Seccion';
import { SesionesEditor } from '@/components/admin/SesionesEditor';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';

type Props = Omit<PropsSeccion, 'uid'> & {
  /** Los clubes de lectura muestran la lectura de cada encuentro. */
  esClub: boolean;
};

export function SeccionEncuentros({ form, set, errorDe, esClub }: Props) {
  return (
    <Seccion
      ancla="encuentros"
      titulo="Encuentros"
      descripcion="Un ciclo de 8 encuentros es una sola actividad con ocho sesiones."
      insignia={form.esCiclo ? 'ciclo' : undefined}
    >
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.esCiclo}
          onChange={(e) => set('esCiclo', e.target.checked)}
        />
        Es un ciclo (varios encuentros)
      </label>
      <SesionesEditor
        sesiones={form.sesiones}
        onChange={(s) => set('sesiones', s)}
        mostrarLectura={esClub || form.esCiclo}
        error={errorDe('sesiones')}
      />
    </Seccion>
  );
}
