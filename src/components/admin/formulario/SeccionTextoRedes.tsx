/**
 * B-95 — el texto para publicar en redes, armado con lo que ya se cargó. Y
 * debajo, desde B-2226, la placa para el mismo posteo.
 *
 * Va **antes** de la vista previa del evento: las dos son «cómo se ve esto
 * afuera», y el orden sigue al de la vida real — primero se anuncia, después el
 * evento queda en el calendario de quien se suscribió.
 *
 * Arranca **cerrada** y no abierta como la vista previa (B-193). No es
 * inconsistencia: la vista previa se abrió porque alguien pidió por escrito una
 * función que ya existía y no encontraba, y ese reporte no existe acá. Nueve
 * secciones abiertas de arrastre son un formulario infinito, que es el motivo por
 * el que hay acordeones. `recuerdaComo` hace que quien la use la encuentre abierta
 * la próxima vez, que es la mitad que faltaba en B-193.
 */
import { Seccion } from '@/components/admin/campos-del-panel';
import { TextoRedes } from '@/components/admin/TextoRedes';
import { PlacaDeActividad } from '@/components/admin/placa/PlacaDeActividad';
import type { LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import type { ActividadConId, ActividadForm } from '@/types/actividad';

interface Props {
  form: ActividadForm;
  /** Etiquetas tipeadas que todavía no están en `/opciones/*` (D-02). */
  labelsPendientes: LabelsTaxonomia;
  /**
   * La actividad **guardada**: si está publicada, la placa lleva la dirección de
   * su página (B-312). La del formulario en curso no sirve, el estado del select
   * todavía no se guardó.
   */
  inicial?: Pick<ActividadConId, 'estado'>;
}

export function SeccionTextoRedes({ form, labelsPendientes, inicial }: Props) {
  return (
    <Seccion
      ancla="texto-redes"
      titulo="Texto para publicar"
      conAyuda
      descripcion="Listo para pegar en Instagram, con los datos que ya cargaste, y la placa para acompañarlo."
      colapsable
      recuerdaComo="texto-redes"
    >
      <div className="flex flex-col gap-6">
        <TextoRedes form={form} labelsPendientes={labelsPendientes} />
        <PlacaDeActividad
          form={form}
          labelsPendientes={labelsPendientes}
          yaTienePagina={inicial?.estado === 'publicado'}
        />
      </div>
    </Seccion>
  );
}
