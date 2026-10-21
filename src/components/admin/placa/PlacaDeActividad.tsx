/**
 * **La placa de una actividad, para Instagram** — B-2226.
 *
 * Se arma con el **formulario en curso**, pasado por `formADocumento` —el mismo
 * camino que el texto para redes y la vista previa del evento (D-20)—, así que
 * dice lo que se va a guardar. El texto lo decide `placaDeActividad`
 * (`lib/placas.ts`), con su tabla de qué entra y qué no.
 */
import { useCallback, useMemo, useState } from 'react';
import { claseBotonSecundario } from '@/components/campos/Campo';
import { PlacaParaInstagram } from '@/components/admin/placa/PlacaParaInstagram';
import { dibujarPlacaDeActividad } from '@/components/admin/placa/dibujarPlacas';
import { useLabelsTaxonomia } from '@/components/admin/useOpciones';
import { formADocumento } from '@/lib/actividades';
import type { Formato } from '@/lib/imagenDeLaSemana';
import { placaDeActividad, type ActividadParaPlaca, type ResultadoPlaca } from '@/lib/placas';
import type { LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import type { ActividadForm } from '@/types/actividad';

interface Props {
  form: ActividadForm;
  labelsPendientes?: LabelsTaxonomia;
  /** ¿La actividad **guardada** está publicada? Decide si sale el enlace a su página (B-312). */
  yaTienePagina: boolean;
}

export function PlacaDeActividad({ form, labelsPendientes, yaTienePagina }: Props) {
  /*
   * Arranca cerrada: dibujar en cada tecla del formulario —con la foto incluida—
   * es trabajo que nadie mira. Abierta, se redibuja con lo que se va cargando.
   */
  const [abierta, setAbierta] = useState(false);
  const labels = useLabelsTaxonomia(labelsPendientes);

  const resultado = useMemo((): ResultadoPlaca => {
    if (!abierta) return { ok: false, motivo: '' };
    try {
      const documento = formADocumento(form, '', false) as unknown as ActividadParaPlaca;
      return placaDeActividad(documento, labels, yaTienePagina);
    } catch {
      return { ok: false, motivo: 'Completá las fechas de los encuentros para armar la placa.' };
    }
  }, [abierta, form, labels, yaTienePagina]);

  const placa = resultado.ok ? resultado.placa : null;
  const dibujar = useCallback(
    (canvas: HTMLCanvasElement, formato: Formato) =>
      placa ? dibujarPlacaDeActividad(canvas, placa, formato) : Promise.resolve(),
    [placa],
  );

  if (!abierta) {
    return (
      <div>
        <button type="button" className={claseBotonSecundario} onClick={() => setAbierta(true)}>
          Armar la placa para Instagram
        </button>
      </div>
    );
  }

  if (!placa) {
    return (
      <p className="rounded-md border border-borde bg-white px-3 py-2 text-sm text-tinta/65">
        {resultado.ok ? '' : resultado.motivo}
      </p>
    );
  }

  return (
    <PlacaParaInstagram
      titulo="Placa para Instagram"
      ayuda={
        'Con la fecha, el lugar, el arancel y cómo inscribirse. La foto es la portada, si la ' +
        'subiste al panel. El número o el mail de inscripción no van en la imagen: van en el texto.' +
        (yaTienePagina ? '' : ' Sin la dirección de la página hasta que la actividad se publique.')
      }
      descripcion={`Vista previa de la placa de «${placa.titulo}»`}
      archivo={`placa-${form.slug || 'actividad'}`}
      dibujar={dibujar}
    />
  );
}
