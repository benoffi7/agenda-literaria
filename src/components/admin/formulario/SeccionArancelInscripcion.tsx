/**
 * §4 — el arancel es una taxonomía y **no** se preselecciona (D-16). La
 * inscripción abre sus campos solo si se pide.
 */
import { Campo, claseInput } from '@/components/admin/campos/Campo';
import { admiteMonto, montoDesdeTexto } from '@/lib/arancel';
import { Seccion } from '@/components/admin/campos/Seccion';
import { TaxonomiaSelect } from '@/components/admin/campos/TaxonomiaSelect';
import { ETIQUETA_VIA } from '@/components/admin/formulario/etiquetasUI';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';
import type { CampoLabelUnico } from '@/lib/formulario/etiquetas';
import { VIAS_INSCRIPCION, type ActividadForm } from '@/types/actividad';

interface Props extends PropsSeccion {
  anotarLabel: (campo: CampoLabelUnico, label?: string) => void;
  /**
   * B-114 — elegir el arancel pasa por la cascada (`cambiarArancel`) y no por un
   * `set` directo: el tipo arrastra el monto. Llega como prop por lo mismo que
   * `conTipo` y `conTitulo`: las cascadas son del formulario, no de la sección.
   */
  onArancel: (slug: string) => void;
}

export function SeccionArancelInscripcion({
  form,
  set,
  errorDe,
  uid,
  anotarLabel,
  onArancel,
}: Props) {
  return (
    <Seccion ancla="arancel-inscripcion" titulo="Arancel e inscripción" conAyuda>
      <div className="grid gap-4 sm:grid-cols-2 @5xl:grid-cols-3">
        <Campo label="Arancel" requerido error={errorDe('arancel.tipo')}>
          <TaxonomiaSelect
            campo="arancel"
            uid={uid}
            value={form.arancel.tipo}
            onChange={(slug, labelNuevo) => {
              // B-114 — la cascada limpia el monto si el arancel nuevo no lo
              // admite. Sin eso, «Arancelado · $15.000 → Gratis» deja el número
              // cargado y el guardado se rechaza por un campo que ya no se ve.
              onArancel(slug);
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

        {/*
          B-114 · el monto. **Aparece solo si el arancel lo admite** —o sea, si
          hay uno elegido y no es de los que no se pagan—: un monto en «Gratis»
          es contradictorio y en «A la gorra» no hay precio que publicar, que en
          este circuito es la mitad de los casos (§4.1).

          Es opcional: `arancel.tipo` sigue comunicando lo esencial, y el monto
          existe para el resultado enriquecido de Google —el `offers.price` del
          JSON-LD— más los cuatro lugares que ya dicen el arancel.
        */}
        {admiteMonto(form.arancel.tipo) && (
          <Campo
            label="Monto"
            error={errorDe('arancel.monto')}
            ayuda="Opcional. En pesos y sin centavos: 15000 se publica como $15.000."
          >
            <input
              className={claseInput}
              /*
                **`type="text"` y no `type="number"`, y eso es el arreglo de un
                bug** que encontró el `auditor-trampas`. Para HTML el punto es el
                separador **decimal**, así que `15.000` —la forma natural de
                escribir quince mil acá— es un número válido que vale **quince**,
                y ni `min` ni `step` ni el schema lo marcan: 15 es un entero
                positivo legal. El taller de $15.000 se publicaba como $15 en las
                cinco salidas, sin un test en rojo.

                Con `text` la interpretación la hace `montoDesdeTexto` y no el
                navegador. `inputMode="numeric"` conserva lo único que
                `type="number"` aportaba de verdad: que el teclado del teléfono
                abra en números.
              */
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="15000"
              value={form.arancel.monto ?? ''}
              onChange={(e) =>
                set('arancel', {
                  ...form.arancel,
                  // Vacío es `null` y no `0`: «no cargué el monto» y «cuesta
                  // cero» son cosas distintas, y la segunda no existe acá — para
                  // eso está el arancel «Gratis».
                  monto: montoDesdeTexto(e.target.value),
                })
              }
            />
          </Campo>
        )}
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
        <div className="mt-3 grid gap-4 sm:grid-cols-2 @5xl:grid-cols-3">
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
