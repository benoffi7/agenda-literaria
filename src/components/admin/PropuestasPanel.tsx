import { useEffect, useMemo, useRef, useState } from 'react';
import { claseBotonPrimario, claseBotonSecundario, claseInput } from '@/components/campos/Campo';
import { useOpciones } from '@/components/admin/useOpciones';
import { medirFuncion } from '@/lib/analytics';
import {
  enlaceDeContacto,
  enlaceDeImagen,
  esPendiente,
  fraseDeFechaPropuesta,
  observarPropuestas,
  revisarPropuesta,
} from '@/lib/bandejaDePropuestas';
import { propuestaAFormulario } from '@/lib/propuestas';
import type { ActividadForm, ValorOpcion } from '@/types/actividad';
import type { EstadoPropuesta, PropuestaConId } from '@/types/propuesta';
import { TOPE_MOTIVO_PROPUESTA } from '@/types/propuesta';

/**
 * **La bandeja** — B-830, paso 7 de la tajada 1.
 *
 * Lo que llega por `/proponer` cae acá y no al sitio: el estado inicial es
 * `nueva`, así que el peor caso de un formulario público es una bandeja con
 * basura y no un sitio con basura (§9 del PRD). Esta pantalla es donde eso se
 * mira, y **el riesgo que el PRD acepta sin mitigar es que nadie la mire**: por
 * eso el badge de pendientes en la cabecera y por eso `propuestas-abrir` se mide.
 *
 * ── Las tres decisiones que le dan la forma ───────────────────────────────
 *
 * 1. **No se puede editar el contenido de una propuesta, y esta pantalla no lo
 *    ofrece.** Es prueba de qué se pidió: si hay que corregir el título, se
 *    corrige en la actividad que sale de ella (§4.3 del PRD). La regla lo hace
 *    cumplir; acá directamente no hay dónde escribir.
 * 2. **Convertir es prellenar, no importar** (§6 del PRD): la conversión es pura
 *    (`propuestaAFormulario`), el admin cae en el formulario de siempre en modo
 *    borrador y publica por el camino de siempre. Cero código de publicación
 *    nuevo.
 * 3. **Y no hay carga a mano.** La regla la permite (`origen: 'panel'`, para lo
 *    que llega por DM) y el PRD la describe, pero **entra recién con la retención
 *    de 30 días** (B-838, DEC-13) — decisión del dueño el 2026-09-09. Cargar acá
 *    el WhatsApp de un tercero antes de que exista lo que lo borra es guardar un
 *    dato personal sin fecha de vencimiento.
 *
 * ── Y una que es del chasis, no de esta pantalla ──────────────────────────
 * **El orden de las dos escrituras al aceptar es D-600**: primero se crea la
 * actividad, después se mueve la propuesta a `aceptada` con su `actividadId`. Por
 * eso «Convertir» no escribe nada: arma el formulario y le pasa a `AdminApp` el
 * `alGuardar` que hace el segundo movimiento cuando —y solo si— el primero salió.
 */
export interface Conversion {
  /** El formulario prellenado, listo para `ActividadFormulario`. */
  copia: ActividadForm;
  /** El título de la propuesta, para el aviso de arriba del formulario. */
  tituloOrigen: string;
  /** Lo que no se pudo prellenar y hay que completar a mano. */
  avisos: readonly string[];
  /**
   * El segundo movimiento de D-600, que corre **después** de que la actividad se
   * guardó. Devuelve la promesa para que el chasis pueda avisar si falla: una
   * propuesta que quedó en `nueva` con su actividad ya creada se convierte dos
   * veces si nadie lo dice.
   */
  alGuardar: (actividadId: string) => Promise<void>;
}

interface Props {
  usuario: { uid: string };
  onConvertir: (conversion: Conversion) => void;
}

const ESTILO_ESTADO: Record<EstadoPropuesta, string> = {
  nueva: 'bg-amber-100 text-amber-800',
  'en-revision': 'bg-amber-100 text-amber-800',
  aceptada: 'bg-emerald-100 text-emerald-800',
  rechazada: 'bg-tinta/10 text-tinta/60',
};

const TEXTO_ESTADO: Record<EstadoPropuesta, string> = {
  nueva: 'sin mirar',
  'en-revision': 'la estoy mirando',
  aceptada: 'aceptada',
  rechazada: 'rechazada',
};

const TEXTO_VIA = { mail: 'Mail', whatsapp: 'WhatsApp', instagram: 'Instagram' } as const;

const cuando = (p: PropuestaConId): string => {
  // `creadoEn` es `serverTimestamp()`: en el primer snapshot local todavía llega
  // en null y hay que tolerarlo (mismo caso que en `/reportes`).
  if (!p.creadoEn?.toDate) return 'ahora';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(p.creadoEn.toDate());
};

/**
 * La etiqueta de un slug, o **el slug crudo** si no está en la taxonomía.
 *
 * Que el respaldo sea el slug pelado y no un `desSlug` bonito es a propósito:
 * acá el slug desconocido es información —es lo que la conversión va a mandar a
 * «Otro» en vez de prellenar— y disimularlo lo haría parecer una opción más.
 */
const etiqueta = (valores: readonly ValorOpcion[], slug: string): string =>
  valores.find((v) => v.slug === slug)?.label ?? slug;

export function PropuestasPanel({ usuario, onConvertir }: Props) {
  const [propuestas, setPropuestas] = useState<PropuestaConId[]>([]);
  const [fallo, setFallo] = useState<string | null>(null);
  /** Id de la que se está moviendo de estado, para no tocar el botón dos veces. */
  const [moviendo, setMoviendo] = useState<string | null>(null);
  /** Id de la que se está rechazando: mientras tanto se pide el motivo. */
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  /** Apagado por defecto: la bandeja arranca mostrando lo que espera decisión. */
  const [verCerradas, setVerCerradas] = useState(false);

  // Las dos taxonomías que la ficha muestra. Van por `useOpciones` y no por una
  // lectura propia: B-127 comparte el `onSnapshot` con el resto del panel.
  const incluyeConocido = useOpciones('incluye-actividad');
  const aranceles = useOpciones('arancel');

  /**
   * `propuestas-abrir` con cuántas pendientes había: es el termómetro del riesgo
   * que el §9 del PRD acepta sin mitigación —«si nadie la mira, las propuestas
   * mueren ahí y es peor que el mail»—. Un entero y nada más: no sale ni un
   * título ni un contacto (§9 de la analítica).
   *
   * Va **adentro del primer snapshot** y no en un efecto aparte, y no es un
   * detalle: un efecto de montaje mide antes de que Firestore conteste y
   * reportaría cero siempre. El `ref` es lo que lo deja en **una vez por
   * apertura** en lugar de una por snapshot. Consecuencia asumida: si la lectura
   * nunca contesta, la apertura no se cuenta — que es lo correcto, porque
   * tampoco se vio nada.
   */
  const medido = useRef(false);

  useEffect(
    () =>
      observarPropuestas(
        (ps) => {
          setPropuestas(ps);
          if (!medido.current) {
            medido.current = true;
            medirFuncion('propuestas-abrir', undefined, ps.filter(esPendiente).length);
          }
        },
        (e) => setFallo(e.message),
      ),
    [],
  );

  const visibles = useMemo(
    () => (verCerradas ? propuestas : propuestas.filter(esPendiente)),
    [propuestas, verCerradas],
  );

  /** Devuelve si la escritura salió. Lo usa `rechazar` para no medir un fallo. */
  const mover = async (
    p: PropuestaConId,
    estado: EstadoPropuesta,
    extras = {},
  ): Promise<boolean> => {
    setMoviendo(p.id);
    try {
      await revisarPropuesta(p.id, usuario.uid, estado, extras);
      setFallo(null);
      return true;
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudo actualizar la propuesta');
      return false;
    } finally {
      setMoviendo(null);
    }
  };

  /**
   * D-600, primer movimiento: se arma el formulario y **no se escribe nada**. La
   * propuesta se marca aceptada recién cuando la actividad existe, y eso lo
   * dispara el chasis con `alGuardar`.
   */
  const convertir = (p: PropuestaConId) => {
    const { form, avisos } = propuestaAFormulario(
      p,
      incluyeConocido.valores.map((v) => v.slug),
    );
    onConvertir({
      copia: form,
      tituloOrigen: p.titulo,
      avisos,
      alGuardar: async (actividadId) => {
        /*
         * Se mide acá arriba **y no después del `await`**, y no es un descuido:
         * el chasis llama a `alGuardar` cuando la actividad **ya está guardada**,
         * así que en esta línea la conversión ya ocurrió. Lo que puede fallar
         * abajo es marcar la propuesta —la segunda mitad de D-600—, y eso no
         * deshace la actividad ni cambia la respuesta a la pregunta que este
         * evento contesta: de las que llegaron, cuántas terminaron en el
         * catálogo. Lo señaló el `auditor-trampas`, con razón para el otro
         * evento: ver `rechazar`.
         */
        medirFuncion('propuesta-convertida');
        await revisarPropuesta(p.id, usuario.uid, 'aceptada', { actividadId });
      },
    });
  };

  const rechazar = async (p: PropuestaConId) => {
    // El motivo es interno y no sale nunca; vacío se guarda como `null`, que es
    // la única forma que la regla acepta para «no hay motivo».
    const salio = await mover(p, 'rechazada', { motivo: motivo.trim() || null });
    /*
     * **Después del `await` y solo si salió** — lo encontró el `auditor-trampas`.
     * Medir antes contaba como rechazo lo que `mover` acababa de tragarse: esa
     * función atrapa el error y lo muestra en pantalla, así que una racha de
     * fallos de red dejaba el evento contando rechazos que no ocurrieron, con
     * toda la suite en verde. Y este evento es la mitad de lo que decide si
     * `/proponer` vale la pena (§9 del PRD): una métrica de decisión que miente
     * despacio es peor que no tenerla.
     */
    if (salio) medirFuncion('propuesta-rechazada');
    setRechazando(null);
    setMotivo('');
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-base font-semibold">Lo que propusieron</h2>
        <label className="flex items-center gap-1.5 text-xs text-tinta/70">
          <input
            type="checkbox"
            checked={verCerradas}
            onChange={(e) => setVerCerradas(e.target.checked)}
          />
          Ver aceptadas y rechazadas
        </label>
      </div>
      <p className="text-xs text-tinta/55">
        Nada de esto está en el sitio: una propuesta no se publica, se convierte en actividad y
        la actividad se publica como cualquier otra. El contacto de quien propuso es para
        repreguntar y no sale a ninguna parte. Rechazar tampoco borra nada por ahora: la
        propuesta queda marcada y se puede reabrir.
      </p>

      {fallo && (
        <p className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento">
          {fallo}
        </p>
      )}

      {visibles.length === 0 && !fallo && (
        <p className="rounded-md border border-dashed border-borde px-3 py-8 text-center text-sm text-tinta/50">
          {propuestas.length === 0
            ? 'Todavía no llegó ninguna propuesta.'
            : 'No hay propuestas esperando. Activá «Ver aceptadas y rechazadas» para ver las cerradas.'}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {visibles.map((p) => {
          const contacto = enlaceDeContacto(p.contacto);
          const afiche = enlaceDeImagen(p.imagen);
          return (
            <li
              key={p.id}
              className={`rounded-md border border-borde bg-white px-3 py-2.5 ${
                esPendiente(p) ? '' : 'opacity-60'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-serif font-semibold">{p.titulo}</h3>
                  <p className="text-xs text-tinta/55">
                    {p.organizador.nombre}
                    {p.organizador.instagram ? ` (${p.organizador.instagram})` : ''} · {cuando(p)}
                    {p.origen === 'panel' ? ' · cargada a mano' : ''}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${ESTILO_ESTADO[p.estado]}`}>
                  {TEXTO_ESTADO[p.estado]}
                </span>
              </div>

              {/*
                El contacto arriba y destacado: es lo que hace que la bandeja
                sirva —sin forma de repreguntar, la mitad de las propuestas
                quedan a medias (§7 del PRD)—. Y es el único dato personal de un
                tercero que el proyecto guarda, así que la pantalla lo dice.
              */}
              <p className="mt-2 text-sm">
                <span className="text-tinta/55">{TEXTO_VIA[p.contacto.via]}: </span>
                {contacto ? (
                  <a href={contacto} target="_blank" rel="noreferrer" className="text-acento underline">
                    {p.contacto.valor}
                  </a>
                ) : (
                  <span>{p.contacto.valor}</span>
                )}
              </p>

              <p className="mt-2 whitespace-pre-line text-sm text-tinta/80">{p.descripcion}</p>

              <ul className="mt-2 flex flex-col gap-0.5 text-xs text-tinta/70">
                {p.fechas.map((f, i) => (
                  // El índice como `key` y no un id: una fecha propuesta no tiene
                  // id y no debe tenerlo (los `ses_<uuid>` se generan al
                  // convertir, trampa 2). La lista es de solo lectura y no se
                  // reordena, que es cuando el índice hace daño.
                  <li key={`${f.dia}-${f.desde}-${i}`}>{fraseDeFechaPropuesta(f)}</li>
                ))}
              </ul>

              <p className="mt-2 text-xs text-tinta/70">
                {p.modalidad === 'las-dos' ? 'presencial y virtual' : p.modalidad}
                {p.lugar
                  ? ` · ${[p.lugar.nombre, p.lugar.direccion, p.lugar.barrio]
                      .filter(Boolean)
                      .join(', ')}`
                  : ''}
                {' · '}
                {etiqueta(aranceles.valores, p.arancel.tipo)}
                {p.arancel.notas ? ` (${p.arancel.notas})` : ''}
                {p.inscripcion.requiere
                  ? ` · pide inscripción${
                      p.inscripcion.comoDice ? `: «${p.inscripcion.comoDice}»` : ''
                    }`
                  : ''}
              </p>

              {(p.incluye.length > 0 || p.incluyeOtro) && (
                <p className="mt-1 text-xs text-tinta/70">
                  Se llevan: {p.incluye.map((s) => etiqueta(incluyeConocido.valores, s)).join(', ')}
                  {p.incluyeOtro ? `${p.incluye.length > 0 ? ', ' : ''}«${p.incluyeOtro}»` : ''}
                </p>
              )}

              {/*
                La imagen se muestra como dato y todavía no se ve: el prefijo
                `propuestas/` de Storage —con `get` y `list` en false, trampa 13—
                y la promoción a `imagenes/` al aceptar son el paso 8 (DEC-11).
                Decir el path es más honesto que no decir nada: un flyer que
                llegó y nadie ve es justo lo que hay que poder detectar.
              */}
              {p.imagen && (
                <p className="mt-1 text-xs text-tinta/55">
                  {'url' in p.imagen ? (
                    /*
                     * Por `enlaceDeImagen` y no con la URL cruda: es el otro
                     * `href` de texto ajeno de esta pantalla, y el único string
                     * de una propuesta que no pasa por ningún validador de forma.
                     * Si no se puede abrir sin riesgo, se muestra como texto —lo
                     * mismo que hace el contacto tres bloques más arriba.
                     */
                    afiche ? (
                      <a href={afiche} target="_blank" rel="noreferrer" className="underline">
                        Imagen que pegaron ↗
                      </a>
                    ) : (
                      `Pegaron una imagen y el link no se puede abrir: ${p.imagen.url}`
                    )
                  ) : (
                    `Subieron una imagen: ${p.imagen.storagePath}`
                  )}
                </p>
              )}

              {p.revision.motivo && (
                <p className="mt-2 text-xs text-tinta/55">Motivo del rechazo: {p.revision.motivo}</p>
              )}

              {rechazando === p.id ? (
                <div className="mt-3 flex flex-col gap-2">
                  <label className="text-xs text-tinta/70" htmlFor={`motivo-${p.id}`}>
                    Por qué se rechaza (opcional, no lo ve quien la mandó)
                  </label>
                  <textarea
                    id={`motivo-${p.id}`}
                    className={claseInput}
                    rows={2}
                    maxLength={TOPE_MOTIVO_PROPUESTA}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void rechazar(p)}
                      disabled={moviendo === p.id}
                      className={`${claseBotonSecundario} disabled:opacity-50`}
                    >
                      {moviendo === p.id ? 'Guardando…' : 'Confirmar el rechazo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRechazando(null);
                        setMotivo('');
                      }}
                      className={claseBotonSecundario}
                    >
                      Mejor no
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.estado !== 'aceptada' && (
                    <button
                      type="button"
                      onClick={() => convertir(p)}
                      className={claseBotonPrimario}
                    >
                      Convertir en actividad
                    </button>
                  )}
                  {p.estado === 'nueva' && (
                    <button
                      type="button"
                      onClick={() => void mover(p, 'en-revision')}
                      disabled={moviendo === p.id}
                      className={`${claseBotonSecundario} disabled:opacity-50`}
                    >
                      {moviendo === p.id ? 'Guardando…' : 'La estoy mirando'}
                    </button>
                  )}
                  {esPendiente(p) && (
                    <button
                      type="button"
                      onClick={() => {
                        setRechazando(p.id);
                        setMotivo('');
                      }}
                      className={claseBotonSecundario}
                    >
                      Rechazar
                    </button>
                  )}
                  {p.estado === 'rechazada' && (
                    /*
                     * Un rechazo se puede deshacer, y hoy sin plazo: la retención
                     * de 30 días (DEC-13, B-838) es el paso 11 y todavía no
                     * existe. **El texto de arriba no la promete por eso** — la
                     * ayuda del panel no puede afirmar algo que todavía no borra
                     * nada, que es la clase de mentira que B-780 costó como P0.
                     */
                    <button
                      type="button"
                      onClick={() => void mover(p, 'nueva')}
                      disabled={moviendo === p.id}
                      className={`${claseBotonSecundario} disabled:opacity-50`}
                    >
                      {moviendo === p.id ? 'Guardando…' : 'Reabrir'}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
