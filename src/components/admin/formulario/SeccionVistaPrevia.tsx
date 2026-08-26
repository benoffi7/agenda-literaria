/**
 * B-12 — cómo queda el evento en Google Calendar, armado por la misma función
 * que lo publica (D-20).
 *
 * Va última y colapsada: es el paso natural antes de publicar, y mientras está
 * cerrada no abre las cinco suscripciones a `/opciones/*` que necesita para
 * resolver las etiquetas.
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
      abiertaPorDefecto={false}
    >
      <VistaPreviaEvento form={form} labelsPendientes={labelsPendientes} />
    </Seccion>
  );
}
