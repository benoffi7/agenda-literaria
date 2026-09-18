/**
 * §4 — el arancel es una taxonomía y **no** se preselecciona (D-16). La
 * inscripción abre sus campos solo si se pide.
 */
import { Seccion, TaxonomiaSelect } from '@/components/admin/campos-del-panel';
import { CampoDeFechaYHora } from '@/components/campos/CampoDeFechaYHora';
import { type PreferenciaDeHora } from '@/lib/formatoDeHora';
import { Campo, claseInput } from '@/components/campos/Campo';
import { admiteMonto, montoDesdeTexto } from '@/lib/arancel';
import { ETIQUETA_VIA } from '@/components/admin/formulario/etiquetasUI';
import type { PropsSeccion } from '@/components/admin/formulario/PropsSeccion';
import type { CampoLabelUnico } from '@/lib/formulario/etiquetas';
import { VIAS_INSCRIPCION, type ActividadForm } from '@/types/actividad';

interface Props extends PropsSeccion {
  /** B-889 / D-720 — en qué formato se tipea el cierre de la inscripción. */
  hora: PreferenciaDeHora;
  anotarLabel: (campo: CampoLabelUnico, label?: string) => void;
  /**
   * B-114 — elegir el arancel pasa por la cascada (`cambiarArancel`) y no por un
   * `set` directo: el tipo arrastra el monto. Llega como prop por lo mismo que
   * `conTipo` y `conTitulo`: las cascadas son del formulario, no de la sección.
   */
  onArancel: (slug: string) => void;
}

export function SeccionArancelInscripcion({
  hora,
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
        <Campo label="Arancel" htmlFor="arancel-tipo" requerido error={errorDe('arancel.tipo')}>
          <TaxonomiaSelect
            id="arancel-tipo"
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
        <Campo
          label="Notas del arancel"
          htmlFor="arancel-notas"
          ayuda="«2 cuotas», «incluye material»"
        >
          <input
            id="arancel-notas"
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
            htmlFor="arancel-monto"
            error={errorDe('arancel.monto')}
            ayuda="Opcional. En pesos y sin centavos: 15000 se publica como $15.000."
          >
            <input
              id="arancel-monto"
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
        B-956 — **acá hay una casilla, y eso revierte media decisión de B-97 a
        propósito.**

        Aquello dejó un aviso y no un control, con este argumento escrito: «si
        acá hubiera una casilla, habría dos lugares donde prenderlo y ninguno
        sería el bueno». El dueño pidió que haya dos, y el motivo es el de toda
        esta tanda: **con una segunda persona cargando, el «⋯» del listado no se
        encuentra**, y quien ya está adentro del formulario no tiene por qué
        salir a buscarlo.

        **El «⋯» se queda**, y no por compatibilidad: es el caso para el que
        nació —«se llenó, lo marco desde el teléfono»— y sacarlo sería cambiar un
        problema por el otro. Las dos escriben el mismo campo.

        Lo que sí sobrevive entero de B-97 es la otra mitad: **lo que se publica
        tiene que poder verse desde el panel**. Por eso la casilla lleva debajo lo
        que el aviso decía —qué pasa cuando está prendida—, en vez de ser una
        casilla muda.

        No se reusa el texto del evento: ahí es prosa pública con su paréntesis,
        acá es una etiqueta del panel. Misma razón por la que `ETIQUETA_ENTREGA`
        no se comparte (D-20).
      */}
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.inscripcion.completo === true}
          onChange={(e) =>
            set('inscripcion', { ...form.inscripcion, completo: e.target.checked })
          }
        />
        Cupo completo
      </label>
      {form.inscripcion.completo && (
        <p className="mt-2 text-xs text-tinta/60">
          Se muestra en el sitio y en el evento del calendario, al lado del contacto de
          inscripción — que sigue a la vista por si se libera un lugar. También se puede
          marcar y desmarcar desde el «⋯» del listado.
        </p>
      )}

      {form.inscripcion.requiere && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 @5xl:grid-cols-3">
          <Campo label="Por dónde" htmlFor="insc-via" requerido error={errorDe('inscripcion.via')}>
            <select
              id="insc-via"
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
            htmlFor="insc-destino"
            requerido
            error={errorDe('inscripcion.destino')}
            ayuda="Es público. Usá un contacto de trabajo, no un WhatsApp personal."
          >
            <input
              id="insc-destino"
              className={claseInput}
              value={form.inscripcion.destino}
              onChange={(e) =>
                set('inscripcion', { ...form.inscripcion, destino: e.target.value })
              }
              placeholder="inscripciones@… o https://wa.me/…"
            />
          </Campo>
          <Campo label="Cupo" htmlFor="insc-cupo">
            <input
              id="insc-cupo"
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
          <CampoDeFechaYHora
            label="Cierra la inscripción"
            id="insc-cierra"
            value={form.inscripcion.cierra}
            onChange={(v) => set('inscripcion', { ...form.inscripcion, cierra: v })}
            formato={hora.formato}
            vista={hora.vista}
          />
        </div>
      )}
    </Seccion>
  );
}
