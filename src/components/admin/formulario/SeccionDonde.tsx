/**
 * §11 + B-224 — las **formas de cursar**: una lista de filas, cada una con su
 * modalidad y, según ella, la sede, el bloque online o los dos. El link de la
 * reunión no se publica salvo que se tilde a mano (§5.1, trampa 5).
 *
 * La sección quedó reducida a su encabezado porque todo lo que tenía adentro
 * —el selector y los dos bloques de lugar— pasó a ser el cuerpo de una fila del
 * `ModalidadesEditor`, igual que los encuentros viven adentro del
 * `SesionesEditor`.
 */
import { Seccion } from '@/components/admin/campos-del-panel';
import { type PreferenciaDeHora } from '@/lib/formatoDeHora';
import { ModalidadesEditor } from '@/components/admin/ModalidadesEditor';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';
import type { CampoLabelUnico } from '@/lib/formulario/etiquetas';

interface Props extends PropsSeccion {
  /** B-889 — en qué formato se tipean las horas de cada forma de cursar. */
  hora: PreferenciaDeHora;
  anotarLabel: (campo: CampoLabelUnico, label?: string) => void;
}

export function SeccionDonde({ hora, form, set, errorDe, uid, anotarLabel }: Props) {
  return (
    <Seccion
      ancla="donde"
      titulo="Dónde"
      conAyuda
      descripcion="Una fila por forma de cursar: la misma actividad puede darse presencial y virtual."
      insignia={form.modalidades.length > 1 ? `${form.modalidades.length} modalidades` : undefined}
    >
      <ModalidadesEditor
        hora={hora}
        modalidades={form.modalidades}
        onChange={(m) => set('modalidades', m)}
        uid={uid}
        anotarLabel={anotarLabel}
        errorDe={errorDe}
      />
    </Seccion>
  );
}
