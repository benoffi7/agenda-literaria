/**
 * B-224 · Editor de **formas de cursar**: filas dinámicas, cada una con su
 * modalidad, su lugar y su ventana opcional de fechas.
 *
 * El pedido del dueño, textual: «el formulario de modalidad se mantiene tal cual
 * + doble fecha. Y sobre eso es tener N modalidades así como N encuentros. Misma
 * interfaz y funcionalidades.» Así que el cuerpo de la fila es el bloque «Dónde»
 * de siempre —el selector, y con él la sede o la plataforma que corresponda
 * (§11)— y el chasis de la lista es el mismo que el de los encuentros
 * (`FilasEditor`, extraído para no copiarlo).
 *
 * **Los ids se generan al crear la fila, nunca por índice** (trampa 2): borrar la
 * segunda modalidad renumera el array y cualquier cosa que compare por posición
 * cree que cambiaron todas.
 *
 * **Las fechas van con la conversión de `lib/sesiones.ts`** (`aDatetimeLocal` /
 * `deDatetimeLocal`, vía `formADocumento`), que es la que evita la trampa 1. Acá
 * son strings de `datetime-local` y en Firestore son `Timestamp`.
 */
import { Campo, claseInput } from '@/components/admin/campos/Campo';
import { FilasEditor } from '@/components/admin/campos/FilasEditor';
import { TaxonomiaSelect } from '@/components/admin/campos/TaxonomiaSelect';
import { CoordenadasSede } from '@/components/admin/CoordenadasSede';
import { ETIQUETA_MODALIDAD } from '@/components/admin/formulario/etiquetasUI';
import { medirFuncion } from '@/lib/analytics';
import { conModalidadDeFila, modalidadVacia } from '@/lib/formulario/estadoInicial';
import type { CampoLabelUnico } from '@/lib/formulario/etiquetas';
import {
  duplicarModalidad,
  filaPideOnline,
  filaPideSede,
  resumirVentana,
  ventanaInvertida,
} from '@/lib/modalidades';
import { MODALIDADES, type ModalidadFilaForm } from '@/types/actividad';

interface Props {
  modalidades: ModalidadFilaForm[];
  onChange: (m: ModalidadFilaForm[]) => void;
  uid: string;
  anotarLabel: (campo: CampoLabelUnico, label?: string) => void;
  /** `errorDe('modalidades.0.sede.nombre')`, con el índice de la fila. */
  errorDe: (path: string) => string | undefined;
}

/** Las funciones que se miden, en el vocabulario cerrado de `analytics-eventos`. */
const FUNCION = {
  agregar: 'modalidad-agregar',
  duplicar: 'modalidad-duplicar',
  borrar: 'modalidad-borrar',
} as const;

export function ModalidadesEditor({ modalidades, onChange, uid, anotarLabel, errorDe }: Props) {
  return (
    <FilasEditor
      filas={modalidades}
      onChange={onChange}
      singular="modalidad"
      plural="modalidades"
      // La fila nueva nace presencial, que es el default del formulario vacío.
      nueva={() => modalidadVacia('presencial')}
      duplicar={duplicarModalidad}
      alCambiarCantidad={(accion, cantidad) =>
        medirFuncion(FUNCION[accion], undefined, cantidad)
      }
      error={errorDe('modalidades')}
      etiquetaBorrar={(fila, i) => `Borrar la modalidad ${i + 1} (${fila.modalidad})`}
    >
      {(fila, i, editar) => {
        const ruta = (sufijo: string) => `modalidades.${i}.${sufijo}`;
        const resumen = resumirVentana(fila);
        const invertida = ventanaInvertida(fila);
        return (
          <>
            <Campo label="Modalidad" requerido error={errorDe(ruta('modalidad'))} className="mb-4">
              <div className="flex gap-2">
                {MODALIDADES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    // La cascada del §11 va **adentro** de la fila: elegir
                    // virtual saca la sede y crea el bloque online, y lo que ya
                    // estaba cargado se conserva si el bloque sigue existiendo.
                    onClick={() => editar(conModalidadDeFila(fila, m))}
                    aria-pressed={fila.modalidad === m}
                    className={`min-h-touch flex-1 rounded-md border px-3 text-sm sm:flex-none sm:px-4 ${
                      fila.modalidad === m
                        ? 'border-acento bg-acento/10 font-medium text-acento'
                        : 'border-borde bg-white'
                    }`}
                  >
                    {ETIQUETA_MODALIDAD[m]}
                  </button>
                ))}
              </div>
            </Campo>

            {/*
              La ventana. Las dos fechas son opcionales, y la ayuda lo dice: sin
              esto, dos campos de fecha vacíos al lado de los encuentros se leen
              como algo que falta completar.
            */}
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs">
                Desde (opcional)
                <input
                  type="datetime-local"
                  value={fila.inicio}
                  onChange={(e) => editar({ inicio: e.target.value })}
                  className={claseInput}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Hasta (opcional)
                <input
                  type="datetime-local"
                  value={fila.fin}
                  onChange={(e) => editar({ fin: e.target.value })}
                  className={claseInput}
                />
              </label>
              <p
                className={`sm:col-span-2 text-xs ${
                  invertida ? 'font-medium text-acento' : 'text-tinta/55'
                }`}
              >
                {invertida
                  ? 'La fecha de fin no es posterior a la de inicio.'
                  : resumen ||
                    'Desde y hasta cuándo se cursa así. Las dos son opcionales: si la actividad no cambia de modalidad, dejalas vacías.'}
              </p>
            </div>

            {filaPideSede(fila.modalidad) && fila.sede && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Sede" requerido error={errorDe(ruta('sede.nombre'))}>
                  <input
                    className={claseInput}
                    value={fila.sede.nombre}
                    onChange={(e) => editar({ sede: { ...fila.sede!, nombre: e.target.value } })}
                    placeholder="Casa Brandon"
                  />
                </Campo>
                <Campo label="Dirección" requerido error={errorDe(ruta('sede.direccion'))}>
                  <input
                    className={claseInput}
                    value={fila.sede.direccion}
                    onChange={(e) => editar({ sede: { ...fila.sede!, direccion: e.target.value } })}
                    placeholder="Luis María Drago 236"
                  />
                </Campo>
                <Campo label="Barrio" error={errorDe(ruta('sede.barrio'))}>
                  <TaxonomiaSelect
                    campo="barrio"
                    uid={uid}
                    value={fila.sede.barrio}
                    onChange={(slug, labelNuevo) => {
                      editar({ sede: { ...fila.sede!, barrio: slug } });
                      anotarLabel('barrio', labelNuevo);
                    }}
                    placeholder="Elegí o agregá el barrio…"
                  />
                </Campo>
                <Campo label="Ciudad">
                  <input
                    className={claseInput}
                    value={fila.sede.ciudad}
                    onChange={(e) => editar({ sede: { ...fila.sede!, ciudad: e.target.value } })}
                  />
                </Campo>
                <Campo
                  label="Cómo llegar"
                  ayuda="Timbre, piso, referencias. Sale al sitio público."
                  className="sm:col-span-2"
                >
                  <input
                    className={claseInput}
                    value={fila.sede.indicaciones}
                    onChange={(e) =>
                      editar({ sede: { ...fila.sede!, indicaciones: e.target.value } })
                    }
                  />
                </Campo>
                <CoordenadasSede
                  geo={fila.sede.geo}
                  onChange={(geo) => editar({ sede: { ...fila.sede!, geo } })}
                  className="sm:col-span-2"
                />
              </div>
            )}

            {filaPideOnline(fila.modalidad) && fila.online && (
              <div
                className={`grid gap-4 sm:grid-cols-2 ${
                  filaPideSede(fila.modalidad) ? 'mt-4 border-t border-borde pt-4' : ''
                }`}
              >
                <Campo label="Plataforma" requerido error={errorDe(ruta('online.plataforma'))}>
                  <TaxonomiaSelect
                    campo="plataforma"
                    uid={uid}
                    value={fila.online.plataforma}
                    onChange={(slug, labelNuevo) => {
                      editar({ online: { ...fila.online!, plataforma: slug } });
                      anotarLabel('plataforma', labelNuevo);
                    }}
                    placeholder="Elegí la plataforma…"
                    autoSeleccionarPrimera
                  />
                </Campo>
                <Campo
                  label="Link del encuentro"
                  ayuda="Por defecto no se publica: se manda al inscribirse."
                >
                  <input
                    type="url"
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className={claseInput}
                    value={fila.online.url}
                    onChange={(e) => editar({ online: { ...fila.online!, url: e.target.value } })}
                    placeholder="https://zoom.us/j/…"
                  />
                </Campo>
                <div className="sm:col-span-2 rounded-md border border-acento/25 bg-acento/5 px-3 py-2">
                  <label className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={fila.online.urlPublica}
                      onChange={(e) =>
                        editar({ online: { ...fila.online!, urlPublica: e.target.checked } })
                      }
                    />
                    {/*
                      B-240 / D-158 — **el texto dice a dónde sale de verdad.** Decía
                      «Publicar el link en el sitio» y el sitio no lo publica: D-139 lo
                      dejó afuera de la página de detalle, así que la casilla prometía
                      una pantalla que nunca lo muestra. Se corrige el texto y no el
                      comportamiento, porque el argumento de D-139 es asimétrico: un
                      evento de calendar se borra, una página indexada no se despublica.
                    */}
                    <span>
                      Publicar el link en el evento del calendario, que es donde lo ve quien
                      está suscripto.
                      <span className="mt-1 block">
                        Es el único lugar a donde sale. En la página de la actividad{' '}
                        <strong>no</strong> aparece, ni tildado: una página que Google indexa no
                        se despublica.
                      </span>
                      <strong className="mt-1 block text-acento">
                        Dejalo destildado salvo que sea un encuentro abierto: un link de Zoom
                        público habilita zoombombing.
                      </strong>
                    </span>
                  </label>
                </div>
              </div>
            )}
          </>
        );
      }}
    </FilasEditor>
  );
}
