import { useEffect, useMemo, useState } from 'react';
import {
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
} from '@/components/admin/campos/Campo';
import { DialogoDuplicar } from '@/components/admin/DialogoDuplicar';
import { FiltrosActividades } from '@/components/admin/FiltrosActividades';
import { MenuAcciones } from '@/components/admin/MenuAcciones';
import { useLabelsTaxonomia } from '@/components/admin/useOpciones';
import {
  borrarActividad,
  documentoAForm,
  listarActividades,
  marcarCupoCompleto,
} from '@/lib/actividades';
import { medirFuncion } from '@/lib/analytics';
import { faltaElFlyer, imagenesDe } from '@/lib/imagenes';
import { fechaHoraLegible } from '@/lib/calendarioPanel';
import { ETIQUETA_AUTORIA, autoriaDe } from '@/lib/formulario/autoria';
import {
  casillasAplicables,
  duplicarActividadForm,
  type CasillaCopia,
  type QueCopiar,
} from '@/lib/duplicar';
import {
  ETIQUETA_ESTADO,
  FILTROS_VACIOS,
  ORDEN_POR_DEFECTO,
  hayFiltros,
  legible,
  listaVisible,
  opcionesPresentes,
  proximoEncuentro,
  type Filtros,
  type Orden,
} from '@/lib/filtrosActividades';
import type { LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import type { ActividadConId, ActividadForm } from '@/types/actividad';

interface Props {
  onEditar: (a: ActividadConId) => void;
  onNueva: () => void;
  /** Abre el formulario con una copia lista para editar y guardar como nueva. */
  onDuplicar: (copia: ActividadForm, tituloOrigen: string) => void;
  /** B-40 — abre el historial de versiones de esa actividad. */
  onHistorial: (a: ActividadConId) => void;
  /** Cambia cuando se guarda algo, para refrescar el listado. */
  version: number;
  /** B-130 — para distinguir lo propio de lo que cargó la otra cuenta. */
  uid: string;
}

/**
 * Constante de módulo y no un objeto literal en el render: `useLabelsTaxonomia`
 * lo usa como dependencia de su memo, y uno nuevo por render lo recalcularía
 * siempre. Acá no hay etiquetas a medio crear (eso es del formulario, D-02).
 */
const SIN_PENDIENTES: LabelsTaxonomia = {};

/** "Próximo: lunes 24 de agosto · 19:00", o que no queda nada por pasar. */
const textoProximo = (a: ActividadConId, ahora: Date): string => {
  const proximo = proximoEncuentro(a, ahora);
  return proximo ? `Próximo: ${fechaHoraLegible(proximo)}` : 'Sin encuentros por venir';
};

const COLOR_ESTADO: Record<string, string> = {
  borrador: 'bg-tinta/10 text-tinta/70',
  pendiente: 'bg-amber-100 text-amber-800',
  publicado: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-acento/10 text-acento',
};

export function ListaActividades({
  onEditar,
  onNueva,
  onDuplicar,
  onHistorial,
  version,
  uid,
}: Props) {
  const [actividades, setActividades] = useState<ActividadConId[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [orden, setOrden] = useState<Orden>(ORDEN_POR_DEFECTO);

  /**
   * B-199 — la actividad que se está por duplicar, con las casillas que le
   * aplican. `null` mientras no hay modal abierto.
   *
   * Las casillas se calculan al abrir y quedan guardadas: recalcularlas en cada
   * render sería recorrer el original ocho veces por tilde, y la lista no puede
   * cambiar mientras el modal está abierto.
   */
  const [porDuplicar, setPorDuplicar] = useState<{
    actividad: ActividadConId;
    form: ActividadForm;
    casillas: CasillaCopia[];
  } | null>(null);

  // El reloj se captura una vez: si cada render preguntara la hora, el orden
  // podría cambiar mientras alguien está por tocar una fila.
  const [ahora] = useState(() => new Date());

  // §4.1 — el listado guarda valores de taxonomía (`tipo`, `sede.barrio`) y hay
  // que mostrar la etiqueta. Se resuelven con las opciones que el panel ya tiene
  // cargadas, igual que la vista previa del evento.
  const labels = useLabelsTaxonomia(SIN_PENDIENTES);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    listarActividades()
      .then((as) => vivo && setActividades(as))
      .catch((e: unknown) => vivo && setFallo(e instanceof Error ? e.message : 'Error al listar'))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [version]);

  /**
   * B-96 / B-126 — filtrar y ordenar es función pura sobre lo que ya está en
   * memoria: `listarActividades` trae la colección completa, así que no hay una
   * sola lectura nueva de Firestore (§2.5). La normalización del texto es la
   * misma que va a usar el sitio público (§6).
   */
  const filtradas = useMemo(
    () => listaVisible(actividades, filtros, orden, ahora),
    [actividades, filtros, orden, ahora],
  );

  const opciones = useMemo(() => opcionesPresentes(actividades), [actividades]);

  /**
   * B-11 — la copia se arma acá porque el listado ya tiene todos los slugs en
   * memoria: alcanza para proponer uno libre sin ir a Firestore. La guarda real
   * contra el choque sigue siendo `slugDisponible` en el submit.
   *
   * La medición está acá y no al abrir el modal: lo que se quiere contar son las
   * copias que se hicieron, no las que se pensaron y se cancelaron.
   */
  const confirmarDuplicado = (
    a: ActividadConId,
    form: ActividadForm,
    copiar?: QueCopiar,
  ) => {
    medirFuncion('actividad-duplicar', undefined, a.sesiones?.length ?? 0);
    const copia = duplicarActividadForm(form, {
      tomados: actividades.map((x) => x.slug),
      copiar,
    });
    setPorDuplicar(null);
    onDuplicar(copia, a.titulo);
  };

  /**
   * B-199 — «Duplicar» abre el modal en vez de duplicar de una.
   *
   * La conversión a formulario se hace acá y se guarda: es lo que el modal
   * necesita para decidir qué casillas mostrar, y volver a convertir al confirmar
   * daría dos formularios distintos sobre el mismo documento.
   *
   * **Si no aplica ninguna casilla, se duplica directo.** Un modal con cero
   * opciones es un click de peaje: no hay nada que desmarcar.
   */
  const duplicar = (a: ActividadConId) => {
    const form = documentoAForm(a);
    const casillas = casillasAplicables(form);
    if (casillas.length === 0) {
      confirmarDuplicado(a, form);
      return;
    }
    setPorDuplicar({ actividad: a, form, casillas });
  };

  /**
   * B-97 — «se llenó», desde acá y no desde el formulario.
   *
   * Es el pedido tal cual: un toque desde el teléfono, sin abrir 30+ campos para
   * tocar una casilla. Escribe **solo** `inscripcion.completo`
   * (`marcarCupoCompleto`), y de ahí sale la línea de la descripción de los N
   * eventos del ciclo — que es cómo se entera quien ya estaba suscripto al
   * calendario, sin que nadie le avise (§7.1, D-07).
   *
   * La fila se actualiza en memoria en lugar de recargar el listado: recargar
   * pierde el filtro y el scroll, y lo que cambió es un booleano de una fila.
   *
   * `valor` lleva 1 al prender y 0 al apagar: apagar es la mitad interesante de
   * la pregunta —si el cartel se saca cuando se libera un lugar— y es un entero,
   * no contenido (§9).
   */
  const marcarCupo = (a: ActividadConId, completo: boolean) => {
    medirFuncion('actividad-cupo-completo', undefined, completo ? 1 : 0);
    marcarCupoCompleto(a.id, completo, uid)
      .then(() =>
        setActividades((as) =>
          as.map((x) =>
            x.id === a.id ? { ...x, inscripcion: { ...x.inscripcion, completo } } : x,
          ),
        ),
      )
      .catch((e: unknown) =>
        setFallo(e instanceof Error ? e.message : 'No se pudo cambiar el cupo'),
      );
  };

  const eliminar = async (a: ActividadConId) => {
    if (!confirm(`¿Borrar «${a.titulo}»? No se puede deshacer.`)) return;
    await borrarActividad(a.id);
    setActividades((as) => as.filter((x) => x.id !== a.id));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          className={`${claseInput} sm:max-w-xs`}
          placeholder="Buscar…"
          value={filtros.texto}
          onChange={(e) => setFiltros((f) => ({ ...f, texto: e.target.value }))}
        />
        <button
          type="button"
          onClick={onNueva}
          className={`${claseBotonPrimario} w-full sm:ml-auto sm:w-auto`}
        >
          + Nueva actividad
        </button>
      </div>

      <FiltrosActividades
        filtros={filtros}
        onFiltros={setFiltros}
        orden={orden}
        onOrden={setOrden}
        opciones={opciones}
        labels={labels}
        total={actividades.length}
        mostradas={filtradas.length}
      />

      {cargando && <p className="text-sm text-tinta/50">Cargando…</p>}
      {fallo && (
        <p className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento">
          {fallo}
        </p>
      )}

      {!cargando && filtradas.length === 0 && (
        <p className="rounded-md border border-dashed border-borde px-3 py-10 text-center text-sm text-tinta/50">
          {actividades.length === 0
            ? 'Todavía no hay actividades.'
            : hayFiltros(filtros)
              ? 'Nada coincide con la búsqueda ni con los filtros puestos.'
              : 'Nada coincide con la búsqueda.'}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {filtradas.map((a) => (
          <li
            key={a.id}
            className="rounded-md border border-borde bg-white px-3 py-2.5 sm:flex sm:items-center sm:gap-3"
          >
            <div className="flex min-w-0 items-start gap-2 sm:flex-1">
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif font-semibold">{a.titulo}</p>
                <p className="text-xs text-tinta/55">
                  {/* §4.1 — la etiqueta, nunca el valor guardado: en el panel
                      "club-lectura" se lee "Club de lectura". */}
                  {labels.tipo?.[a.tipo] ?? legible(a.tipo)} · {a.sesiones?.length ?? 0}{' '}
                  {(a.sesiones?.length ?? 0) === 1 ? 'encuentro' : 'encuentros'}
                  {a.sede?.barrio
                    ? ` · ${labels.barrio?.[a.sede.barrio] ?? legible(a.sede.barrio)}`
                    : ''}
                </p>
                {/* B-96 — la fecha que importa es la que viene, no la última
                    modificación: es lo que hace accionable el listado. */}
                <p className="text-xs text-tinta/45">
                  {textoProximo(a, ahora)}
                  {/*
                    B-130 — `createdBy` se guardaba en cada documento y no se
                    leía en ninguna parte, así que "¿esto lo cargué yo?" no se
                    podía contestar mirando la pantalla. Solo se marca lo ajeno:
                    si todo lleva marca, la marca deja de avisar.
                  */}
                  {ETIQUETA_AUTORIA[autoriaDe(a, uid)] && (
                    <span className="ml-1.5 text-tinta/40">
                      · {ETIQUETA_AUTORIA[autoriaDe(a, uid)]}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${COLOR_ESTADO[a.estado] ?? ''}`}
                >
                  {ETIQUETA_ESTADO[a.estado] ?? a.estado}
                </span>
                {/*
                  B-97 — lo que se publica se ve desde el panel. Sin este cartel,
                  «está marcada como completa» solo se sabría abriendo el menú, y
                  el sitio y el calendario ya lo están diciendo.
                */}
                {a.inscripcion?.completo === true && (
                  <span className="whitespace-nowrap rounded-full border border-tinta/25 px-2 py-0.5 text-xs text-tinta/70">
                    Cupo completo
                  </span>
                )}
                {/*
                  B-264 — «se nota que falta». El aviso de la barra solo lo ve
                  quien ya abrió esa actividad; el listado es donde se ve el
                  conjunto, y el conjunto era 2 con imagen sobre 42.

                  **Solo en las publicadas, y solo cuando falta** — es la misma
                  regla que la marca de autoría de B-130: si todo lleva marca, la
                  marca deja de avisar. Un borrador sin flyer no le falta nada
                  todavía; una publicada sin flyer ya está afuera de la cartelera.

                  La condición sale de `faltaElFlyer`, la misma que usan el aviso
                  del formulario y la cartelera: tres lugares que tienen que
                  decir lo mismo y una sola derivación.
                */}
                {a.estado === 'publicado' && faltaElFlyer(imagenesDe(a)) && (
                  <span className="whitespace-nowrap rounded-full border border-tinta/25 px-2 py-0.5 text-xs text-tinta/70">
                    Sin flyer
                  </span>
                )}
              </div>
            </div>
            {/*
              Duplicar y borrar van en un menú y no en la fila: tres botones en
              360px dan blancos de ~100px y se erra el toque. Ver MenuAcciones.
            */}
            <div className="mt-2 flex gap-2 sm:mt-0 sm:shrink-0">
              <button
                type="button"
                onClick={() => onEditar(a)}
                className={`${claseBotonSecundario} flex-1 sm:flex-none`}
              >
                Editar
              </button>
              <MenuAcciones
                etiqueta={`Más acciones de ${a.titulo}`}
                acciones={[
                  // B-97 va primero: es la acción de después de publicar, la que
                  // se busca apurado desde el teléfono cuando se llenó.
                  {
                    label:
                      a.inscripcion?.completo === true
                        ? 'Marcar cupo disponible'
                        : 'Marcar cupo completo',
                    onSelect: () => marcarCupo(a, a.inscripcion?.completo !== true),
                  },
                  // `devuelveFoco`: abre una capa encima del listado, así que
                  // el foco tiene que estar en el "⋯" cuando la capa se monta —
                  // es a ese botón al que vuelve al cerrarse (B-14).
                  { label: 'Duplicar', onSelect: () => duplicar(a), devuelveFoco: true },
                  // B-40 — va acá y no en el formulario: recuperar un campo
                  // pisado se busca desde el listado ("¿qué le pasó a esta?"),
                  // y el formulario ya tiene 30+ campos peleando por espacio.
                  { label: 'Historial', onSelect: () => onHistorial(a) },
                  { label: 'Borrar', onSelect: () => void eliminar(a), peligrosa: true },
                ]}
              />
            </div>
          </li>
        ))}
      </ul>

      {porDuplicar && (
        <DialogoDuplicar
          titulo={porDuplicar.actividad.titulo}
          casillas={porDuplicar.casillas}
          onCancelar={() => setPorDuplicar(null)}
          onConfirmar={(copiar) =>
            confirmarDuplicado(porDuplicar.actividad, porDuplicar.form, copiar)
          }
        />
      )}
    </div>
  );
}
