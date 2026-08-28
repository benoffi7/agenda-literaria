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
import { Seccion } from '@/components/admin/campos/Seccion';
import { ModalidadesEditor } from '@/components/admin/ModalidadesEditor';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';
import type { CampoLabelUnico } from '@/lib/formulario/etiquetas';

interface Props extends PropsSeccion {
  anotarLabel: (campo: CampoLabelUnico, label?: string) => void;
}

export function SeccionDonde({ form, set, errorDe, uid, anotarLabel }: Props) {
  return (
    <Seccion
      ancla="donde"
      titulo="Dónde"
      descripcion="Una fila por forma de cursar: la misma actividad puede darse presencial y virtual."
      insignia={form.modalidades.length > 1 ? `${form.modalidades.length} modalidades` : undefined}
    >
      <ModalidadesEditor
        modalidades={form.modalidades}
        onChange={(m) => set('modalidades', m)}
        uid={uid}
        anotarLabel={anotarLabel}
        errorDe={errorDe}
      />
    </Seccion>
  );
}
