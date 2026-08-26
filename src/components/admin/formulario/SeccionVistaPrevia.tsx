/**
 * B-12 — cómo queda el evento en Google Calendar, armado por la misma función
 * que lo publica (D-20).
 *
 * Va última porque es el paso natural antes de publicar.
 *
 * **B-193 — y arranca abierta.** Arrancaba colapsada para no abrir las cinco
 * suscripciones a `/opciones/*` que necesita para resolver las etiquetas, y ese
 * ahorro resultó menos importante que su costo: alguien pidió por escrito una
 * vista previa que ya existía, desde el listado y sin haber entrado al
 * formulario. Una función que hay que ir a buscar no existe en la práctica.
 *
 * El ahorro además era menor de lo que parecía: cuatro de esos cinco documentos
 * ya los suscriben los desplegables de taxonomía de las secciones que arrancan
 * abiertas (tipo, barrio, plataforma, arancel), así que lo único que agrega es
 * `tags`.
 *
 * `recuerdaComo` es lo que evita el otro extremo: quien la cierra a propósito la
 * encuentra cerrada la próxima vez.
 */
import { Seccion } from '@/components/admin/campos/Seccion';
import { VistaPreviaEvento } from '@/components/admin/VistaPreviaEvento';
import type { LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import type { ActividadForm } from '@/types/actividad';

interface Props {
  form: ActividadForm;
  /** Etiquetas tipeadas que todavía no están en `/opciones/*` (D-02). */
  labelsPendientes: LabelsTaxonomia;
}

export function SeccionVistaPrevia({ form, labelsPendientes }: Props) {
  return (
    <Seccion
      ancla="vista-previa"
      titulo="Vista previa del evento"
      descripcion="Cómo va a quedar en Google Calendar. Lo arma la misma lógica que publica el evento."
      colapsable
      recuerdaComo="vista-previa"
    >
      <VistaPreviaEvento form={form} labelsPendientes={labelsPendientes} />
    </Seccion>
  );
}
