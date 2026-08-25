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
    <Seccion titulo="Arancel e inscripción">
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
