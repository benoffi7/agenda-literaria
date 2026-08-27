import { useEffect, useMemo, useState } from 'react';
import {
  claseBotonChip,
  claseBotonChipActivo,
  claseBotonSecundario,
  claseEnlaceCelda,
} from '@/components/admin/campos/Campo';
import { listarActividades } from '@/lib/actividades';
import {
  ESTADOS_CIERRE,
  INFO_CIERRE,
  INFO_PUBLICACION,
  INICIALES_SEMANA,
  agendaDe,
  cierresDe,
  cierresDelMes,
  cierresQueUrgen,
  claveDia,
  claveMes,
  diaLegible,
  encuentrosDe,
  encuentrosDelMes,
  estadoCierre,
  filtrarPorGrupo,
  mesInicial,
  mesMasCercanoConEncuentros,
  mesRelativo,
  mesesConEncuentros,
  nombreMes,
  porDia,
  porDiaCierres,
  problemasDePublicacion,
  resumenPublicacion,
  semanasDelMes,
  yaPaso,
  type Cierre,
  type Encuentro,
  type EstadoCierre,
  type EstadoPublicacion,
  type GrupoPublicacion,
} from '@/lib/calendarioPanel';
import type { ActividadConId } from '@/types/actividad';

interface Props {
  onEditar: (a: ActividadConId) => void;
  /** Cambia cuando se guarda algo, para refrescar la vista. */
  version: number;
}

/**
 * Color de cada estado de publicación. Vive acá y no en `calendarioPanel.ts`
 * porque es pintura: el módulo puro no sabe de Tailwind. Se apoya en la misma
 * paleta que el badge de estado del listado, para que "publicado" sea el mismo
 * verde en las dos pantallas.
 */
const COLOR_PUBLICACION: Record<EstadoPublicacion, string> = {
  'en-calendario': 'bg-emerald-100 text-emerald-800',
  // El problema accionable es el único que se pinta con el acento pleno: es lo
  // que hay que ver desde la otra punta de la pantalla.
  'falta-en-calendario': 'bg-acento text-white',
  'sobra-en-calendario': 'bg-amber-200 text-amber-900',
  'encuentro-cancelado': 'bg-acento/10 text-acento',
  borrador: 'bg-tinta/10 text-tinta/70',
  pendiente: 'bg-amber-100 text-amber-800',
  cancelado: 'bg-acento/10 text-acento',
};

/** El punto de color de la grilla, donde no cabe el texto del chip. */
const PUNTO_PUBLICACION: Record<EstadoPublicacion, string> = {
  'en-calendario': 'bg-emerald-500',
  'falta-en-calendario': 'bg-acento',
  'sobra-en-calendario': 'bg-amber-400',
  'encuentro-cancelado': 'bg-acento/40',
  borrador: 'bg-tinta/30',
  pendiente: 'bg-amber-300',
  cancelado: 'bg-acento/40',
};

/**
 * B-126 — el cierre de inscripción se pinta en **otra familia de color** que los
 * estados de publicación, y esa es la mitad del marcador: los verdes, ámbares y
 * acentos de arriba contestan *¿esto ya lo ve la gente?*, y un cierre contesta
 * otra pregunta. El celeste no significa nada en esta pantalla todavía, que es
 * exactamente lo que se necesita para que no se lea como un estado más.
 *
 * La excepción es `vencido`: ahí sí toma el acento pleno, porque es lo único de
 * este eje que pide una acción y comparte urgencia con `falta-en-calendario`.
 */
const COLOR_CIERRE: Record<EstadoCierre, string> = {
  'por-venir': 'bg-sky-100 text-sky-800',
  vencido: 'bg-acento text-white',
  'cupo-completo': 'bg-tinta/10 text-tinta/70',
};

/** El punto de color de la grilla, donde no cabe el texto del chip. */
const PUNTO_CIERRE: Record<EstadoCierre, string> = {
  'por-venir': 'bg-sky-500',
  vencido: 'bg-acento',
  'cupo-completo': 'bg-tinta/30',
};

/**
 * El borde de la fila. Punteado en los tres casos a propósito: en la agenda un
 * cierre y un encuentro son dos filas del mismo tamaño, y el color solo no
 * alcanza para distinguirlos de un vistazo ni para quien no lo distingue.
 */
const BORDE_CIERRE: Record<EstadoCierre, string> = {
  'por-venir': 'border-sky-300 bg-sky-50/60',
  vencido: 'border-acento/50 bg-acento/5',
  'cupo-completo': 'border-borde bg-white',
};

const GRUPOS: { id: GrupoPublicacion | null; label: string }[] = [
  { id: null, label: 'Todos' },
  { id: 'visible', label: 'En el calendario' },
  { id: 'problema', label: 'Con problema' },
  { id: 'oculto', label: 'Sin publicar' },
];

/** Chip con la etiqueta del estado de publicación. */
function ChipEstado({ estado }: { estado: EstadoPublicacion }) {
  const info = INFO_PUBLICACION[estado];
  return (
    <span
      title={info.significa}
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${COLOR_PUBLICACION[estado]}`}
    >
      {info.etiqueta}
    </span>
  );
}

/** Chip con la etiqueta del estado de un cierre de inscripción (B-126). */
function ChipCierre({ estado }: { estado: EstadoCierre }) {
  const info = INFO_CIERRE[estado];
  return (
    <span
      title={info.significa}
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${COLOR_CIERRE[estado]}`}
    >
      {info.etiqueta}
    </span>
  );
}

/**
 * Una fila de cierre de inscripción en la agenda (B-126).
 *
 * Al tocarla se abre la actividad, igual que con un encuentro: la unidad de
 * edición sigue siendo una (§2.2, D-70), y lo que hay que tocar —correr la
 * fecha— está ahí adentro.
 */
function FilaCierre({
  cierre,
  estado,
  onAbrir,
}: {
  cierre: Cierre;
  estado: EstadoCierre;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`flex min-h-touch w-full items-center gap-3 rounded-md border border-dashed px-3 py-2 text-left transition-colors hover:bg-black/[0.03] ${BORDE_CIERRE[estado]}`}
    >
      <span className="w-11 shrink-0 font-mono text-xs text-tinta/60">{cierre.hora}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{cierre.titulo}</span>
        <span className="block truncate text-xs text-tinta/55">
          Inscripción{cierre.cupo ? ` · cupo ${cierre.cupo}` : ''}
        </span>
      </span>
      <ChipCierre estado={estado} />
    </button>
  );
}

/** Una fila de la agenda: hora, actividad, posición en el ciclo y estado. */
function FilaEncuentro({
  encuentro,
  pasado,
  onAbrir,
}: {
  encuentro: Encuentro;
  pasado: boolean;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`flex min-h-touch w-full items-center gap-3 rounded-md border border-borde bg-white px-3 py-2 text-left transition-colors hover:bg-black/[0.03] ${
        pasado ? 'opacity-70' : ''
      }`}
    >
      <span className="w-11 shrink-0 font-mono text-xs text-tinta/60">{encuentro.hora}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{encuentro.titulo}</span>
        <span className="block truncate text-xs text-tinta/55">
          {/* §2.2 — el "2 de 8" es lo que impide leer un ciclo como ocho
              actividades distintas. */}
          {encuentro.total > 1 ? `Encuentro ${encuentro.indice} de ${encuentro.total}` : 'Encuentro único'}
          {encuentro.tema ? ` · ${encuentro.tema}` : ''}
        </span>
      </span>
      <ChipEstado estado={encuentro.estado} />
    </button>
  );
}

/**
 * Vista calendario del panel (B-125, D-70 a D-72).
 *
 * **Qué contesta que el listado no contesta:** *¿esto ya lo ve la gente?* El
 * listado muestra el campo `estado` de la actividad, y eso no alcanza: un
 * encuentro puede estar en una actividad publicada, no cancelado, y no existir
 * en el calendario porque la publicación falló. Acá el estado se deriva de los
 * tres datos a la vez (ver `calendarioPanel.ts`) y ese caso —que hoy no muestra
 * ninguna pantalla— aparece arriba de todo, en todos los meses a la vez.
 *
 * **Una tarjeta por actividad, un día por encuentro (D-70):** son dos lentes
 * sobre lo mismo. Acá se enumeran encuentros, pero cada uno dice qué lugar ocupa
 * en su actividad y **al tocarlo se abre la actividad**: la unidad de edición
 * sigue siendo una, como manda el §2.2.
 *
 * **Dos ejes de fechas, no uno (B-126):** los encuentros y los **cierres de
 * inscripción**. Un cierre es una fecha con la misma urgencia que un encuentro y
 * no la mostraba ninguna pantalla: pasada, la actividad sigue publicada
 * invitando a anotarse con el mail o el WhatsApp a la vista. Son marcadores
 * aparte —otro color, borde punteado, tipo `Cierre` y no `Encuentro`— porque no
 * salen al calendario público, no tienen estado de publicación y no cuentan en el
 * resumen. Lo que se llenó (`inscripcion.completo`, D-127) se marca y **no**
 * entra al aviso: es el caso más común y no pide nada.
 *
 * **Mobile (D-72):** la grilla de mes se muestra recién desde `sm`. En 360px
 * siete columnas dan celdas de 45px, donde no entra ni la hora, así que abajo de
 * ese ancho se ve siempre la agenda: los días con algo —encuentros o cierres—,
 * uno abajo del otro, con blancos táctiles de 44px.
 */
export function CalendarioActividades({ onEditar, version }: Props) {
  const [actividades, setActividades] = useState<ActividadConId[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState<string | null>(null);
  const [mesElegido, setMesElegido] = useState<string | null>(null);
  const [modo, setModo] = useState<'mes' | 'agenda'>('mes');
  const [grupo, setGrupo] = useState<GrupoPublicacion | null>(null);

  // El reloj se captura una vez: si cada render preguntara la hora, "ya pasó"
  // podría cambiar en medio de una interacción.
  const [ahora] = useState(() => new Date());

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

  const porIdActividad = useMemo(
    () => new Map(actividades.map((a) => [a.id, a])),
    [actividades],
  );

  // Todo lo que sigue es función pura sobre lo que ya está en memoria: cero
  // lecturas nuevas de Firestore (§2.5).
  const encuentros = useMemo(() => encuentrosDe(actividades), [actividades]);
  const problemas = useMemo(() => problemasDePublicacion(encuentros, ahora), [encuentros, ahora]);

  // Sin elección explícita se abre en el mes del primer problema por venir: si
  // abriera siempre en el mes de hoy, el problema quedaría a dos clicks y nadie
  // lo vería nunca.
  const mes = mesElegido ?? (cargando ? claveMes(ahora) : mesInicial(encuentros, ahora));

  // B-126 — el otro eje de fechas de la pantalla. Es función pura sobre las
  // mismas actividades: ni una lectura nueva de Firestore.
  const cierres = useMemo(() => cierresDe(actividades), [actividades]);
  const cierresUrgentes = useMemo(() => cierresQueUrgen(cierres, ahora), [cierres, ahora]);

  const delMes = useMemo(() => encuentrosDelMes(encuentros, mes), [encuentros, mes]);
  const visibles = useMemo(() => filtrarPorGrupo(delMes, grupo), [delMes, grupo]);
  const resumen = useMemo(() => resumenPublicacion(delMes), [delMes]);
  // Con un filtro de publicación puesto los cierres se esconden: ese filtro es
  // sobre el estado de los encuentros en el calendario, y un cierre no tiene
  // ninguno. Dejarlos visibles haría que "Con problema (2)" muestre tres cosas.
  const cierresVisibles = useMemo(
    () => (grupo === null ? cierresDelMes(cierres, mes) : []),
    [cierres, mes, grupo],
  );
  const dias = useMemo(() => agendaDe(visibles, cierresVisibles), [visibles, cierresVisibles]);
  const indicePorDia = useMemo(() => porDia(visibles), [visibles]);
  const indiceCierres = useMemo(() => porDiaCierres(cierresVisibles), [cierresVisibles]);
  const hayAlgoEnElMes = visibles.length > 0 || cierresVisibles.length > 0;
  const semanas = useMemo(() => semanasDelMes(mes), [mes]);
  const mesCercano = useMemo(
    () => mesMasCercanoConEncuentros(mesesConEncuentros(encuentros), mes),
    [encuentros, mes],
  );

  const hoy = claveDia(ahora);
  /**
   * La unidad de edición es la actividad (§2.2, D-70): tanto un encuentro como
   * un cierre de inscripción abren la misma pantalla.
   */
  const abrirId = (actividadId: string) => {
    const actividad = porIdActividad.get(actividadId);
    if (actividad) onEditar(actividad);
  };

  const abrir = (encuentro: Encuentro) => abrirId(encuentro.actividadId);

  const agenda = (
    <div className="flex flex-col gap-4">
      {dias.map(({ dia, encuentros: delDia, cierres: cierresDelDia }) => (
        <div key={dia} className="flex flex-col gap-1.5">
          <h3
            className={`text-sm font-medium ${
              dia === hoy ? 'text-acento' : dia < hoy ? 'text-tinta/45' : 'text-tinta/70'
            }`}
          >
            {diaLegible(dia)}
            {dia === hoy && ' · hoy'}
          </h3>
          {delDia.map((e) => (
            <FilaEncuentro
              key={e.sesionId}
              encuentro={e}
              pasado={yaPaso(e, ahora)}
              onAbrir={() => abrir(e)}
            />
          ))}
          {/* B-126 — los cierres van después de los encuentros del día: son el
              eje secundario, y así el día se sigue leyendo por lo que pasa. */}
          {cierresDelDia.map((c) => (
            <FilaCierre
              key={`cierre-${c.actividadId}`}
              cierre={c}
              estado={estadoCierre(c, ahora)}
              onAbrir={() => abrirId(c.actividadId)}
            />
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── Lo que hoy es invisible: el aviso va antes que el calendario y
             cuenta TODOS los meses, no el que se está mirando. ────────── */}
      {problemas.porVenir.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-acento/40 bg-acento/5 px-3 py-2.5 text-sm"
        >
          <p className="font-medium text-acento">
            {problemas.porVenir.length === 1
              ? 'Hay 1 encuentro por venir que no está como debería en el calendario.'
              : `Hay ${problemas.porVenir.length} encuentros por venir que no están como deberían en el calendario.`}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-tinta/70">
            {(['falta-en-calendario', 'sobra-en-calendario'] as const)
              .map((estado) => ({
                estado,
                cuantos: problemas.porVenir.filter((e) => e.estado === estado).length,
              }))
              .filter(({ cuantos }) => cuantos > 0)
              .map(({ estado, cuantos }) => (
                <li key={estado} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                  <span className="flex shrink-0 items-center gap-1">
                    <ChipEstado estado={estado} />
                    <span className="text-tinta/60">× {cuantos}</span>
                  </span>
                  <span>{INFO_PUBLICACION[estado].significa}</span>
                </li>
              ))}
          </ul>
          {problemas.meses.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {problemas.meses.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMesElegido(m)}
                  className={m === mes ? claseBotonChipActivo : claseBotonChip}
                >
                  Ver {nombreMes(m)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/*
        Se cuentan por separado porque el consejo es opuesto. `pasados` es el
        grupo `problema` completo, y para la mitad `sobra` las dos frases del
        texto anterior eran falsas: el encuentro no "quedó sin publicarse"
        —está publicado de más— y sí tiene arreglo, porque el evento sigue
        colgado en el calendario público y hay que borrarlo. Un texto que dice
        "ya no tiene arreglo" empuja a no tocar algo que la gente todavía ve.
      */}
      {problemas.pasados.length > 0 && (
        <div className="flex flex-col gap-1 text-xs text-tinta/55">
          {(() => {
            const faltaron = problemas.pasados.filter((e) => e.estado === 'falta-en-calendario');
            const sobran = problemas.pasados.filter((e) => e.estado === 'sobra-en-calendario');
            return (
              <>
                {faltaron.length > 0 && (
                  <p>
                    Además, {faltaron.length}{' '}
                    {faltaron.length === 1 ? 'encuentro que ya pasó' : 'encuentros que ya pasaron'}{' '}
                    {faltaron.length === 1 ? 'quedó' : 'quedaron'} sin publicarse. Eso ya no tiene
                    arreglo: queda como registro de que ese día no salió al calendario.
                  </p>
                )}
                {sobran.length > 0 && (
                  <p className="text-acento">
                    Y {sobran.length}{' '}
                    {sobran.length === 1 ? 'encuentro que ya pasó sigue' : 'encuentros que ya pasaron siguen'}{' '}
                    en el calendario público sin corresponder. Eso sí se puede arreglar: volvé a
                    guardar la actividad para que se borren.
                  </p>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ── B-126 · La inscripción que cerró y sigue invitando ──────
             Va acá y no en el mes que se está mirando: una inscripción vencida
             en noviembre seguiría invisible mientras se mira septiembre. Lo que
             se llenó no entra —`cupo-completo` no urge (D-127)—, porque un aviso
             que se enciende en el caso más común se apaga en la cabeza de quien
             lo mira. ──────────────────────────────────────────────────── */}
      {cierresUrgentes.vencidos.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-acento/40 bg-acento/5 px-3 py-2.5 text-sm"
        >
          <p className="font-medium text-acento">
            {cierresUrgentes.vencidos.length === 1
              ? 'Hay 1 actividad publicada cuya inscripción ya cerró.'
              : `Hay ${cierresUrgentes.vencidos.length} actividades publicadas cuya inscripción ya cerró.`}
          </p>
          <p className="mt-1.5 text-xs text-tinta/70">{INFO_CIERRE.vencido.significa}</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-tinta/70">
            {cierresUrgentes.vencidos.map((c) => (
              <li key={`vencido-${c.actividadId}`}>
                <button
                  type="button"
                  onClick={() => abrirId(c.actividadId)}
                  className="min-h-touch text-left underline decoration-dotted hover:text-acento sm:min-h-0"
                >
                  {c.titulo} · cerró el {diaLegible(c.dia)} · {c.hora}
                </button>
              </li>
            ))}
          </ul>
          {cierresUrgentes.meses.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {cierresUrgentes.meses.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMesElegido(m)}
                  className={m === mes ? claseBotonChipActivo : claseBotonChip}
                >
                  Ver {nombreMes(m)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Navegación del mes ─────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Ir a ${nombreMes(mesRelativo(mes, -1))}`}
            onClick={() => setMesElegido(mesRelativo(mes, -1))}
            className={claseBotonSecundario}
          >
            <span aria-hidden>‹</span>
          </button>
          <h2 className="min-w-0 flex-1 font-serif text-base font-semibold sm:min-w-40">
            {nombreMes(mes)}
          </h2>
          <button
            type="button"
            aria-label={`Ir a ${nombreMes(mesRelativo(mes, 1))}`}
            onClick={() => setMesElegido(mesRelativo(mes, 1))}
            className={claseBotonSecundario}
          >
            <span aria-hidden>›</span>
          </button>
          {mes !== claveMes(ahora) && (
            <button
              type="button"
              onClick={() => setMesElegido(claveMes(ahora))}
              className={claseBotonChip}
            >
              Hoy
            </button>
          )}
        </div>

        {/* La grilla no existe abajo de sm, así que el cambio de vista tampoco:
            ahí siempre se ve la agenda. */}
        <div className="hidden gap-2 sm:ml-auto sm:flex">
          <button
            type="button"
            aria-pressed={modo === 'mes'}
            onClick={() => setModo('mes')}
            className={modo === 'mes' ? claseBotonChipActivo : claseBotonChip}
          >
            Mes
          </button>
          <button
            type="button"
            aria-pressed={modo === 'agenda'}
            onClick={() => setModo('agenda')}
            className={modo === 'agenda' ? claseBotonChipActivo : claseBotonChip}
          >
            Agenda
          </button>
        </div>
      </div>

      {/* ── Resumen y filtro por estado de publicación ─────────────── */}
      {!cargando && delMes.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-tinta/60">
            {/* Encuentros Y actividades: "8 encuentros de 1 actividad" es lo que
                evita leer un ciclo como ocho cosas distintas (§2.2). */}
            {resumen.total} {resumen.total === 1 ? 'encuentro' : 'encuentros'} de{' '}
            {resumen.actividades} {resumen.actividades === 1 ? 'actividad' : 'actividades'} ·{' '}
            {resumen.visible} en el calendario · {resumen.problema} con problema ·{' '}
            {resumen.oculto} sin publicar
          </p>
          <div className="flex flex-wrap gap-2">
            {GRUPOS.map(({ id, label }) => (
              <button
                key={id ?? 'todos'}
                type="button"
                aria-pressed={grupo === id}
                onClick={() => setGrupo(id)}
                className={grupo === id ? claseBotonChipActivo : claseBotonChip}
              >
                {label}
                {id && ` (${resumen[id]})`}
              </button>
            ))}
          </div>
        </div>
      )}

      {cargando && <p className="text-sm text-tinta/50">Cargando…</p>}
      {fallo && (
        <p className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento">
          {fallo}
        </p>
      )}

      {/* ── Mes vacío: dice para qué lado hay algo ───────────────────
             `cierresVisibles` entra en la cuenta (B-126): un mes sin encuentros
             pero con una inscripción que cierra tiene algo que mostrar, y decirle
             "no hay nada" sería justo esconder el marcador nuevo. ───────── */}
      {!cargando && delMes.length === 0 && cierresVisibles.length === 0 && (
        <div className="rounded-md border border-dashed border-borde px-3 py-10 text-center text-sm text-tinta/55">
          {encuentros.length === 0 && cierres.length === 0 ? (
            <p>Todavía no hay encuentros cargados en ninguna actividad.</p>
          ) : (
            <>
              <p>En {nombreMes(mes)} no hay encuentros.</p>
              {mesCercano && (
                <button
                  type="button"
                  onClick={() => setMesElegido(mesCercano)}
                  className={`${claseBotonChip} mt-3`}
                >
                  Ir a {nombreMes(mesCercano)}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {!cargando && delMes.length > 0 && !hayAlgoEnElMes && (
        <p className="rounded-md border border-dashed border-borde px-3 py-10 text-center text-sm text-tinta/55">
          En {nombreMes(mes)} no hay encuentros que coincidan con ese filtro.
        </p>
      )}

      {/* ── Grilla de mes: solo desde sm (D-72) ─────────────────────── */}
      {hayAlgoEnElMes && modo === 'mes' && (
        <div className="hidden sm:block">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-tinta/50">
            {INICIALES_SEMANA.map((inicial, i) => (
              <div key={i} className="py-1">
                {inicial}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {semanas.map((semana, i) => (
              <div key={i} className="grid grid-cols-7 gap-1">
                {semana.map((dia, j) => {
                  if (!dia) return <div key={`vacio-${j}`} className="min-h-24 rounded-md" />;
                  const delDia = indicePorDia.get(dia) ?? [];
                  // B-126 — en una celda de grilla entran pocas líneas, así que
                  // se muestran hasta tres encuentros y hasta dos cierres, y lo
                  // que sobra de los dos se suma en un solo "+N más".
                  const cierresDelDia = indiceCierres.get(dia) ?? [];
                  const sobran =
                    Math.max(0, delDia.length - 3) + Math.max(0, cierresDelDia.length - 2);
                  return (
                    <div
                      key={dia}
                      className={`flex min-h-24 min-w-0 flex-col gap-0.5 rounded-md border p-1 ${
                        dia === hoy ? 'border-acento bg-acento/[0.04]' : 'border-borde bg-white'
                      } ${dia < hoy ? 'opacity-75' : ''}`}
                    >
                      <span className="text-xs text-tinta/45">{Number(dia.slice(-2))}</span>
                      {delDia.slice(0, 3).map((e) => (
                        <button
                          key={e.sesionId}
                          type="button"
                          onClick={() => abrir(e)}
                          title={`${e.hora} · ${e.titulo} — ${INFO_PUBLICACION[e.estado].etiqueta}`}
                          className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-black/5"
                        >
                          <span
                            aria-hidden
                            className={`size-1.5 shrink-0 rounded-full ${PUNTO_PUBLICACION[e.estado]}`}
                          />
                          <span className="truncate">
                            <span className="text-tinta/55">{e.hora}</span> {e.titulo}
                          </span>
                          <span className="sr-only">
                            {' '}
                            — {INFO_PUBLICACION[e.estado].etiqueta}
                          </span>
                        </button>
                      ))}
                      {cierresDelDia.slice(0, 2).map((c) => {
                        const estado = estadoCierre(c, ahora);
                        return (
                          <button
                            key={`cierre-${c.actividadId}`}
                            type="button"
                            onClick={() => abrirId(c.actividadId)}
                            title={`${c.hora} · ${c.titulo} — ${INFO_CIERRE[estado].etiqueta}`}
                            className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-black/5"
                          >
                            <span
                              aria-hidden
                              className={`size-1.5 shrink-0 rounded-full ${PUNTO_CIERRE[estado]}`}
                            />
                            <span className="truncate italic">
                              <span className="text-tinta/55">{c.hora}</span> {c.titulo}
                            </span>
                            <span className="sr-only"> — {INFO_CIERRE[estado].etiqueta}</span>
                          </button>
                        );
                      })}
                      {sobran > 0 && (
                        <button
                          type="button"
                          onClick={() => setModo('agenda')}
                          className={claseEnlaceCelda}
                        >
                          +{sobran} más
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* La agenda es la vista de mobile siempre, y la elegida en escritorio
          cuando se pide. En modo mes se esconde desde sm, donde ya está la
          grilla. */}
      {hayAlgoEnElMes && (
        <div className={modo === 'mes' ? 'sm:hidden' : undefined}>{agenda}</div>
      )}

      {/* ── Qué significa cada estado ──────────────────────────────── */}
      <details className="rounded-md border border-borde bg-white/60 px-3 py-2 text-sm">
        <summary className="min-h-touch cursor-pointer py-1.5 text-tinta/70">
          Qué significa cada estado
        </summary>
        <ul className="flex flex-col gap-2 pb-1">
          {Object.entries(INFO_PUBLICACION).map(([estado, info]) => (
            <li key={estado} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
              <ChipEstado estado={estado as EstadoPublicacion} />
              <span className="text-xs text-tinta/65">{info.significa}</span>
            </li>
          ))}
          {/* B-126 — los cierres se explican en la misma lista: el marcador es
              nuevo y sin esto nadie sabe qué es la fila punteada. */}
          {ESTADOS_CIERRE.map((estado) => (
            <li
              key={`cierre-${estado}`}
              className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2"
            >
              <ChipCierre estado={estado} />
              <span className="text-xs text-tinta/65">{INFO_CIERRE[estado].significa}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
