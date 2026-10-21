/**
 * **La placa de una actividad, para Instagram** — B-2226.
 *
 * Se arma con el **formulario en curso**, pasado por `formADocumento` —el mismo
 * camino que el texto para redes y la vista previa del evento (D-20)—, así que
 * dice lo que se va a guardar. El texto lo decide `placaDeActividad`
 * (`lib/placas.ts`), con su tabla de qué entra y qué no.
 *
 * Desde B-2227 quien carga elige qué filas van, con casillas; la elección se
 * recuerda en su navegador para la próxima placa. Elegir solo saca: lo que la
 * tabla de privacidad deja afuera no se puede tildar.
 */
import { useCallback, useMemo, useState } from 'react';
import { claseBotonSecundario } from '@/components/campos/Campo';
import { PlacaParaInstagram } from '@/components/admin/placa/PlacaParaInstagram';
import { dibujarPlacaDeActividad } from '@/components/admin/placa/dibujarPlacas';
import { useLabelsTaxonomia } from '@/components/admin/useOpciones';
import { formADocumento } from '@/lib/actividades';
import type { Formato } from '@/lib/imagenDeLaSemana';
import {
  CAMPOS_DE_LA_PLACA,
  ETIQUETA_CAMPO_DE_LA_PLACA,
  conLosCampos,
  leerCamposDeLaPlaca,
  placaDeActividad,
  recordarCamposDeLaPlaca,
  type ActividadParaPlaca,
  type CampoDeLaPlaca,
  type ResultadoPlaca,
} from '@/lib/placas';
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
  const [campos, setCampos] = useState<Set<CampoDeLaPlaca>>(() =>
    leerCamposDeLaPlaca(globalThis.localStorage ?? null),
  );
  const alternar = (campo: CampoDeLaPlaca) => {
    const nuevos = new Set(campos);
    if (nuevos.has(campo)) nuevos.delete(campo);
    else nuevos.add(campo);
    setCampos(nuevos);
    recordarCamposDeLaPlaca(globalThis.localStorage ?? null, nuevos);
  };

  const resultado = useMemo((): ResultadoPlaca => {
    if (!abierta) return { ok: false, motivo: '' };
    try {
      const documento = formADocumento(form, '', false) as unknown as ActividadParaPlaca;
      return placaDeActividad(documento, labels, yaTienePagina);
    } catch {
      return { ok: false, motivo: 'Completá las fechas de los encuentros para armar la placa.' };
    }
  }, [abierta, form, labels, yaTienePagina]);

  const placa = useMemo(
    () => (resultado.ok ? conLosCampos(resultado.placa, campos) : null),
    [resultado, campos],
  );
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
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium">Qué lleva la placa</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {CAMPOS_DE_LA_PLACA.map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={campos.has(c)} onChange={() => alternar(c)} />
              {ETIQUETA_CAMPO_DE_LA_PLACA[c]}
            </label>
          ))}
        </div>
        <p className="text-xs text-tinta/65">
          El tipo y el título van siempre. Lo que elijas queda para tus próximas placas.
        </p>
      </fieldset>
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
    </div>
  );
}
