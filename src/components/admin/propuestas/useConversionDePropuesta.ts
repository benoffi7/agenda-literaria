import { useRef, useState } from 'react';
import type { useOpciones } from '@/components/admin/useOpciones';
import { esFalloDeCarga } from '@/lib/carga-diferida';
import { medirFuncion } from '@/lib/analytics';
import {
  avisoDeMarcaFallida,
  avisoDeVencimientoAlConvertir,
  estadoAlConvertir,
  revisarPropuesta,
} from '@/lib/bandejaDePropuestas';
import { avisoDeImagenNoPromovida, propuestaAFormulario } from '@/lib/propuestas';
import type { ActividadForm } from '@/types/actividad';
import type { PropuestaConId } from '@/types/propuesta';

/*
 * **Convertir una propuesta en actividad** — la mitad «conversión» de la
 * bandeja (M-17). Salió de `PropuestasPanel.tsx`, que se queda con la lista y
 * los movimientos de estado; el porqué de cada paso sigue escrito acá abajo,
 * junto al código que lo hace.
 */

/**
 * Lo que la bandeja le pasa al chasis cuando alguien convierte: el formulario
 * prellenado y el segundo movimiento de D-600.
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

interface Parametros {
  usuario: { uid: string };
  onConvertir: (conversion: Conversion) => void;
  /** Las opciones de `incluye-actividad`: se usan sus `elegibles` (B-859). */
  incluyeConocido: Pick<ReturnType<typeof useOpciones>, 'elegibles'>;
}

export function useConversionDePropuesta({ usuario, onConvertir, incluyeConocido }: Parametros) {
  /** Id de la propuesta cuya imagen se está trayendo a la galería (paso 8). */
  const [promoviendo, setPromoviendo] = useState<string | null>(null);
  /*
   * **B-1461 — la marca de B-866 en vuelo también bloquea el botón.** Sin foto no
   * hay `promoviendo`, y un doble clic abría dos conversiones: la segunda volvía a
   * ver `nueva`, intentaba `en-revision → en-revision`, la regla lo rechazaba
   * —bien— y el formulario abría con un «No se pudo marcar…» falso, porque la
   * primera marca sí se había escrito. El ref corta el segundo clic aunque llegue
   * antes de que React pinte el botón deshabilitado.
   */
  const [marcando, setMarcando] = useState<string | null>(null);
  const convirtiendo = useRef<string | null>(null);

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
   * La `en-revision` y la `rechazada` no se marcan; si les queda menos de un día,
   * el formulario lo avisa arriba (`avisoDeVencimientoAlConvertir`, B-1460).
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
    if (convirtiendo.current === p.id) return;
    convirtiendo.current = p.id;
    setMarcando(p.id);
    try {
      await convertirUnaVez(p, usarLaFoto);
    } finally {
      convirtiendo.current = null;
      setMarcando(null);
    }
  };

  const convertirUnaVez = async (p: PropuestaConId, usarLaFoto: boolean) => {
    /*
     * **`elegibles` y no `valores`** — B-859. Las dos funcionan y se ven igual,
     * y por eso nadie lo agarró: `valores` son **todas** las opciones y existen
     * para *resolver etiquetas* (ver `etiqueta()` en `PropuestasPanel.tsx`, que
     * sí usa `valores` porque una propuesta puede nombrar legítimamente una
     * pendiente); `elegibles` es lo que se puede **elegir**, y la bandeja llama
     * al hook **sin `uid`**, así que son exactamente las aprobadas.
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
    /*
     * **B-1460 — la que la marca no salva.** Una `en-revision` o una `rechazada`
     * se convierten sin moverse, así que si les queda menos de un día el barrido
     * se las puede llevar con el formulario abierto. Va primero, con la marca
     * fallida: las dos dicen lo mismo —«guardá pronto»— por motivos distintos, y
     * nunca salen juntas (la marca solo se intenta sobre la `nueva`, y ésta
     * nunca avisa).
     */
    const vence = avisoDeVencimientoAlConvertir(p);
    const primeros = [marcaFallida, vence].filter((a): a is string => a !== null);

    onConvertir({
      copia: { ...form, imagenes },
      tituloOrigen: p.titulo,
      avisos: primeros.length > 0 ? [...primeros, ...avisos] : avisos,
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
         * evento: ver `rechazar`, en `PropuestasPanel.tsx`.
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

  return { convertir, promoviendo, marcando };
}
