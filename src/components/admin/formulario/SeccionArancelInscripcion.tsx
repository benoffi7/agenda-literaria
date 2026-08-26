/**
 * §4 — el arancel es una taxonomía y **no** se preselecciona (D-16). La
 * inscripción abre sus campos solo si se pide.
 */
import { Campo, claseInput } from '@/components/admin/campos/Campo';
import { Seccion } from '@/components/admin/campos/Seccion';
import { TaxonomiaSelect } from '@/components/admin/campos/TaxonomiaSelect';
import { ETIQUETA_VIA } from '@/components/admin/formulario/etiquetasUI';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';
import type { CampoLabelUnico } from '@/lib/formulario/etiquetas';
import { VIAS_INSCRIPCION, type ActividadForm } from '@/types/actividad';

interface Props extends PropsSeccion {
  anotarLabel: (campo: CampoLabelUnico, label?: string) => void;
}

export function SeccionArancelInscripcion({ form, set, errorDe, uid, anotarLabel }: Props) {
  return (
    <Seccion ancla="arancel-inscripcion" titulo="Arancel e inscripción">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Arancel" requerido error={errorDe('arancel.tipo')}>
          <TaxonomiaSelect
            campo="arancel"
            uid={uid}
            value={form.arancel.tipo}
            onChange={(slug, labelNuevo) => {
              set('arancel', { ...form.arancel, tipo: slug });
              anotarLabel('arancel', labelNuevo);
            }}
            placeholder="Elegí el arancel…"
          />
        </Campo>
        <Campo label="Notas del arancel" ayuda="«2 cuotas», «incluye material»">
          <input
            className={claseInput}
            value={form.arancel.notas}
            onChange={(e) => set('arancel', { ...form.arancel, notas: e.target.value })}
          />
        </Campo>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.inscripcion.requiere}
          onChange={(e) =>
            set('inscripcion', { ...form.inscripcion, requiere: e.target.checked })
          }
        />
        Requiere inscripción previa
      </label>

      {/*
        B-97 — **se ve acá y se prende en otra parte**, y las dos mitades son a
        propósito.

        Se prende desde el menú «⋯» del listado porque el caso es «se llenó, lo
        marco desde el teléfono» y abrir 30+ campos para tocar una casilla no se
        hace. Pero lo que se publica tiene que poder verse desde el panel: el
        cartel ya está en el sitio y en la descripción de los N eventos, así que
        quien está editando la actividad no puede no saberlo. De ahí un aviso y
        no un control — si acá hubiera una casilla, habría dos lugares donde
        prenderlo y ninguno sería el bueno.

        No se reusa el texto del evento: ahí es prosa pública con su paréntesis,
        acá es una etiqueta del panel. Es la misma razón por la que
        `ETIQUETA_ENTREGA` no se comparte (D-20).
      */}
      {form.inscripcion.completo && (
        <p className="mt-3 rounded-md border border-tinta/20 bg-tinta/[0.04] px-3 py-2 text-xs">
          Está marcada como <strong>cupo completo</strong>: el evento del calendario lo dice
          al lado del contacto de inscripción, que sigue a la vista por si se libera un
          lugar. Se saca desde el menú «⋯» del listado.
        </p>
      )}

      {form.inscripcion.requiere && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Campo label="Por dónde" requerido error={errorDe('inscripcion.via')}>
            <select
              className={claseInput}
              value={form.inscripcion.via ?? ''}
              onChange={(e) =>
                set('inscripcion', {
                  ...form.inscripcion,
                  via: (e.target.value || null) as ActividadForm['inscripcion']['via'],
                })
              }
            >
              <option value="">Elegí…</option>
              {VIAS_INSCRIPCION.map((v) => (
                <option key={v} value={v}>
                  {ETIQUETA_VIA[v]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            label="Destino"
            requerido
            error={errorDe('inscripcion.destino')}
            ayuda="Es público. Usá un contacto de trabajo, no un WhatsApp personal."
          >
            <input
              className={claseInput}
              value={form.inscripcion.destino}
              onChange={(e) =>
                set('inscripcion', { ...form.inscripcion, destino: e.target.value })
              }
              placeholder="inscripciones@… o https://wa.me/…"
            />
          </Campo>
          <Campo label="Cupo">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className={claseInput}
              value={form.inscripcion.cupo ?? ''}
              onChange={(e) =>
                set('inscripcion', {
                  ...form.inscripcion,
                  cupo: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </Campo>
          <Campo label="Cierra la inscripción">
            <input
              type="datetime-local"
              className={claseInput}
              value={form.inscripcion.cierra}
              onChange={(e) =>
                set('inscripcion', { ...form.inscripcion, cierra: e.target.value })
              }
            />
          </Campo>
        </div>
      )}
    </Seccion>
  );
}
