/**
 * §11 — modalidad, y según ella la sede, el bloque online o los dos. El link de
 * la reunión no se publica salvo que se tilde a mano (§5.1, trampa 5).
 */
import { Campo, claseInput } from '@/components/admin/campos/Campo';
import { Seccion } from '@/components/admin/campos/Seccion';
import { TaxonomiaSelect } from '@/components/admin/campos/TaxonomiaSelect';
import { CoordenadasSede } from '@/components/admin/CoordenadasSede';
import { ETIQUETA_MODALIDAD } from '@/components/admin/formulario/etiquetasUI';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';
import type { CampoLabelUnico } from '@/lib/formulario/etiquetas';
import { MODALIDADES, type ActividadForm } from '@/types/actividad';

interface Props extends PropsSeccion {
  conModalidad: (modalidad: ActividadForm['modalidad']) => void;
  anotarLabel: (campo: CampoLabelUnico, label?: string) => void;
  necesitaSede: boolean;
  necesitaOnline: boolean;
}

export function SeccionDonde({ form, set, errorDe, uid, conModalidad, anotarLabel, necesitaSede, necesitaOnline }: Props) {
  return (
    <Seccion ancla="donde" titulo="Dónde">
      <Campo label="Modalidad" requerido error={errorDe('modalidad')} className="mb-4">
        <div className="flex gap-2">
          {MODALIDADES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => conModalidad(m)}
              aria-pressed={form.modalidad === m}
              className={`min-h-touch flex-1 rounded-md border px-3 text-sm sm:flex-none sm:px-4 ${
                form.modalidad === m
                  ? 'border-acento bg-acento/10 font-medium text-acento'
                  : 'border-borde bg-white'
              }`}
            >
              {ETIQUETA_MODALIDAD[m]}
            </button>
          ))}
        </div>
      </Campo>

      {necesitaSede && form.sede && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Sede" requerido error={errorDe('sede.nombre')}>
            <input
              className={claseInput}
              value={form.sede.nombre}
              onChange={(e) => set('sede', { ...form.sede!, nombre: e.target.value })}
              placeholder="Casa Brandon"
            />
          </Campo>
          <Campo label="Dirección" requerido error={errorDe('sede.direccion')}>
            <input
              className={claseInput}
              value={form.sede.direccion}
              onChange={(e) => set('sede', { ...form.sede!, direccion: e.target.value })}
              placeholder="Luis María Drago 236"
            />
          </Campo>
          <Campo label="Barrio" error={errorDe('sede.barrio')}>
            <TaxonomiaSelect
              campo="barrio"
              uid={uid}
              value={form.sede.barrio}
              onChange={(slug, labelNuevo) => {
                set('sede', { ...form.sede!, barrio: slug });
                anotarLabel('barrio', labelNuevo);
              }}
              placeholder="Elegí o agregá el barrio…"
            />
          </Campo>
          <Campo label="Ciudad">
            <input
              className={claseInput}
              value={form.sede.ciudad}
              onChange={(e) => set('sede', { ...form.sede!, ciudad: e.target.value })}
            />
          </Campo>
          <Campo
            label="Cómo llegar"
            ayuda="Timbre, piso, referencias. Sale al sitio público."
            className="sm:col-span-2"
          >
            <input
              className={claseInput}
              value={form.sede.indicaciones}
              onChange={(e) => set('sede', { ...form.sede!, indicaciones: e.target.value })}
            />
          </Campo>
          <CoordenadasSede
            geo={form.sede.geo}
            onChange={(geo) => set('sede', { ...form.sede!, geo })}
            className="sm:col-span-2"
          />
        </div>
      )}

      {necesitaOnline && form.online && (
        <div className={`grid gap-4 sm:grid-cols-2 ${necesitaSede ? 'mt-4 border-t border-borde pt-4' : ''}`}>
          <Campo label="Plataforma" requerido error={errorDe('online.plataforma')}>
            <TaxonomiaSelect
              campo="plataforma"
              uid={uid}
              value={form.online.plataforma}
              onChange={(slug, labelNuevo) => {
                set('online', { ...form.online!, plataforma: slug });
                anotarLabel('plataforma', labelNuevo);
              }}
              placeholder="Elegí la plataforma…"
              autoSeleccionarPrimera
            />
          </Campo>
          <Campo
            label="Link del encuentro"
            ayuda="No se publica: se manda al inscribirse."
          >
            <input
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={claseInput}
              value={form.online.url}
              onChange={(e) => set('online', { ...form.online!, url: e.target.value })}
              placeholder="https://zoom.us/j/…"
            />
          </Campo>
          <div className="sm:col-span-2 rounded-md border border-acento/25 bg-acento/5 px-3 py-2">
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.online.urlPublica}
                onChange={(e) => set('online', { ...form.online!, urlPublica: e.target.checked })}
              />
              <span>
                Publicar el link en el sitio.
                <strong className="block text-acento">
                  Dejalo destildado salvo que sea un encuentro abierto: un link de Zoom
                  público habilita zoombombing.
                </strong>
              </span>
            </label>
          </div>
        </div>
      )}
    </Seccion>
  );
}
