/**
 * La forma con la que se muestra una imagen del sitio — B-263, D-147.
 *
 * ── El bug que esto arregla ───────────────────────────────────────────────
 * La página de detalle pintaba la portada con `object-cover` sobre una caja de
 * `16 / 9`. Los flyers reales del circuito son **verticales** —los dos que hay
 * cargados miden 720 × 826, o sea 0,87— y con esa combinación se perdía el
 * **51 %** de la imagen, mitad arriba y mitad abajo.
 *
 * Y lo que se perdía no era margen: **un flyer no es una foto, es texto metido
 * adentro de un JPEG**. El título, la fecha, la sede y cómo anotarse están
 * tipografiados ahí. Recortar arriba y abajo se lleva exactamente los datos.
 *
 * ── La regla, que es más fuerte que el número que reemplaza ───────────────
 * **Ninguna salida del sitio recorta una imagen.** No es «16/9 estaba mal y
 * 3/4 está bien»: cualquier caja de proporción fija con `object-cover` recorta
 * algo, y no hay proporción que sirva a la vez para un flyer de historia, una
 * foto apaisada del espacio y una tapa de libro.
 *
 * De ahí que el token `--aspect-portada` (B-249) se retire y lo reemplace una
 * **clase compartida** (`claseAfiche` en `components/sitio/estilos.ts`) más este
 * módulo. B-249 existía para que la misma imagen no tuviera dos recortes en dos
 * lugares distintos; con «nadie recorta» ese problema no se puede dar, y además
 * la garantía cubre un caso que el token no cubría: el token no impedía que un
 * consumidor lo usara con `object-cover` y otro con `object-contain`, que es
 * justo cómo volvería la divergencia.
 *
 * ── Y el alto sí se topea, que era lo que D-144 necesitaba ────────────────
 * El §4.3 del diseño no quería la imagen arriba porque «un flyer vertical empuja
 * la fecha fuera de la pantalla». D-144 le sacó la premisa fijando la
 * proporción; lo que en realidad hacía falta era topear el **alto**, que es lo
 * que ahora hace `max-h-[70svh]` dentro de `claseAfiche`. La diferencia importa:
 * con proporción fija, un flyer se ve cortado en todas las pantallas; con tope
 * de alto, se ve entero en casi todas y encogido —nunca cortado— en las pocas
 * donde no entra.
 *
 * Todo lo de acá es **puro** y se testea sin DOM: entra un par de números y sale
 * un string de CSS.
 */

/** Lo único que hace falta saber de una imagen para darle su caja. */
export interface MedidaDeImagen {
  ancho?: number | null;
  alto?: number | null;
}

/**
 * Un tope de cordura para las medidas. No es una restricción de producto: es
 * para que un dato corrupto —un `ancho: 0` de un documento viejo, un `alto`
 * negativo que alguien escribió a mano— produzca «no sé la forma» en vez de un
 * `aspect-ratio` que rompe el layout entero de la página.
 */
const MAXIMO_PIXELES = 100_000;

const medidaValida = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= MAXIMO_PIXELES;

/**
 * `"720 / 826"`, o `null` cuando no sabemos la forma de la imagen.
 *
 * **No saber es un caso de primera clase y no un borde.** Una imagen `propia`
 * trae `ancho`/`alto` desde que se sube (`subir-imagen.ts` los mide sobre los
 * bytes); una `externa` es una URL de otro lado y DEC-7d decidió que el build no
 * las descarga, así que su forma solo se puede conocer en un navegador. Desde
 * B-263 el panel la mide al previsualizarla y la guarda, pero las filas cargadas
 * antes —que hoy son casi todas— siguen sin medida hasta que alguien vuelva a
 * guardar esa actividad.
 */
export const proporcionDeAfiche = (medida: MedidaDeImagen): string | null =>
  medidaValida(medida.ancho) && medidaValida(medida.alto)
    ? `${medida.ancho} / ${medida.alto}`
    : null;

/**
 * El `style` del `<img>`: reserva la caja con la proporción propia de la imagen.
 *
 * Va inline y no como clase porque **es un dato**, no una decisión de diseño: el
 * número sale de la imagen. Una utilidad de Tailwind por cada proporción posible
 * no existe, y un `aspect-[720/826]` escrito en la plantilla sería exactamente
 * el número a mano que B-249 prohibía.
 *
 * Devuelve `undefined` cuando no se sabe: sin `aspect-ratio` el navegador usa la
 * forma real al cargar. Eso mueve el layout una vez —el costo de no saber— y es
 * preferible a reservar una caja inventada, que dejaría un flyer vertical
 * encogido entre dos bandas vacías **para siempre**, y no solo hasta que carga.
 */
export const estiloDeAfiche = (medida: MedidaDeImagen): string | undefined => {
  const proporcion = proporcionDeAfiche(medida);
  return proporcion ? `aspect-ratio: ${proporcion}` : undefined;
};

/**
 * Cuántas columnas puede tener la pared de la cartelera con `n` afiches.
 *
 * ── Por qué no es un `columns-3` fijo ─────────────────────────────────────
 * Hoy hay **dos** flyers cargados. Con tres columnas, CSS reparte el alto y esos
 * dos quedan del ancho de un tercio de pantalla, cada uno en su columna y con la
 * tercera vacía: una pared de afiches que se ve como una plantilla a medio
 * llenar. El pedido dice que con pocos se va a ver pobre y está bien, pero
 * «pobre» tiene que ser *poco*, no *mal armado*.
 *
 * Con el tope atado a la cantidad, dos flyers salen **uno abajo del otro y
 * grandes**, que es como se ve una cartelera con dos afiches pegados; y a
 * medida que se cargan, la pared se densifica sola sin que nadie toque nada.
 *
 * Es el tope: el CSS igual baja a una sola columna en el teléfono.
 */
export const columnasDeCartelera = (n: number): 1 | 2 | 3 => {
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  return 3;
};
