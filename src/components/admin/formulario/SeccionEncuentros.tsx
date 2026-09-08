/**
 * §2.2 — un ciclo de ocho encuentros es una actividad con ocho sesiones, no
 * ocho actividades.
 *
 * Y desde B-181, el otro eje: un ciclo puede darse en **varios horarios
 * alternativos** (las «opciones para sumarse»), que no son más encuentros. Los
 * dos editores viven en esta sección porque son la misma pregunta —cuándo es
 * esto— y porque el desplegable de cada encuentro no significa nada sin la lista
 * de opciones a la vista.
 */
import { Seccion } from '@/components/admin/campos/Seccion';
import { ComisionesEditor } from '@/components/admin/ComisionesEditor';
import { SesionesEditor } from '@/components/admin/SesionesEditor';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';


type Props = Omit<PropsSeccion, 'uid'> & {
  /** Los clubes de lectura muestran la lectura de cada encuentro. */
  esClub: boolean;
  /**
   * B-181 — sacar una opción **y desenganchar sus encuentros**, que son dos
   * campos del formulario a la vez.
   *
   * Llega como callback y no se hace acá con dos `set` seguidos por la misma
   * razón que `conTipo` y `conArancel` (las otras transformaciones que tocan
   * varios campos): el estado intermedio —la opción ya borrada, los encuentros
   * todavía apuntándole— es un formulario que el schema rechaza, y no tiene por
   * qué existir ni por un render.
   */
  borrarComision: (id: string) => void;
};

export function SeccionEncuentros({ form, set, errorDe, esClub, borrarComision }: Props) {
  return (
    <Seccion
      ancla="encuentros"
      titulo="Encuentros"
      conAyuda
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
      {/*
        Solo para un ciclo: cuatro horarios alternativos de una charla suelta no
        existen —es una charla, un día—, y mostrar el bloque en toda actividad
        sería una pregunta más en un formulario que ya tiene treinta campos.

        Se mira `esCiclo` y no `sesiones.length > 1`: la casilla es lo que el
        dueño declaró, y es la misma puerta que usa el número del evento
        (`elEventoNumeraElCiclo`, D-292). Con la casilla destildada y comisiones
        ya cargadas el bloque **igual aparece**, porque esconder un dato cargado
        es peor que mostrar un bloque de más: si no, quedarían comisiones que no
        se pueden ni ver ni borrar.
      */}
      {(form.esCiclo || form.comisiones.length > 0) && (
        <ComisionesEditor
          comisiones={form.comisiones}
          onChange={(c) => set('comisiones', c)}
          onBorrar={borrarComision}
          encuentrosDe={(id) => form.sesiones.filter((s) => s.comisionId === id).length}
          errorDe={errorDe}
        />
      )}
      <SesionesEditor
        sesiones={form.sesiones}
        onChange={(s) => set('sesiones', s)}
        mostrarLectura={esClub || form.esCiclo}
        errorDe={errorDe}
        comisiones={form.comisiones}
      />
    </Seccion>
  );
}
