import { useEffect, useMemo, useRef, useState } from 'react';
import { textoDeFallo } from '@/lib/fallosDelPanel';
import {
  claseBotonPrimario,
  claseBotonSecundario,
  claseFilaApagada,
  claseInput,
} from '@/components/campos/Campo';
import { useOpciones } from '@/components/admin/useOpciones';
// M-17 — el flyer y la conversión, cada uno en su archivo. La bandeja se queda
// con la lista, los movimientos de estado y el paso de decidir la foto.
import { FlyerDeLaPropuesta } from '@/components/admin/propuestas/FlyerDeLaPropuesta';
import {
  useConversionDePropuesta,
  type Conversion,
} from '@/components/admin/propuestas/useConversionDePropuesta';
import { medirFuncion } from '@/lib/analytics';
import {
  RETENCION_DIAS,
  avisoDeCaducidad,
  enlaceDeContacto,
  enlaceDeImagen,
  esPendiente,
  estadoAlVolverASinMirar,
  fraseDeFechaPropuesta,
  observarPropuestas,
  revisarPropuesta,
} from '@/lib/bandejaDePropuestas';
import type { ValorOpcion } from '@/types/actividad';
import type { EstadoPropuesta, PropuestaConId } from '@/types/propuesta';
import { TOPE_MOTIVO_PROPUESTA } from '@/types/propuesta';

export type { Conversion };

interface Props {
  usuario: { uid: string };
  onConvertir: (conversion: Conversion) => void;
}

const ESTILO_ESTADO: Record<EstadoPropuesta, string> = {
  nueva: 'bg-amber-100 text-amber-800',
  'en-revision': 'bg-amber-100 text-amber-800',
  aceptada: 'bg-emerald-100 text-emerald-800',
  rechazada: 'bg-tinta/10 text-tinta/65',
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
 * eso «Convertir» no escribe **la actividad**: arma el formulario y le pasa a
 * `AdminApp` el `alGuardar` que hace el segundo movimiento cuando —y solo si— el
 * primero salió.
 *
 * **Lo que sí escribe al abrir, desde B-866, es la marca `en-revision`** sobre
 * una `nueva` —lo que está pasando—, para que el plazo de retención se renueve y
 * el barrido no se la lleve con el formulario abierto. No choca con el riesgo que
 * D-600 argumenta: `en-revision` es reversible y no dice que se aceptó nada.
 */
export function PropuestasPanel({ usuario, onConvertir }: Props) {
  const [propuestas, setPropuestas] = useState<PropuestaConId[]>([]);
  const [fallo, setFallo] = useState<string | null>(null);
  /** Id de la que se está moviendo de estado, para no tocar el botón dos veces. */
  const [moviendo, setMoviendo] = useState<string | null>(null);
  /*
   * **B-1490 — el mismo corte que B-1461, para los movimientos de la ficha.** El
   * `disabled={moviendo === p.id}` llega recién cuando React pinta, y dos clics en
   * el mismo tick pasaban los dos: «Volver a sin mirar» escribía `nueva`, el
   * segundo intentaba `nueva → nueva`, la regla lo rechazaba —bien— y la bandeja
   * mostraba un fallo falso sobre un movimiento que sí había salido. Lo mismo con
   * «La estoy mirando» y «Reabrir». El ref corta el segundo antes de escribir.
   */
  const moviendoAhora = useRef<string | null>(null);
  /** Id de la que se está rechazando: mientras tanto se pide el motivo. */
  /**
   * **La propuesta cuyo flyer está esperando decisión** — B-926.
   *
   * Solo se abre para las que **traen una foto subida**: sin foto no hay nada
   * que decidir y «Convertir en actividad» sigue yendo derecho, que es lo que
   * hace que el paso no se convierta en un click de más para el caso común.
   */
  const [decidiendoFoto, setDecidiendoFoto] = useState<string | null>(null);
  /**
   * **Qué propuestas mostraron su foto de verdad** — B-926, del pase de
   * auditoría.
   *
   * El argumento para saltear la verificación de B-863 es que «una persona
   * **miró** la foto». Cuando la miniatura no se pudo traer —el chunk no llegó,
   * o el objeto ya no está— esa persona no miró nada, y el aviso que le dice
   * «bajala antes con el botón de arriba» manda a un botón que **tampoco está**:
   * cuelga del mismo componente, después del `return` del fallo.
   *
   * Sin esto, el paso autorizaba un borrado irreversible de una foto que no se
   * pudo ver, con una instrucción que no se podía seguir.
   */
  const [fotoVisible, setFotoVisible] = useState<Record<string, boolean>>({});
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  /** Apagado por defecto: la bandeja arranca mostrando lo que espera decisión. */
  const [verCerradas, setVerCerradas] = useState(false);

  // Las dos taxonomías que la ficha muestra. Van por `useOpciones` y no por una
  // lectura propia: B-127 comparte el `onSnapshot` con el resto del panel.
  const incluyeConocido = useOpciones('incluye-actividad');
  const aranceles = useOpciones('arancel');
  const { convertir, promoviendo, marcando } = useConversionDePropuesta({
    usuario,
    onConvertir,
    incluyeConocido,
  });


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
    // El segundo clic no escribe ni avisa nada: el primero sigue en vuelo y es
    // el que va a decir si salió.
    if (moviendoAhora.current === p.id) return false;
    moviendoAhora.current = p.id;
    setMoviendo(p.id);
    try {
      await revisarPropuesta(p.id, usuario.uid, estado, extras);
      setFallo(null);
      return true;
    } catch (e: unknown) {
      setFallo(textoDeFallo(e, { respaldo: 'No se pudo actualizar la propuesta' }));
      return false;
    } finally {
      moviendoAhora.current = null;
      setMoviendo(null);
    }
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
      <p className="text-xs text-tinta/65">
        Nada de esto está en el sitio: una propuesta no se publica, se convierte en actividad y
        la actividad se publica como cualquier otra. El contacto de quien propuso es para
        repreguntar y no sale a ninguna parte. Rechazar borra la imagen <strong>en el acto</strong>
        y el resto a los {RETENCION_DIAS.rechazada} días: hasta entonces se puede reabrir, pero la
        foto ya no vuelve. Aceptar también se lleva la foto original, pero recién{' '}
        <strong>al guardar la actividad</strong>: ahí ya hay una copia en su galería que la
        reemplaza. Y una que queda sin tocar se borra sola{' '}
        {RETENCION_DIAS.nueva === RETENCION_DIAS.rechazada
          ? 'en el mismo plazo'
          : `a los ${RETENCION_DIAS.nueva} días`}
        , contado desde la última vez que alguien la movió: la ficha avisa cuando falta poco.
      </p>

      {fallo && (
        <p className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento">
          {fallo}
        </p>
      )}

      {visibles.length === 0 && !fallo && (
        <p className="rounded-md border border-dashed border-borde px-3 py-8 text-center text-sm text-tinta/65">
          {propuestas.length === 0
            ? 'Todavía no llegó ninguna propuesta.'
            : 'No hay propuestas esperando. Activá «Ver aceptadas y rechazadas» para ver las cerradas.'}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {visibles.map((p) => {
          const contacto = enlaceDeContacto(p.contacto);
          const afiche = enlaceDeImagen(p.imagen);
          /*
           * **Cuándo se va, y solo cuando falta poco** — B-844.
           *
           * El barrido borra sin que nadie apriete nada, así que sin este aviso
           * hay documentos que desaparecen de la bandeja y nadie los ve irse.
           * La ventana (`AVISO_DE_CADUCIDAD_DIAS`) es lo que lo mantiene siendo
           * un aviso y no un cartel en cada ficha: **el precedente es D-273**,
           * donde un aviso que señalaba 65 de 68 no era trabajo pendiente sino
           * el catálogo con otro nombre. La ventana es un cuarto del plazo, así
           * que en una bandeja que se atiende no se prende nunca: mover una
           * propuesta de estado reinicia su reloj.
           */
          const caduca = avisoDeCaducidad(p);
          return (
            <li
              key={p.id}
              className={`rounded-md border border-borde px-3 py-2.5 ${
                esPendiente(p) ? 'bg-white' : claseFilaApagada
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-serif font-semibold">{p.titulo}</h3>
                  <p className="text-xs text-tinta/65">
                    {p.organizador.nombre}
                    {p.organizador.instagram ? ` (${p.organizador.instagram})` : ''} · {cuando(p)}
                    {p.origen === 'panel' ? ' · cargada a mano' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${ESTILO_ESTADO[p.estado]}`}>
                    {TEXTO_ESTADO[p.estado]}
                  </span>
                  {caduca && (
                    <span className="rounded-full bg-acento/10 px-2 py-0.5 text-xs text-acento">
                      {caduca}
                    </span>
                  )}
                </div>
              </div>

              {/*
                El contacto arriba y destacado: es lo que hace que la bandeja
                sirva —sin forma de repreguntar, la mitad de las propuestas
                quedan a medias (§7 del PRD)—. Y es el único dato personal de un
                tercero que el proyecto guarda, así que la pantalla lo dice.
              */}
              <p className="mt-2 text-sm">
                <span className="text-tinta/65">{TEXTO_VIA[p.contacto.via]}: </span>
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
              {p.imagen && 'storagePath' in p.imagen && p.estado !== 'rechazada' && (
                <div className="mt-2">
                  <FlyerDeLaPropuesta
                    storagePath={p.imagen.storagePath}
                    onEstado={(sePudoVer) =>
                      setFotoVisible((prev) =>
                        prev[p.id] === sePudoVer ? prev : { ...prev, [p.id]: sePudoVer },
                      )
                    }
                  />
                </div>
              )}

              {p.imagen && (
                <p className="mt-1 text-xs text-tinta/65">
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
                  ) : p.estado === 'rechazada' ? (
                    // Se borró al rechazar (DEC-11) y el documento sigue
                    // nombrándola: decirlo es lo que evita que alguien la busque.
                    'La imagen que subieron se borró al rechazar la propuesta.'
                  ) : (
                    // La foto se ve arriba; acá queda el path, que es lo que hay
                    // que poder leer cuando algo no cuadra.
                    `Subieron esa imagen: ${p.imagen.storagePath}`
                  )}
                </p>
              )}

              {p.revision.motivo && (
                <p className="mt-2 text-xs text-tinta/65">Motivo del rechazo: {p.revision.motivo}</p>
              )}

              {decidiendoFoto === p.id ? (
                /*
                 * **El paso que B-926 vino a agregar.**
                 *
                 * El ítem lo dice mejor que cualquier resumen: «el único momento
                 * en que esa foto existe y alguien la está mirando es esta
                 * pantalla, y ahí no hay ni un botón». Al aceptar, el original se
                 * borra (B-863); al rechazar, también.
                 *
                 * Las cuatro opciones del ítem son estas dos más las dos que ya
                 * viven en otro lado: **bajar** está arriba, al lado de la
                 * miniatura (se puede usar antes de elegir, que es el orden en el
                 * que sirve), y **subir otra** la resuelve el `GaleriaEditor` del
                 * formulario, que se abre a continuación.
                 */
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-xs text-tinta/70">
                    ¿La actividad se queda con la foto que mandaron?
                  </p>
                  {/*
                    **El aviso va arriba de los botones y dice qué se pierde.**
                    Es la misma frase que ya está escrita para el rechazo, y acá
                    hace más falta: descartar **borra el original** y no se puede
                    deshacer. Si alguien la quiere guardar, el botón de bajarla
                    está arriba — por eso este texto lo nombra en vez de suponer
                    que se vio.
                  */}
                  {fotoVisible[p.id] ? (
                    <p className="text-xs text-tinta/65">
                      Si no la usás se borra y no se puede recuperar. Si la querés guardar, bajala
                      antes con el botón de arriba.
                    </p>
                  ) : (
                    /*
                     * **La foto no se pudo mostrar, así que el aviso cambia** —
                     * y no es un matiz de redacción: el de arriba manda a un
                     * botón que en este estado no existe, y sobre todo da por
                     * sentado que alguien vio lo que va a borrar. Acá se dice lo
                     * contrario con todas las letras, porque es la única forma
                     * de que quien decide sepa qué está decidiendo.
                     */
                    <p role="alert" className="text-xs text-acento">
                      No pudimos mostrarte la foto, así que tampoco podés bajarla ni descartarla
                      desde acá: descartar la borra para siempre y nadie la vio. Podés usarla
                      igual, o recargar la página para volver a intentarlo.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDecidiendoFoto(null);
                        void convertir(p);
                      }}
                      disabled={promoviendo === p.id}
                      className={`${claseBotonPrimario} disabled:opacity-50`}
                    >
                      {promoviendo === p.id ? 'Trayendo la imagen…' : 'Sí, usarla'}
                    </button>
                    {/*
                      ⚠️ **«No usarla» solo existe si la foto se pudo mostrar** —
                      B-926, del pase de auditoría, y no es una precaución de UI:
                      **es el argumento del ítem sosteniéndose o cayéndose.**

                      Saltear la verificación de B-863 se apoya en que «la
                      pregunta ya la contestó una persona **mirando** la foto».
                      Con la miniatura sin cargar, lo que hay es una persona que
                      clickeó, y eso no alcanza para autorizar un borrado
                      irreversible. Por eso el botón no se deshabilita: **no se
                      dibuja**. Un botón gris invita a buscar cómo habilitarlo;
                      su ausencia, más el aviso de al lado, manda a recargar, que
                      es lo que hay que hacer.

                      «Sí, usarla» sí se ofrece: no destruye nada, y si la
                      promoción falla el flag no viaja y el original se conserva.
                    */}
                    {fotoVisible[p.id] === true && (
                      <button
                        type="button"
                        onClick={() => {
                          setDecidiendoFoto(null);
                          void convertir(p, false);
                        }}
                        disabled={promoviendo === p.id}
                        className={`${claseBotonSecundario} disabled:opacity-50`}
                      >
                        No usarla
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDecidiendoFoto(null)}
                      className={claseBotonSecundario}
                    >
                      Mejor no
                    </button>
                  </div>
                </div>
              ) : rechazando === p.id ? (
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
                      onClick={() => {
                        /*
                         * **Con foto se pregunta; sin foto se convierte derecho.**
                         * El paso existe para decidir sobre la imagen, así que
                         * ponerlo delante de una propuesta que no trajo ninguna
                         * sería un click de más en el caso más común — y de los
                         * que se aprenden a apretar sin leer, que es justo lo que
                         * no puede pasar con un aviso que dice «se borra».
                         */
                        /*
                         * **Y una rechazada tampoco pregunta**, aunque su
                         * documento siga trayendo el `storagePath`: al rechazar,
                         * el objeto se borró en el acto, así que no hay foto
                         * sobre la cual decidir. Sin esta condición el paso se
                         * abría igual, con el flyer sin montar —o sea sin poder
                         * verse—, el descarte escondido por eso, y un aviso que
                         * ofrece «recargar la página para volver a intentarlo»:
                         * un consejo que en este estado no va a funcionar nunca.
                         * Lo cobró el `auditor-privacidad`.
                         */
                        if (p.imagen && 'storagePath' in p.imagen && p.estado !== 'rechazada') {
                          setDecidiendoFoto(p.id);
                        } else void convertir(p);
                      }}
                      disabled={promoviendo === p.id || marcando === p.id}
                      className={`${claseBotonPrimario} disabled:opacity-50`}
                    >
                      {promoviendo === p.id
                        ? 'Trayendo la imagen…'
                        : 'Convertir en actividad'}
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
                  {estadoAlVolverASinMirar(p.estado) !== null && (
                    /*
                     * **B-1490 — el deshacer de «La estoy mirando».** Hasta acá
                     * la `en-revision` tenía un solo movimiento, «Rechazar», que
                     * decide algo y borra la foto. Éste no decide nada ni toca la
                     * foto; como todo movimiento firma `revision.en`, así que es
                     * también la forma de renovarle el plazo a una que se está
                     * por ir (lo que ofrece el aviso de B-1460).
                     */
                    <button
                      type="button"
                      onClick={() => void mover(p, estadoAlVolverASinMirar(p.estado)!)}
                      disabled={moviendo === p.id}
                      className={`${claseBotonSecundario} disabled:opacity-50`}
                    >
                      {moviendo === p.id ? 'Guardando…' : 'Volver a sin mirar'}
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
                     * Un rechazo se puede deshacer **mientras la retención no la
                     * borre**: a los 30 días la propuesta rechazada desaparece con
                     * su imagen (DEC-13, B-838, `functions/retencion.js`), así que
                     * un rechazo por error tiene ese plazo para arreglarse.
                     *
                     * El texto de arriba no lo prometía hasta este commit, y la
                     * palabra exacta importa —lo marcaron los dos auditores—: lo
                     * que habilita la promesa no es que la Function **exista**
                     * sino que **corra**. Sale en el mismo push (CI la despliega
                     * al ver el cambio en `functions/`, después de `hosting`), y
                     * la promesa recién podría ser falsa treinta días después de
                     * la primera rechazada. La ventana está dicha en
                     * `07-seguridad.md`; prometer un borrado que no ocurre es la
                     * clase de mentira que B-780 costó como P0.
                     */
                    <button
                      type="button"
                      onClick={() => void mover(p, 'nueva')}
                      disabled={moviendo === p.id}
                      className={`${claseBotonSecundario} disabled:opacity-50`}
                    >
                      {moviendo === p.id ? 'Guardando…' : 'Reabrir (sin la imagen)'}
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
