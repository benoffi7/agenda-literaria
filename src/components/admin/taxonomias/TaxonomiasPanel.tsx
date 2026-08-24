import { useState } from 'react';
import {
  claseBotonFila,
  claseBotonSecundario,
  claseBotonTinta,
  claseInput,
} from '@/components/admin/campos/Campo';
import {
  pendientesDe,
  useTodasLasOpciones,
} from '@/components/admin/useOpciones';
import {
  aprobarOpcion,
  borrarOpcion,
  estaAprobada,
  renombrarOpcion,
} from '@/lib/opciones';
import { etiquetaPresentable } from '@/lib/taxonomia';
// D-20 — el mismo des-slug que usa la descripción del evento público: lo que se
// avisa antes de borrar tiene que decir exactamente lo que se va a ver.
import { desSlug } from '@calendario';
import { CAMPOS_TAXONOMIA, type CampoTaxonomia, type ValorOpcion } from '@/types/actividad';

/** Cómo se llama cada taxonomía para quien la administra, no en jerga del modelo. */
const TITULO: Record<CampoTaxonomia, string> = {
  arancel: 'Arancel',
  tipo: 'Tipo de actividad',
  barrio: 'Barrios',
  plataforma: 'Plataformas',
  tags: 'Etiquetas',
};

const DONDE: Record<CampoTaxonomia, string> = {
  arancel: 'Se elige en «Arancel e inscripción».',
  tipo: 'Es lo primero que se elige al cargar una actividad.',
  barrio: 'Se elige en «Dónde», y viaja al evento del calendario.',
  plataforma: 'Se elige en «Dónde» cuando la actividad es virtual.',
  tags: 'Se escriben en «Opcional». Son los filtros del sitio público.',
};

/**
 * §4.3 · B-06 — pantalla para administrar las taxonomías autogestionadas.
 *
 * El §4.3 dice dos cosas que hasta ahora no tenían dónde pasar: que las
 * opciones creadas con "Otro" **son editables y borrables**, y que `usos` sirve
 * para "detectar basura: una opción con `usos: 1` creada hace meses es casi
 * seguro un typo colgado". Sin esta pantalla, lo primero no se podía hacer y lo
 * segundo no se podía ni mirar: había que abrir la consola de Firestore.
 *
 * Tres reglas que se ven en la pantalla:
 *
 * - las opciones **base** (`fijo: true`) no se pueden renombrar ni borrar. Son
 *   las que puede haber cableadas en la lógica; la guarda de verdad está en
 *   `opciones.ts`, acá solo no se ofrecen los botones;
 * - **renombrar no cambia el slug** (§4.1), así que las actividades que ya la
 *   usan no se desconectan. Es también el arreglo de las etiquetas que quedaron
 *   guardadas en minúscula (B-05);
 * - **borrar no toca las actividades**: la que la tenga guardada sigue
 *   mostrando la etiqueta des-slugueada (D-11). Por eso borrar algo con usos se
 *   confirma aparte.
 *
 * Es autocontenida a propósito: no sabe nada del router del panel, así que
 * montarla es una línea en `AdminApp` (B-167).
 */
export function TaxonomiasPanel() {
  const { porCampo, cargando } = useTodasLasOpciones();
  const [fallo, setFallo] = useState<string | null>(null);
  /** Qué fila está en modo renombre: `campo/slug`. */
  const [editando, setEditando] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  /** Qué fila está esperando la confirmación de borrado. */
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const pendientes = CAMPOS_TAXONOMIA.reduce(
    (total, campo) => total + pendientesDe(porCampo[campo]).length,
    0,
  );

  /** Toda escritura pasa por acá: un solo lugar donde mostrar el fallo. */
  const correr = async (accion: () => Promise<unknown>) => {
    setOcupado(true);
    setFallo(null);
    try {
      await accion();
      setEditando(null);
      setConfirmando(null);
      setTexto('');
    } catch (e) {
      setFallo(e instanceof Error ? e.message : 'No se pudo guardar el cambio.');
    } finally {
      setOcupado(false);
    }
  };

  const fila = (campo: CampoTaxonomia, v: ValorOpcion) => {
    const clave = `${campo}/${v.slug}`;
    const pendiente = !estaAprobada(v);
    // §4.3 — la señal de basura: creada con "Otro" y sin uso real todavía.
    const sospechosa = !v.fijo && v.usos <= 1;

    return (
      <li key={v.slug} className="rounded-md border border-borde bg-white px-3 py-2.5">
        <div className="sm:flex sm:items-baseline sm:gap-3">
          <div className="min-w-0 sm:flex-1">
            <p className="font-serif font-semibold">
              {v.label}
              {v.fijo && (
                <span
                  className="ml-2 rounded-full bg-tinta/8 px-2 py-0.5 text-xs font-sans font-normal text-tinta/60"
                  title="Opción base: puede estar cableada en la lógica del panel o del sitio"
                >
                  base
                </span>
              )}
              {pendiente && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-sans font-normal text-amber-800">
                  sin aprobar
                </span>
              )}
            </p>
            <p className="text-xs text-tinta/55">
              <code>{v.slug}</code> · {v.usos === 1 ? '1 uso' : `${v.usos} usos`}
              {sospechosa && ' · casi sin usar, puede ser un typo'}
            </p>
          </div>

          {/* §4.3 — a una opción base no se le ofrece ninguna acción. */}
          {!v.fijo && editando !== clave && confirmando !== clave && (
            <div className="mt-2 flex flex-wrap gap-2 sm:mt-0 sm:shrink-0">
              {pendiente && (
                <button
                  type="button"
                  className={claseBotonFila}
                  disabled={ocupado}
                  onClick={() => void correr(() => aprobarOpcion(campo, v.slug))}
                >
                  Aprobar
                </button>
              )}
              <button
                type="button"
                className={claseBotonFila}
                disabled={ocupado}
                onClick={() => {
                  setEditando(clave);
                  setTexto(v.label);
                  setFallo(null);
                }}
              >
                Renombrar
              </button>
              <button
                type="button"
                className={claseBotonFila}
                disabled={ocupado}
                onClick={() => {
                  setConfirmando(clave);
                  setFallo(null);
                }}
              >
                Borrar
              </button>
            </div>
          )}
        </div>

        {editando === clave && (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              autoFocus
              className={claseInput}
              value={texto}
              enterKeyHint="done"
              autoCapitalize="sentences"
              aria-label={`Nueva etiqueta para ${v.label}`}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void correr(() => renombrarOpcion(campo, v.slug, texto));
                }
                if (e.key === 'Escape') setEditando(null);
              }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className={`${claseBotonTinta} flex-1 sm:flex-none`}
                disabled={ocupado || !etiquetaPresentable(texto)}
                onClick={() => void correr(() => renombrarOpcion(campo, v.slug, texto))}
              >
                Guardar
              </button>
              <button
                type="button"
                className={`${claseBotonSecundario} flex-1 sm:flex-none`}
                onClick={() => setEditando(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {editando === clave && (
          <p className="mt-1 text-xs text-tinta/55">
            Cambia solo cómo se ve. Las actividades que ya la usan la siguen usando, y su
            dirección en el sitio no se mueve.
          </p>
        )}

        {confirmando === clave && (
          <div className="mt-2 rounded-md border border-acento/30 bg-acento/5 px-3 py-2">
            <p className="text-sm">
              ¿Borrar «{v.label}»?
              {v.usos > 0 && (
                <>
                  {' '}
                  Se usó {v.usos === 1 ? 'una vez' : `${v.usos} veces`}: las actividades que la
                  tengan cargada van a mostrar «{desSlug(v.slug)}» en el sitio y en el
                  calendario.
                </>
              )}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className={claseBotonTinta}
                disabled={ocupado}
                onClick={() => void correr(() => borrarOpcion(campo, v.slug))}
              >
                Sí, borrar
              </button>
              <button
                type="button"
                className={claseBotonSecundario}
                onClick={() => setConfirmando(null)}
              >
                No
              </button>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-base font-semibold">Etiquetas y desplegables</h2>
        <p className="text-xs text-tinta/55">
          Todo lo que se elige de una lista al cargar una actividad se administra acá: se puede
          corregir cómo se escribe una etiqueta y borrar las que sobran. Las marcadas
          «base» son parte del panel y no se tocan.
        </p>

        {/* §4.3 · B-26 — que haya algo esperando validación no puede ser invisible. */}
        {pendientes > 0 && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {pendientes === 1
              ? 'Hay 1 etiqueta esperando aprobación: la otra cuenta todavía no la ve en sus listas.'
              : `Hay ${pendientes} etiquetas esperando aprobación: la otra cuenta todavía no las ve en sus listas.`}
          </p>
        )}

        {fallo && (
          <p className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento">
            {fallo}
          </p>
        )}
      </section>

      {CAMPOS_TAXONOMIA.map((campo) => {
        const valores = porCampo[campo];
        return (
          <section key={campo} className="flex flex-col gap-2">
            <div>
              <h3 className="font-serif text-base font-semibold">{TITULO[campo]}</h3>
              <p className="text-xs text-tinta/55">{DONDE[campo]}</p>
            </div>

            {valores.length === 0 ? (
              <p className="rounded-md border border-dashed border-borde px-3 py-6 text-center text-sm text-tinta/50">
                {cargando
                  ? 'Cargando…'
                  : 'Todavía no hay ninguna. Se crean solas al escribirlas en el formulario.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">{valores.map((v) => fila(campo, v))}</ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
