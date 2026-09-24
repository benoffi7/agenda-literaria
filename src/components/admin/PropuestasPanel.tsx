import { useEffect, useMemo, useRef, useState } from 'react';
import { textoDeFallo } from '@/lib/fallosDelPanel';
import { claseBotonPrimario, claseBotonSecundario, claseInput } from '@/components/campos/Campo';
import { useOpciones } from '@/components/admin/useOpciones';
import { esFalloDeCarga } from '@/lib/carga-diferida';
import { medirFuncion } from '@/lib/analytics';
import {
  RETENCION_DIAS,
  avisoDeCaducidad,
  avisoDeMarcaFallida,
  enlaceDeContacto,
  enlaceDeImagen,
  esPendiente,
  estadoAlConvertir,
  fraseDeFechaPropuesta,
  observarPropuestas,
  revisarPropuesta,
} from '@/lib/bandejaDePropuestas';
import { avisoDeImagenNoPromovida, propuestaAFormulario } from '@/lib/propuestas';
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
 * eso «Convertir» no escribe **la actividad**: arma el formulario y le pasa a
 * `AdminApp` el `alGuardar` que hace el segundo movimiento cuando —y solo si— el
 * primero salió.
 *
 * **Lo que sí escribe al abrir, desde B-866, es la marca `en-revision`** sobre
 * una `nueva` —lo que está pasando—, para que el plazo de retención se renueve y
 * el barrido no se la lleve con el formulario abierto. No choca con el riesgo que
 * D-600 argumenta: `en-revision` es reversible y no dice que se aceptó nada.
 */
export interface Conversion {
  /** El formulario prellenado, listo para `ActividadFormulario`. */
  copia: ActividadForm;
  /** El título de la propuesta, para el aviso de arriba del formulario. */
  tituloOrigen: string;
  /** Lo que no se pudo prellenar y hay que completar a mano. */
  avisos: readonly string[];
  /**
   * B-1235 — **la foto que pidieron usar no entró**, con la causa y qué hacer.
   * `null` cuando no había foto, cuando se decidió no usarla o cuando entró.
   *
   * Va aparte de `avisos` y no como una línea más de esa lista, que es donde
   * estaba y es el bug: entre «el canal de inscripción no viaja» y «revisá el
   * slug», la frase que decía que la foto no se trajo se leía como un detalle, y
   * la persona se iba con la idea de que había apretado «Sí, usarla» y el panel
   * la había ignorado. El formulario la pinta como alerta, arriba de todo.
   */
  imagenNoPromovida: string | null;
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
 * **El flyer que mandaron, mirable desde la bandeja** — B-830 paso 8, DEC-11.
 *
 * La URL se pide al montar y no viene en el documento: el objeto vive en
 * `propuestas/`, que `storage.rules` deja leer **solo a un admin** (decisión del
 * dueño del 2026-09-09, desviándose del «`get` en `false`» del PRD, porque sin
 * ver la foto no se puede decidir).
 *
 * El `import()` es el de siempre: `subir-imagen` es el único dueño de
 * `firebase/storage` y traerlo al árbol estático deshace el corte del bundle
 * (B-09/D-51).
 *
 * Los dos fallos esperables se muestran como texto y no como imagen rota: sin
 * sesión (que no debería pasar acá) y **objeto que ya no está**, que es
 * exactamente lo que le pasa a una propuesta rechazada.
 */
function FlyerDeLaPropuesta({
  storagePath,
  onEstado,
}: {
  storagePath: string;
  /**
   * **Si la foto se pudo mostrar o no** — B-926, hallazgo del pase de auditoría.
   *
   * Lo necesita el paso de decisión, y el motivo es el argumento entero del
   * ítem: saltear la verificación de B-863 se justifica porque «la pregunta ya
   * la contestó una persona **mirando** la foto». Si la foto no se pudo mostrar,
   * esa frase deja de ser cierta y lo que queda es una persona que clickeó — que
   * no es lo mismo, y es la diferencia sobre la que descansa un borrado
   * irreversible.
   */
  onEstado: (sePudoVer: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState<'chunk' | 'objeto' | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const { urlDeImagenDePropuesta } = await import('@/lib/subir-imagen');
        const u = await urlDeImagenDePropuesta(storagePath);
        /*
         * **No se avisa acá que la foto se vio, y es el punto entero** — B-926.
         * Que `getDownloadURL` haya resuelto dice que hay una URL, no que el
         * navegador haya pintado algo: un `<img>` que 404ea después (objeto
         * borrado en la carrera, red caída, bloqueador de contenido) dejaría al
         * admin mirando el ícono roto con «No usarla» disponible. La señal sale
         * del `onLoad`/`onError` del propio `<img>`, más abajo.
         */
        if (vivo) setUrl(u);
      } catch (e) {
        /*
         * Las dos causas se distinguen porque se arreglan distinto: si el chunk
         * no llegó (pestaña vieja después de un deploy), recargar alcanza; si
         * Storage dijo que no, la imagen ya no está. Es la misma puerta que
         * `GaleriaEditor` y la que `tests/carga-diferida.test.ts` vigila para
         * todo `await import()` del panel.
         */
        if (vivo) {
          setFallo(esFalloDeCarga(e) ? 'chunk' : 'objeto');
          onEstado(false);
        }
      }
    })();
    return () => {
      vivo = false;
    };
    // `onEstado` queda fuera de las dependencias a propósito: viene de un
    // `useState` del padre y es estable, y meterla haría reejecutar el fetch en
    // cada render del padre — una lectura de Storage por cada tecla del motivo
    // de rechazo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storagePath]);

  if (fallo === 'chunk') {
    return (
      <span className="text-tinta/55">
        No se pudo cargar esa parte del panel. Recargá la página para ver la imagen.
      </span>
    );
  }
  if (fallo === 'objeto') {
    return (
      <span className="text-tinta/55">
        La imagen que subieron ya no está (se borra al rechazar la propuesta).
      </span>
    );
  }
  if (!url) return <span className="text-tinta/55">Trayendo la imagen…</span>;

  return (
    <div className="flex flex-col items-start gap-2">
      <a href={url} target="_blank" rel="noreferrer" className="inline-block">
        <img
          src={url}
          /*
           * El texto alternativo no puede salir del título: es texto de un
           * tercero y describiría la actividad, no la foto. Lo que le sirve a
           * quien escucha la pantalla es qué es esto y de quién vino.
           */
          alt="El flyer que mandaron con esta propuesta"
          /*
           * **Acá está la garantía de «se pudo mirar»**, y no en la promesa que
           * trajo la URL. Mientras ninguno de los dos haya disparado, el estado
           * queda `undefined` y el gate del padre (`=== true`) esconde «No
           * usarla»: el default es no ofrecer el borrado.
           */
          onLoad={() => onEstado(true)}
          onError={() => onEstado(false)}
          loading="lazy"
          className="max-h-40 rounded-md border border-borde"
        />
      </a>
      <BajarElFlyer url={url} />
    </div>
  );
}

/**
 * **Bajar el flyer al disco** — B-926 (a), la primera de las cuatro opciones.
 *
 * ── Por qué existe, y es el punto del ítem ────────────────────────────────
 * **El único momento en que esta foto existe y alguien la está mirando es esta
 * pantalla.** Al aceptar la propuesta, `borrarImagenAlCerrar` borra el original
 * de `propuestas/` (B-863); al rechazarla, también. Sin un botón acá, la única
 * forma de conservarla es acordarse de abrirla en otra pestaña y guardarla a
 * mano antes de decidir — o sea, acordarse de algo que la pantalla no pide.
 *
 * ── Por qué NO alcanza un `<a download>` sobre la URL ─────────────────────
 * Es lo que el ítem del backlog proponía («la descarga es un `<a download>`
 * sobre la URL que el panel ya trae») y **no funciona**: el atributo `download`
 * se **ignora** cuando el destino es de otro origen, y la URL de Storage lo es
 * (`firebasestorage.googleapis.com`). El resultado sería el mismo link que ya
 * está arriba —abre la imagen en una pestaña— con un botón que promete otra
 * cosa. Es la clase de promesa que no se cumple y nadie reporta, porque «se
 * abrió algo» se parece bastante a que funcionó.
 *
 * Lo que sí funciona es traer los bytes y armar un `blob:` del **propio**
 * origen, que es donde `download` sí manda.
 *
 * ⚠️ **B-1235: en producción esto hoy NO anda, y el párrafo que estaba acá
 * afirmaba lo contrario** («la URL de descarga responde CORS para el `GET` con
 * su token»). Es falso mientras el bucket no tenga CORS configurado: se miró el
 * 2026-09-23 y la respuesta con los bytes (`alt=media`) no trae
 * `Access-Control-Allow-Origin` para ningún origen —la metadata sí, y por eso
 * confunde—. El emulador no aplica CORS de bucket, así que ahí anda. Es la misma
 * causa que la promoción de la imagen; el arreglo es el `cors.json` del repo
 * aplicado al bucket. Mientras tanto, el fallo de abajo manda a abrirla en otra
 * pestaña, que sí funciona (navegar no pide CORS).
 *
 * `URL.revokeObjectURL` en el mismo tick: el blob queda retenido en memoria
 * hasta que se revoque, y una bandeja con veinte propuestas abiertas se las
 * acumularía todas.
 */
function BajarElFlyer({ url }: { url: string }) {
  const [bajando, setBajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const bajar = async () => {
    setBajando(true);
    setFallo(null);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      /*
       * El nombre **no sale del título de la propuesta**: es texto de un tercero
       * y terminaría en el nombre de un archivo del disco de quien revisa. Sale
       * del tipo del blob, que es lo único que describe al archivo y no a nadie.
       */
      const ext = (blob.type.split('/')[1] ?? 'jpg').replace(/[^a-z0-9]/gi, '');
      a.download = `flyer-de-propuesta.${ext || 'jpg'}`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e: unknown) {
      /*
       * El fallo se dice y no se traga: quien iba a bajar la foto antes de
       * descartarla necesita saber que **no la bajó**, porque el paso siguiente
       * la borra. Un botón que falla en silencio acá pierde la foto de verdad.
       */
      setFallo(
        `No se pudo bajar (${e instanceof Error ? e.message : 'error desconocido'}). ` +
          'Abrila en otra pestaña y guardala a mano antes de seguir.',
      );
    } finally {
      setBajando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void bajar()}
        disabled={bajando}
        className={`${claseBotonSecundario} disabled:opacity-50`}
      >
        {bajando ? 'Bajando…' : 'Bajar la imagen'}
      </button>
      {fallo && (
        <p role="alert" className="text-xs text-acento">
          {fallo}
        </p>
      )}
    </>
  );
}

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
  /** Id de la propuesta cuya imagen se está trayendo a la galería (paso 8). */
  const [promoviendo, setPromoviendo] = useState<string | null>(null);
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
      setFallo(textoDeFallo(e, { respaldo: 'No se pudo actualizar la propuesta' }));
      return false;
    } finally {
      setMoviendo(null);
    }
  };

  /**
   * D-600, primer movimiento: se arma el formulario y **no se escribe la
   * actividad**. La propuesta se marca aceptada recién cuando la actividad
   * existe, y eso lo dispara el chasis con `alGuardar`.
   *
   * **Lo único que se escribe en Firestore es la marca de B-866**: una `nueva`
   * pasa a `en-revision` (`estadoAlConvertir`), que renueva su plazo de
   * retención. Arranca antes que la promoción de la imagen para achicar la
   * ventana, se espera antes de abrir el formulario para poder avisar, y si falla
   * **no corta**: la conversión sigue y el aviso lo dice (`avisoDeMarcaFallida`).
   *
   * **Lo único que sí toca el mundo es la imagen** (B-830 paso 8, DEC-11): si la
   * propuesta trajo una foto subida, se promueve a `imagenes/` acá, antes de
   * abrir el formulario, para que la actividad nazca con ella. **El objeto viejo
   * no se toca acá, y eso es el punto de B-863**: el original se borra en el
   * **segundo** momento —cuando la actividad ya se guardó y la transición a
   * `aceptada` despierta a `borrarImagenAlCerrar`—, no en éste. Borrarlo acá
   * dejaría a la propuesta sin flyer sin haber sido aceptada nunca cada vez que
   * alguien abandona el formulario, y no habría cómo reintentar.
   *
   * Si la conversión se abandona, lo que queda es un objeto en `imagenes/` que
   * ninguna actividad referencia — exactamente lo mismo que subir una foto en el
   * formulario y no guardar, y lo barre `limpiarImagenesHuerfanas` a las 72 horas
   * (B-221). No hace falta nada nuevo, y la propuesta conserva su foto.
   */
  const convertir = async (p: PropuestaConId, usarLaFoto = true) => {
    /*
     * **`elegibles` y no `valores`** — B-859. Las dos funcionan y se ven igual,
     * y por eso nadie lo agarró: `valores` son **todas** las opciones y existen
     * para *resolver etiquetas* (ver `etiqueta()` abajo, que sí usa `valores`
     * porque una propuesta puede nombrar legítimamente una pendiente);
     * `elegibles` es lo que se puede **elegir**, y acá el hook se llama **sin
     * `uid`**, así que son exactamente las aprobadas.
     *
     * La simetría que importa es con `/proponer`, que ofrece
     * `opcionesPublicas(...)` = `opcionesVisibles(valores)` sin uid, o sea las
     * mismas. Con `valores`, un `curl` anónimo podía nombrar un slug que
     * **existe pero está pendiente de aprobación** —que el formulario público
     * deliberadamente no ofrece (D-30)— y la conversión lo prellenaba como si
     * fuera parte del vocabulario. Con `elegibles` cae a «Otro», que es donde
     * el admin decide, que es el mecanismo del § 4.2 del PRD.
     */
    const { form, avisos } = propuestaAFormulario(
      p,
      incluyeConocido.elegibles.map((v) => v.slug),
    );
    const imagenes = [...form.imagenes];
    let imagenNoPromovida: string | null = null;

    /*
     * **La marca de B-866 va primero y en paralelo con la foto.** Una promesa que
     * nunca rechaza: devuelve el aviso si falló, o `null`. Así el `await` de abajo
     * no puede cortar la conversión, que es la mitad de la decisión.
     */
    const aMarcar = estadoAlConvertir(p.estado);
    const marca: Promise<string | null> = aMarcar
      ? (async () => {
          try {
            await revisarPropuesta(p.id, usuario.uid, aMarcar);
            return null;
          } catch (e: unknown) {
            return avisoDeMarcaFallida(e);
          }
        })()
      : Promise.resolve(null);

    if (usarLaFoto && p.imagen && 'storagePath' in p.imagen) {
      setPromoviendo(p.id);
      try {
        // `import()` y no estático: `subir-imagen` es el único dueño de
        // `firebase/storage` y traerlo al árbol estático deshace el corte del
        // bundle (B-09/D-51). Mismo camino que `GaleriaEditor`.
        let promover: typeof import('@/lib/subir-imagen').promoverImagenDePropuesta;
        try {
          ({ promoverImagenDePropuesta: promover } = await import('@/lib/subir-imagen'));
        } catch (e) {
          if (!esFalloDeCarga(e)) throw e;
          /*
           * **El chunk no llegó**, que es otra cosa que «Storage dijo que no» y
           * se arregla distinto: una pestaña abierta desde antes de un deploy
           * apunta a un chunk que Hosting ya borró. Sin esta rama, el aviso diría
           * «no se pudo traer la imagen» y quien lo lea va a mirar el bucket.
           *
           * Acá **no** se ofrece el borrador como en `GaleriaEditor`: esta
           * pantalla no tiene autoguardado, y la conversión se puede repetir
           * entera sin perder nada.
           */
          throw new Error(
            'no se pudo cargar esa parte del panel; recargá la página y probá de nuevo',
          );
        }
        const { imagen } = await promover(p.imagen.storagePath);
        imagenes.push({ ...imagen, portada: imagenes.length === 0 });
      } catch (e: unknown) {
        /*
         * La conversión **sigue** sin la imagen, y el aviso lo dice. Cortar acá
         * obligaría a resolver un problema de Storage antes de poder cargar una
         * actividad que ya está escrita, y la foto se puede volver a poner a
         * mano desde el formulario mientras la propuesta siga en la bandeja.
         */
        /*
         * **B-1235 — ya no es una línea más de `avisos`.** Era «La imagen que
         * mandaron no se pudo traer (Failed to fetch). La actividad se abre sin
         * ella», metida en la lista de lo que la conversión no prellenó, y así el
         * fallo se leía como «apreté usarla y no la tomó». Ahora viaja en su
         * propio campo y el formulario la pinta como alerta.
         *
         * `avisoDeImagenNoPromovida` y no `textoDeFallo` (B-929): aquél habla de
         * guardar («no se guardó nada»), y acá no se estaba guardando nada — lo
         * que la persona necesita es saber que la foto **no está** y cómo
         * ponerla. Y reconoce el caso que de verdad pasa en producción: el
         * `TypeError` del `fetch` que corta el CORS del bucket.
         */
        imagenNoPromovida = avisoDeImagenNoPromovida(e);
      } finally {
        setPromoviendo(null);
      }
    }

    const marcaFallida = await marca;

    onConvertir({
      copia: { ...form, imagenes },
      tituloOrigen: p.titulo,
      avisos: marcaFallida ? [marcaFallida, ...avisos] : avisos,
      imagenNoPromovida,
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
        /*
         * **`fotoDescartada` viaja acá y no antes** — B-926. Es una decisión de
         * quien revisó, tomada en el mismo acto que el cambio de estado, y es lo
         * único que autoriza al trigger a borrar el original sin verificar una
         * copia. Sin el flag, una conversión sin promover la imagen deja la foto
         * de un tercero viva para siempre: la `aceptada` no vence (B-844).
         *
         * Solo se manda cuando **había una foto y se decidió no usarla**: una
         * propuesta sin foto no tiene nada que descartar, y mandar el flag ahí
         * sería escribir una decisión que nadie tomó.
         */
        const habiaFoto = Boolean(p.imagen && 'storagePath' in p.imagen);
        await revisarPropuesta(p.id, usuario.uid, 'aceptada', {
          actividadId,
          ...(habiaFoto && !usarLaFoto ? { fotoDescartada: true } : {}),
        });
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
                <p className="mt-2 text-xs text-tinta/55">Motivo del rechazo: {p.revision.motivo}</p>
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
                    <p className="text-xs text-tinta/55">
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
                      disabled={promoviendo === p.id}
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
