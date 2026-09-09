/**
 * La galería de imágenes del formulario (B-167, DEC-7).
 *
 * Filas dinámicas, cada una con su `id` generado al crearse — trampa 2, la misma
 * que costó el diff de sesiones. Y con **vista previa en el momento de pegar la
 * URL**, que era la otra mitad del pedido: pegar una dirección y no ver nada hasta
 * publicar es cómo se publica una imagen rota.
 *
 * Conviven las dos mitades de DEC-7c desde el mismo lugar: pegar la **URL de
 * afuera** y subir un **archivo propio**. La subida vive en `subir-imagen.ts`, que
 * se carga con `import()` — el SDK de Storage pesa como el de Firestore y no puede
 * viajar en la carga inicial del panel (B-09/D-51, `tests/bundle-panel.test.ts`).
 */
import { useRef, useState } from 'react';
import { claseBotonFila, claseBotonTinta, claseInput } from '@/components/campos/Campo';
import {
  MAXIMO_BYTES,
  MAXIMO_IMAGENES,
  conPortada,
  imagenExterna,
  nuevaImagenId,
  portadaDe,
  sinImagen,
} from '@/lib/imagenes';
import { TIPOS_SUBIBLES, enBytesLegibles } from '@/lib/imagenes-archivo';
import { medirFuncion } from '@/lib/analytics';
import {
  MENSAJE_PESTANIA_VIEJA,
  PROMESA_DEL_BORRADOR,
  esFalloDeCarga,
} from '@/lib/carga-diferida';
import { almacenDelNavegador } from '@/lib/formulario/borradoresDelNavegador';
import type { Imagen } from '@/types/actividad';

interface Props {
  imagenes: Imagen[];
  onChange: (imagenes: Imagen[]) => void;
  /**
   * El título de la actividad. **Ya no es el texto alternativo de todas** (D-440,
   * B-301): la portada tiene el suyo y las secundarias son decorativas (D-168).
   * Queda porque sigue siendo el **default de lectura** de lo que se cargó antes
   * de que el campo existiera, y decirlo es lo que hace obvio por qué conviene
   * escribir el alternativo en vez de dejarlo vacío.
   */
  tituloActividad: string;
  /**
   * B-341 — el mapa entero, no un solo `error?: string`.
   *
   * Antes este editor declaraba `error?: string` y lo pintaba, pero
   * `SeccionQueEs` lo montaba sin ese atributo: la línea que pinta el error
   * era código muerto y todo lo que el schema rechaza de `imagenes` se veía
   * solo en la barra de abajo. Es la misma clase que B-197 (material) y B-343
   * (encuentros): el editor de filas no recibía con qué mostrar su propio
   * rechazo.
   *
   * `errorDe('imagenes')` es el de la lista entera («Hasta 4 imágenes por
   * actividad», «Elegí una sola imagen como portada») y `errorDe('imagenes.N.url')`
   * es el de una fila puntual («URL inválida», al publicar).
   */
  errorDe: (path: string) => string | undefined;
}

/** Estado de la vista previa de cada fila, por id. */
type EstadoPrevia = 'cargando' | 'lista' | 'rota';

export function GaleriaEditor({ imagenes, onChange, tituloActividad, errorDe }: Props) {
  const [previas, setPrevias] = useState<Record<string, EstadoPrevia>>({});
  const [urlNueva, setUrlNueva] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  /**
   * **El error de arriba es de los que se arreglan recargando** — reporte del
   * dueño (2026-09-07). Va en su propio estado y no dentro del mensaje porque lo
   * que agrega es un **botón**: decirle «recargá» a alguien sin ponerle dónde es
   * la mitad del arreglo, y en un teléfono la otra mitad son cuatro toques.
   */
  const [debeRecargar, setDebeRecargar] = useState(false);
  /**
   * El aviso de B-324, aparte de `errorSubida` **y no en el mismo estado**: uno
   * dice «no se subió» y el otro «se subió, y mirá esto». Compartir el estado
   * haría que un aviso tape un error o al revés, y los dos pueden pasar en la
   * misma sesión.
   */
  const [avisoDeRotacion, setAvisoDeRotacion] = useState<string | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);

  /**
   * Las filas cuya medida hay que tomar de la vista previa — B-263.
   *
   * ── Por qué medirlas, y por qué acá ───────────────────────────────────
   * Una imagen **propia** trae `ancho` y `alto` desde que se sube:
   * `subir-imagen.ts` los saca de los bytes. Una **externa** es una URL de otro
   * lado y DEC-7d decidió que el build no las descarga, así que su forma solo se
   * puede conocer en un navegador — y acá hay uno, con la imagen ya cargada para
   * la vista previa. `naturalWidth`/`naturalHeight` se leen sin pedir permiso de
   * CORS: no son datos de píxel.
   *
   * Con la medida guardada, la página de detalle y la cartelera reservan la caja
   * exacta y la imagen no mueve el layout al cargar. Sin ella funciona igual,
   * solo que con un salto.
   *
   * ── Por qué solo estas y no todas las que se ven ──────────────────────
   * Porque medir al cargar la vista previa de una fila **que ya estaba guardada**
   * escribiría en el formulario apenas se abre, y `useFormularioSucio` compara el
   * estado contra el inicial: abrir una actividad sin tocar nada diría «tenés
   * cambios sin guardar» y dispararía el autoguardado. Es la misma familia que la
   * advertencia de D-125 sobre el id determinístico.
   *
   * Entonces se mide lo que **esta sesión** escribió: la fila recién agregada y
   * la fila a la que se le cambió la dirección. En los dos casos ya hay un cambio
   * en curso, así que la medida no inventa ninguno. Las filas viejas quedan sin
   * medida hasta que alguien las vuelva a tocar, y eso está bien: el costo es un
   * salto de layout, no un dato perdido.
   */
  const porMedir = useRef<Set<string>>(new Set());

  const marcarPrevia = (id: string, estado: EstadoPrevia) =>
    setPrevias((p) => ({ ...p, [id]: estado }));

  const agregar = () => {
    const url = urlNueva.trim();
    if (!url) return;
    // La primera nace portada: si no, la lista arranca sin ninguna y B-107 se
    // queda sin imagen para compartir sin que nada falle.
    const nueva = imagenExterna(url, imagenes.length === 0);
    porMedir.current.add(nueva.id);
    onChange([...imagenes, nueva]);
    setUrlNueva('');
  };

  const editar = (id: string, cambio: Partial<Imagen>) =>
    onChange(imagenes.map((i) => (i.id === id ? { ...i, ...cambio } : i)));

  /**
   * Sube el archivo elegido y lo agrega como una fila más (DEC-7c).
   *
   * **El id se genera acá y es el mismo que va a nombrar el objeto en Storage**
   * (`rutaDeImagen`), así que la fila y su archivo comparten identidad. Es la
   * trampa 2 otra vez: nunca por índice del array.
   *
   * El `import()` está adentro del handler y no arriba a propósito — es lo único
   * que mantiene el SDK de Storage fuera del chunk inicial del panel.
   */
  const subir = async (archivo: File) => {
    setErrorSubida(null);
    setAvisoDeRotacion(null);
    setDebeRecargar(false);
    setSubiendo(true);
    try {
      /*
       * **El `import()` va en su propio `try`, y ese es el arreglo del reporte
       * del dueño** (2026-09-07: «me siguen diciendo que no se pueden subir
       * imágenes»). Es lo primero que hace la subida y lo único de este flujo que
       * puede fallar sin ser un `ImagenRechazada`, así que caía en el mensaje
       * genérico —«volvé a intentar en un momento»— que además manda a repetir lo
       * único que no puede funcionar: el chunk no existe más.
       *
       * Por qué falla: el SDK de Storage se carga diferido (B-09, D-51), o sea
       * que este código vive en un archivo con el hash del build en el nombre.
       * Hosting sirve el HTML con `no-cache` y `/_astro/**` como `immutable`, así
       * que **una pestaña abierta se queda con el HTML viejo** y ese HTML apunta a
       * un chunk que el deploy siguiente borró. Le pasa justo a quien dejó el
       * panel abierto cargando una actividad, que es cuando se suben las fotos.
       *
       * El detalle en `lib/carga-diferida.ts`, incluido por qué el mensaje no
       * afirma que la pestaña esté vieja: sin red, Chrome tira el mismo error.
       */
      let subirImagen: typeof import('@/lib/subir-imagen').subirImagen;
      try {
        ({ subirImagen } = await import('@/lib/subir-imagen'));
      } catch (e) {
        if (!esFalloDeCarga(e)) throw e;
        /*
         * Las **dos** frases, y la segunda **solo si hay dónde guardar**.
         *
         * Este editor vive adentro del formulario de actividad, que es el único
         * con autoguardado (D-122), así que acá la promesa del borrador es cierta
         * — el límite genérico (`SiNoCarga`) no la dice, porque envuelve también
         * vistas que no lo tienen.
         *
         * Pero el autoguardado es **best-effort**: `guardarBorradorLocal` devuelve
         * si pudo, y sin almacén usable —modo privado, cuota llena, cookies
         * bloqueadas en un iframe— no guardó nada. Lo señaló el
         * `auditor-privacidad`: prometerlo ahí es el segundo modo en que esta
         * frase nace falsa, y no depende de ninguna versión.
         */
        const conBorrador = almacenDelNavegador() !== null;
        setErrorSubida(
          MENSAJE_PESTANIA_VIEJA + (conBorrador ? PROMESA_DEL_BORRADOR : ''),
        );
        setDebeRecargar(true);
        medirFuncion('imagen-rechazada', 'carga');
        return;
      }

      const { imagen, orientacion } = await subirImagen(archivo, nuevaImagenId());
      // La primera nace portada, igual que al pegar una URL.
      onChange([...imagenes, { ...imagen, portada: imagenes.length === 0 }]);
      medirFuncion('imagen-subida');
      /*
       * **La foto venía de costado** — B-324, y el dueño eligió avisar en vez de
       * rotar. No es un error: la subida salió bien y la imagen está arriba. Es
       * información que hace falta **antes de publicar**, porque el sitio la va a
       * mostrar como está.
       *
       * Sale después del `onChange` a propósito: primero la fila aparece —así se
       * ve la foto y se puede juzgar el aviso mirándola— y después el texto.
       */
      if (orientacion !== null) {
        setAvisoDeRotacion(
          'Esta foto trae una marca de rotación del teléfono, y al sacarle los datos ' +
            'ocultos esa marca se va: en el sitio se va a ver como la ves acá arriba. ' +
            'Si quedó acostada, rotala en el teléfono y volvé a subirla.',
        );
        medirFuncion('imagen-rotada', undefined, orientacion);
      }
    } catch (e) {
      // `ImagenRechazada` trae un mensaje escrito para una persona; cualquier
      // otra cosa, no — y mostrar el `message` crudo de un SDK es peor que un
      // mensaje genérico, porque suena a que el problema es de quien lo lee.
      // Se reconoce por `name` y no con `instanceof`: la clase vive en el módulo
      // diferido, y ese binding no existe en este `catch`.
      const rechazo = e as { name?: string; message?: string; causa?: string };
      const esRechazo = rechazo?.name === 'ImagenRechazada';
      setErrorSubida(
        esRechazo && rechazo.message
          ? rechazo.message
          : 'No se pudo subir la imagen. Volvé a intentar en un momento.',
      );
      medirFuncion('imagen-rechazada', esRechazo ? (rechazo.causa ?? 'red') : 'red');
    } finally {
      setSubiendo(false);
      // Sin esto, elegir **el mismo archivo** después de un rechazo no dispara
      // `onChange` y parece que el botón dejó de andar.
      if (inputArchivo.current) inputArchivo.current.value = '';
    }
  };

  const lleno = imagenes.length >= MAXIMO_IMAGENES;

  return (
    <div className="flex flex-col gap-3">
      {/*
        B-341 — el error de la lista entera («Hasta 4 imágenes», «Elegí una
        sola portada»). `data-campo-con-error` es lo que hace que un guardado
        fallido scrollee hasta acá (B-184); antes no lo tenía ningún elemento
        de esta sección.
      */}
      {errorDe('imagenes') && (
        <p data-campo-con-error role="alert" className="scroll-mt-16 text-xs font-medium text-acento">
          {errorDe('imagenes')}
        </p>
      )}

      {imagenes.map((img, i) => {
        const estado = previas[img.id] ?? 'cargando';
        // B-341 — la ruta de esta fila, con el índice en el medio: es donde lo
        // pone el `path` del `superRefine` (`imagenes.2.url`). Armada distinto,
        // el error existe en el mapa y no se pinta nunca.
        const errorUrl = errorDe(`imagenes.${i}.url`);
        /*
         * B-301 — el campo del texto alternativo se muestra **solo en la
         * portada**, que es lo que cumple «un campo solo» del desvío del dueño
         * (D-440): la portada es la que va a Open Graph y a la tarjeta, o sea la
         * única que se comparte.
         *
         * Cuál es la portada lo contesta `portadaDe` y no `img.portada`, que es
         * la misma función que usa el `superRefine` para decidir a qué fila le
         * pide el campo. Con dos derivaciones, una lista sin ninguna marcada
         * —posible en un documento anterior a la galería— pediría el campo en una
         * fila y lo mostraría en otra: el error existiría en el mapa y no se
         * pintaría en ninguna parte, que es la clase de B-341.
         */
        const esPortada = portadaDe(imagenes)?.id === img.id;
        const errorAlternativo = errorDe(`imagenes.${i}.textoAlternativo`);
        return (
          <div key={img.id} className="rounded-md border border-borde p-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              {/*
                La miniatura es la vista previa. `alt` vacío a propósito: el
                epígrafe de al lado ya dice lo que es, y repetirlo se lee dos
                veces en un lector de pantalla.
              */}
              <div className="flex h-20 w-full shrink-0 items-center justify-center overflow-hidden rounded bg-tinta/[0.04] sm:w-28">
                {estado === 'rota' ? (
                  <span className="px-2 text-center text-[11px] text-tinta/50">
                    No se pudo cargar
                  </span>
                ) : (
                  <img
                    src={img.url}
                    alt=""
                    /*
                      El host de la imagen es de un tercero y esta petición sale
                      del panel: sin esto se lleva el `Referer` con la URL de
                      `/admin`, o sea aprende que un admin lo abrió y cuándo.
                    */
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onLoad={(e) => {
                      marcarPrevia(img.id, 'lista');
                      // B-263 — ver el docblock de `porMedir`.
                      if (!porMedir.current.has(img.id)) return;
                      const { naturalWidth, naturalHeight } = e.currentTarget;
                      porMedir.current.delete(img.id);
                      if (naturalWidth > 0 && naturalHeight > 0) {
                        editar(img.id, { ancho: naturalWidth, alto: naturalHeight });
                      }
                    }}
                    onError={() => marcarPrevia(img.id, 'rota')}
                  />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  type="url"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  /*
                    La dirección de una imagen **propia** es de solo lectura: la
                    generó Storage y apunta al objeto que nombra su `storagePath`.
                    Editarla a mano deja la fila apuntando a otro lado con el
                    `storagePath` de este archivo — dos campos que dicen cosas
                    distintas sobre la misma imagen, que es como se rompen las
                    cosas en silencio. Para cambiarla, se quita la fila y se sube
                    de nuevo.
                  */
                  readOnly={img.origen === 'propia'}
                  className={`${claseInput} ${img.origen === 'propia' ? 'text-tinta/55' : ''}`}
                  value={img.url}
                  onChange={(e) => {
                    marcarPrevia(img.id, 'cargando');
                    /*
                      B-263 — la dirección cambió, así que la medida guardada es
                      de **otra** imagen. Se borra y se vuelve a pedir: dejarla
                      puesta haría que la página de detalle reserve la caja de la
                      imagen anterior, que es peor que no reservar ninguna.
                    */
                    porMedir.current.add(img.id);
                    editar(img.id, {
                      url: e.target.value,
                      ancho: undefined,
                      alto: undefined,
                    });
                  }}
                  placeholder="https://…"
                  aria-label={
                    img.origen === 'propia'
                      ? 'Dirección de la imagen subida (no se edita)'
                      : 'Dirección de la imagen'
                  }
                />
                {/*
                  B-341 — «URL inválida» / «La dirección tiene que empezar con
                  https://», al publicar. Sin `Campo` alrededor del input (acá
                  el label es el `aria-label`, no uno visible), así que el
                  error se pinta a mano, igual que la casilla de material
                  (B-197).
                */}
                {errorUrl && (
                  <p data-campo-con-error role="alert" className="-mt-1 text-xs font-medium text-acento">
                    {errorUrl}
                  </p>
                )}
                <input
                  type="text"
                  className={claseInput}
                  value={img.epigrafe}
                  onChange={(e) => editar(img.id, { epigrafe: e.target.value })}
                  placeholder="Epígrafe (opcional)"
                  aria-label="Epígrafe"
                />
                {esPortada && (
                  <>
                    <input
                      type="text"
                      className={claseInput}
                      value={img.textoAlternativo ?? ''}
                      onChange={(e) => editar(img.id, { textoAlternativo: e.target.value })}
                      placeholder="Qué se ve en la portada"
                      aria-label="Descripción de la portada"
                    />
                    {errorAlternativo && (
                      <p
                        data-campo-con-error
                        role="alert"
                        className="-mt-1 scroll-mt-16 text-xs font-medium text-acento"
                      >
                        {errorAlternativo}
                      </p>
                    )}
                    <p className="text-xs text-tinta/55">
                      {img.textoAlternativo?.trim()
                        ? 'Se necesita para publicar. No se muestra en pantalla: lo lee quien usa un lector de pantalla, y Google cuando la imagen no carga.'
                        : `Se necesita para publicar. Sin esto se publica ${
                            tituloActividad ? `«Imagen de ${tituloActividad}»` : '«Imagen de» el título'
                          }, que no describe nada. Contá qué se ve: «Flyer con la fecha y la sede», «Retrato de la autora».`}
                    </p>
                  </>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-h-touch items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="portada-galeria"
                      checked={img.portada}
                      onChange={() => onChange(conPortada(imagenes, img.id))}
                    />
                    Portada
                  </label>
                  {img.origen === 'propia' && (
                    <span className="text-[11px] text-tinta/50">Subida a la agenda</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange(sinImagen(imagenes, img.id))}
                    className={`${claseBotonFila} ml-auto text-acento hover:bg-acento/10`}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {errorSubida && (
        <p role="alert" className="text-xs text-acento">
          {errorSubida}
          {/*
            El botón solo aparece en el caso que se arregla recargando, y va
            **adentro del mismo `role="alert"`** para que un lector de pantalla lo
            anuncie junto con el motivo: separado, se lee el problema y después
            «botón, recargar» sin relación entre los dos.
          */}
          {debeRecargar && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ms-1 min-h-touch font-medium underline hover:no-underline sm:min-h-0"
            >
              Recargar ahora
            </button>
          )}
        </p>
      )}

      {/*
        El aviso de B-324, y las dos diferencias con el error de arriba son
        deliberadas:

        - **`role="status"` y no `role="alert"`**: un `alert` interrumpe al lector
          de pantalla, y esto no es una urgencia — la subida salió bien. `status`
          lo anuncia cuando la persona llega.
        - **La tinta suave y no el acento**: el acento es el color de «algo se
          rompió» en este sistema visual, y acá no se rompió nada. Pintarlo igual
          que un error haría que el próximo error de verdad se lea como un aviso.

        Se muestra debajo de la fila que se acaba de agregar, así se puede mirar
        la foto y el aviso a la vez — que es lo único que hace accionable al
        texto: decide quien la ve.
      */}
      {avisoDeRotacion && (
        <p role="status" className="border-l-2 border-borde pl-2 text-xs text-suave">
          {avisoDeRotacion}
        </p>
      )}

      {lleno ? (
        <p className="text-xs text-tinta/55">
          Llegaste a {MAXIMO_IMAGENES} imágenes, que es el máximo. Para agregar otra, quitá
          una.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={claseInput}
              value={urlNueva}
              onChange={(e) => setUrlNueva(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Enter agrega la fila y no manda el formulario: en una sección
                  // de filas, el submit accidental es el error más caro.
                  e.preventDefault();
                  agregar();
                }
              }}
              placeholder="Pegá la dirección de una imagen"
              aria-label="Dirección de la imagen nueva"
            />
            <button type="button" onClick={agregar} className={`${claseBotonTinta} sm:w-auto`}>
              Agregar
            </button>
          </div>

          {/*
            DEC-7c — subir un archivo propio, al lado de pegar una URL y no en otra
            pantalla: son las dos formas de la misma cosa y elegir entre ellas es
            parte de cargar la imagen.

            El `<input type="file">` va escondido adentro del `<label>` y no con
            `display:none` suelto: así el label **es** el disparador (click y
            teclado salen gratis) y el control sigue en el árbol de accesibilidad.
          */}
          <label
            className={`${claseBotonTinta} flex min-h-touch cursor-pointer items-center justify-center sm:w-auto ${
              subiendo ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {subiendo ? 'Subiendo…' : 'Subir una imagen'}
            <input
              ref={inputArchivo}
              type="file"
              className="sr-only"
              accept={TIPOS_SUBIBLES.join(',')}
              disabled={subiendo}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) void subir(archivo);
              }}
            />
          </label>

          <p className="text-xs text-tinta/55">
            JPG o PNG, hasta {enBytesLegibles(MAXIMO_BYTES)} por imagen. Una foto de celular
            sin recortar casi siempre pasa ese tamaño. Al subirla se le quitan los datos que
            traen las fotos —entre ellos, el lugar exacto donde se sacó—.
          </p>
        </>
      )}

      {/*
        B-264 — el texto de abajo era «sin imagen, la tarjeta del sitio no reserva
        un hueco gris: se ve igual de bien», y desde D-146 el listado no tiene
        tarjetas ni portadas, así que describía una pantalla que ya no existe **y
        además tranquilizaba justo donde había que empujar**.

        Ahora dice qué se pierde, con las dos consecuencias verificables mirando
        el sitio: la cartelera se arma con las que tienen imagen y el `og:image`
        del detalle sale de la portada.
      */}
      {/*
        B-301 / D-440 — este texto decía que el alternativo sale del título, y
        desde el desvío del dueño eso solo vale para lo que ya estaba cargado: hoy
        la portada tiene su propio campo y es obligatorio para publicar. Las
        secundarias siguen decorativas (D-168), y decirlo acá es lo que evita que
        alguien busque el campo que no está en esas filas.
      */}
      <p className="text-xs text-tinta/55">
        {imagenes.length === 0
          ? 'Sin imagen la actividad se publica igual, pero no aparece en la cartelera del ' +
            'sitio y el link se comparte sin nada que mirar.'
          : 'La descripción se pide solo en la portada, que es la que se comparte. Las demás ' +
            'la página las trata como decoración, así que un lector de pantalla no las ' +
            'anuncia. El epígrafe es otra cosa: se muestra debajo de la foto.'}
      </p>
    </div>
  );
}
