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
import { Seccion } from '@/components/admin/campos-del-panel';
import { VistaPreviaEvento } from '@/components/admin/VistaPreviaEvento';
import { urlDeDetalle } from '@/lib/rutasPublicas';
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
      conAyuda
      descripcion="Cómo va a quedar en Google Calendar. Lo arma la misma lógica que publica el evento."
      colapsable
      recuerdaComo="vista-previa"
    >
      <VistaPreviaEvento form={form} labelsPendientes={labelsPendientes} />

      {/*
        B-954 — el enlace a la página publicada, pedido del dueño. Va acá y en el
        «⋯» del listado: son los dos momentos en que aparece la pregunta «¿cómo
        quedó?», y el de adentro del formulario es el que no obliga a salir.

        **Solo si está publicado.** Si no, la página no se generó y el enlace es
        un 404 seguro.

        **Y el texto dice la latencia**, que es la parte que muerde: el sitio es
        estático, así que una actividad recién publicada no existe hasta el
        rebuild (§8, ~2 a 7 minutos). Sin la aclaración, el enlace da 404 justo
        cuando más ganas hay de apretarlo y parece que algo se rompió.
      */}
      {form.estado === 'publicado' && form.slug && (
        <p className="body-sm mt-4 border-t border-borde pt-4">
          <a
            href={urlDeDetalle(form.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Ver la página publicada
          </a>{' '}
          <span className="text-tinta/65">
            — si la acabás de publicar, aparece unos minutos después.
          </span>
        </p>
      )}
    </Seccion>
  );
}
