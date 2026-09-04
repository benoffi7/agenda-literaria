import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as PointerEventDeReact,
  type ReactElement,
} from 'react';

import { posicionEnLaGaleria, rotuloDelVisor } from '@/lib/afiche';
import { useCapaModal, useHistorialDeCapa } from '@/lib/capaModal';
import { claseAficheEnVisor, claseBotonDelVisor } from '@/components/sitio/estilos';

/**
 * La capa que muestra las imágenes de una actividad en grande, y la primera
 * island de la página de detalle — B-720 (D-430).
 *
 * ── El pedido, y por qué no era «poner un lightbox» ───────────────────────
 * El dueño mirando el sitio publicado: la galería tiene que ser clickeable para
 * recorrer las fotos y verlas en pantalla completa. Hasta acá el detalle pintaba
 * todas las imágenes (B-296, D-168) en cajas de la proporción de cada una y
 * **estáticas**: un flyer, que es la mitad de lo que se carga, es texto metido
 * adentro de un JPEG (D-147) y se veía al tamaño que entró en la columna. No
 * había forma de leerlo.
 *
 * ── Lo que este archivo NO hace, y es lo que lo mantiene chico ────────────
 * **No pinta la galería.** El HTML del build sigue siendo el que muestra las
 * imágenes, con sus proporciones, su `lazy` y su `srcset` — §6.3: «el HTML es la
 * verdad». Esta island solo **toma el control** de los enlaces que ese HTML ya
 * imprimió: los intercepta y abre la capa. De ahí las dos consecuencias que
 * importan:
 *
 * 1. **Con JavaScript apagado la galería funciona como antes de este cambio**,
 *    más una mejora: cada imagen es un enlace a su archivo, así que «verla
 *    grande» es el visor de imágenes del navegador. Nada de la página depende de
 *    que esto hidrate.
 * 2. **La lista de imágenes no viaja dos veces.** El componente la lee del DOM
 *    (`leerImagen`), así que no hay props con las URLs ni un `<script>` de datos
 *    duplicando lo que el HTML ya dice. La única prop es el título, que es el
 *    nombre accesible del diálogo. Y como el `href` de cada enlace es la imagen
 *    **original**, la capa muestra el original por construcción y no porque
 *    alguien se acuerde (D-210: el `srcset` del `<img>` de arriba puede haber
 *    elegido la miniatura de 480px, que en pantalla completa se vería mal).
 *
 * ── El costo, dicho con el número ─────────────────────────────────────────
 * Esta página mandaba **cero islands** y era una decisión (§4.3). La primera
 * cuesta el runtime de React: **58,5 KB gzip** (`dist/_astro/client.*.js`,
 * 186,6 KB sin comprimir) más ~2 KB de este componente. Está medido y decidido
 * en **D-430**, con la comparación que corresponde: el `gtag.js` que D-251
 * aceptó en esta misma página pesa 155,6 KB gzip. Dos consecuencias del número,
 * las dos acá:
 *
 * - **`client:idle` y no `client:load`**: el visor no participa de la primera
 *   pantalla, así que baja cuando el navegador está libre. Un click antes de que
 *   hidrate navega al JPEG, que es el mismo respaldo que el caso sin JavaScript.
 * - **La island no se monta si la actividad no tiene imágenes** (lo decide la
 *   plantilla): 16 de 46 publicadas no tienen ninguna, y esas siguen mandando
 *   cero bytes.
 *
 * ── Una sola imagen en el aire, y es a propósito ──────────────────────────
 * La capa renderiza **la imagen actual y nada más**: ni precarga la siguiente ni
 * arma una tira. Las originales de una actividad suman hasta 3,15 MB (medido
 * contra producción el 2026-09-02, D-168) porque la recompresión no existe
 * todavía (B-220, DEC-7d); abrir la capa no puede costar las cuatro. La
 * consecuencia asumida es que pasar a la siguiente espera esa descarga.
 */
export interface Props {
  /** El título de la actividad: el nombre accesible del diálogo (D-125). */
  titulo: string;
}

/**
 * El contrato con el HTML del build: cada enlace que abre la capa lleva este
 * atributo. Está escrito literal en las dos puntas —acá y en
 * `src/pages/actividad/[slug].astro`— y lo ata un test
 * (`tests/galeria-del-detalle.test.ts`), que es la forma que este repo usa para
 * un acuerdo entre un `.astro` y un `.tsx`.
 *
 * **El orden es el del documento**, y por eso no hay ningún índice en el markup:
 * `querySelectorAll` devuelve la portada primero (está antes en el HTML) y
 * después la tira en el orden en que se cargaron. Un `data-visor="2"` escrito en
 * la plantilla sería un segundo lugar donde la numeración puede quedar mal.
 */
const SELECTOR_ABRIDOR = '[data-visor]';

/** Lo que la capa necesita saber de una imagen. Sale del HTML, no de una prop. */
interface ImagenDelVisor {
  /** El `href` del enlace, o sea **el original** — nunca la miniatura (D-210). */
  url: string;
  /**
   * El mismo `alt` que el build imprimió para esa imagen, y eso resuelve D-168
   * sin reabrirlo: la portada trae «Imagen de {título}» y las secundarias vienen
   * con `alt=""` porque repetir el título N veces es peor que callarlo. El día
   * que B-301 pida un `alt` por imagen, la capa lo hereda sin tocar nada.
   */
  alt: string;
  /** El epígrafe de D-125, que acompaña a **su** foto también en la capa. */
  epigrafe: string;
  ancho: number | null;
  alto: number | null;
}

/** Una medida del markup, o `null`. Mismo criterio que `proporcionDeAfiche`. */
const medida = (v: string | null | undefined): number | null => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

const abridores = (): HTMLAnchorElement[] => [
  ...document.querySelectorAll<HTMLAnchorElement>(SELECTOR_ABRIDOR),
];

/**
 * Una imagen de la galería, leída del enlace que la envuelve.
 *
 * El epígrafe se busca en la `<figure>` y no como hermano del `<a>`: la portada
 * y las secundarias tienen la misma estructura (`figure > a > img` +
 * `figcaption`), y `closest` la respeta sin que este archivo tenga que saber
 * cuántos niveles hay.
 */
const leerImagen = (enlace: HTMLAnchorElement): ImagenDelVisor => {
  const img = enlace.querySelector('img');
  const pie = enlace.closest('figure')?.querySelector('figcaption');
  return {
    url: enlace.getAttribute('href') ?? '',
    alt: img?.getAttribute('alt') ?? '',
    epigrafe: pie?.textContent?.trim() ?? '',
    ancho: medida(img?.getAttribute('width')),
    alto: medida(img?.getAttribute('height')),
  };
};

export default function VisorDeGaleria({ titulo }: Props): ReactElement | null {
  /**
   * La galería, leída al abrir y no al montar. Es un `useState` y no un `ref`
   * porque el render la usa; se llena en el click, un instante antes de que
   * `indice` deje de ser `null`.
   */
  const [galeria, setGaleria] = useState<ImagenDelVisor[]>([]);
  /** Qué imagen se está mirando. `null` es «la capa está cerrada». */
  const [indice, setIndice] = useState<number | null>(null);
  /** La caja de la capa: `tabIndex={-1}` para que `useCapaModal` la enfoque. */
  const caja = useRef<HTMLDivElement>(null);

  const abierta = indice !== null;
  const cerrar = useCallback(() => setIndice(null), []);

  /*
   * El foco atrapado, `Escape`, el scroll de atrás bloqueado y el foco devuelto
   * al abridor: todo eso es `useCapaModal` (B-210, compartido desde B-238) y no
   * se vuelve a escribir acá. Con `activo` en `false` mientras la capa está
   * cerrada, el hook no engancha nada — es para lo que se agregó ese parámetro.
   */
  useCapaModal(caja, cerrar, abierta);
  /* Y el botón atrás del teléfono cierra la capa en vez de salir del sitio. */
  useHistorialDeCapa(abierta, cerrar);

  /**
   * Interceptar el click en los enlaces que el build imprimió — el corazón del
   * «el HTML es la verdad, la island toma el control».
   *
   * Es **delegado en `document`** y no un listener por enlace: son dos lugares
   * del DOM (la portada arriba, la tira al final) y de una a cuatro imágenes, y
   * un solo listener no tiene que enterarse de cuántos hay ni volver a
   * engancharse.
   *
   * ── Lo que se deja pasar, y es la mitad progresiva ───────────────────────
   * Un click con Cmd/Ctrl/Shift, o con el botón del medio, **no se intercepta**:
   * ahí la persona pidió explícitamente abrir el archivo en otra pestaña, y un
   * `preventDefault()` le rompería un gesto del navegador para reemplazarlo por
   * una capa que no pidió. Es la misma razón por la que el abridor es un `<a>`
   * con `href` y no un `<button>`: un botón sin JavaScript es un control que
   * miente, y este enlace funciona con la island, sin ella, y antes de que
   * hidrate.
   */
  useEffect(() => {
    const alClickear = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const enlace = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
        SELECTOR_ABRIDOR,
      );
      if (!enlace) return;
      const lista = abridores();
      const n = lista.indexOf(enlace);
      if (n < 0) return;
      e.preventDefault();
      /*
       * El foco al abridor **antes** de abrir, y no es redundante:
       * `useCapaModal` devuelve el foco a `document.activeElement` de cuando la
       * capa se montó, y un click en un enlace no lo enfoca en todos los
       * navegadores (Safari es el caso). Sin esta línea, cerrar la capa dejaría
       * el foco en el `<body>` y quien navega con teclado tendría que recorrer
       * la página entera de nuevo. Se arregla en el origen, en vez de guardar el
       * abridor en un ref y competir con el hook por quién restaura.
       */
      enlace.focus();
      setGaleria(lista.map(leerImagen));
      setIndice(n);
    };
    document.addEventListener('click', alClickear);
    return () => document.removeEventListener('click', alClickear);
  }, []);

  /**
   * Las flechas recorren la galería — la otra mitad del pedido.
   *
   * En `document` y no en la caja: el foco puede estar en cualquier control de
   * la capa (o en la caja misma, recién abierta), y las flechas tienen que
   * andar igual. `Escape` y el `Tab` del borde ya los atiende `useCapaModal`,
   * así que acá solo viven las dos teclas propias del visor.
   *
   * Da la vuelta a propósito: con dos o tres imágenes, llegar al final y no
   * poder seguir se siente como un botón roto. El contador dice dónde estás, así
   * que la vuelta no desorienta.
   *
   * No se engancha con una sola imagen: no hay nada que recorrer.
   */
  useEffect(() => {
    if (!abierta || galeria.length < 2) return;
    const teclas = (e: KeyboardEvent) => {
      const paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (paso === 0) return;
      e.preventDefault();
      setIndice((i) => (i === null ? null : (i + paso + galeria.length) % galeria.length));
    };
    document.addEventListener('keydown', teclas);
    return () => document.removeEventListener('keydown', teclas);
  }, [abierta, galeria.length]);

  const mover = (paso: number) =>
    setIndice((i) => (i === null ? null : (i + paso + galeria.length) % galeria.length));

  const actual = indice === null ? null : galeria[indice];
  if (indice === null || !actual) return null;

  const hayVarias = galeria.length > 1;

  /**
   * El click en el fondo cierra — el gesto que ya tienen las otras capas del
   * repo (B-238, `CentroAyuda`).
   *
   * Se pregunta por lo que **no** cierra en vez de comparar contra la caja:
   * tocar la foto, su epígrafe o un control es interactuar con la capa, y
   * cualquier otro punto de la pantalla es «afuera». Comparar
   * `target === currentTarget` no alcanzaría acá: los hijos de la capa cubren
   * casi todo el hueco, así que el fondo casi nunca sería el destino del evento.
   */
  const alTocarElFondo = (e: PointerEventDeReact<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, img, figcaption')) return;
    cerrar();
  };

  return (
    /*
      `bg-tinta` **sólida**, sin desenfoque y sin sombra: el sistema no tiene
      ninguna clase de color con opacidad en todo el sitio y una capa translúcida
      sería una trama de medio tono (B-235, `sistema-visual.test.ts`). Es el
      mismo fondo que la hoja de filtros de B-238, por el mismo motivo. Y sin
      transición: no hay nada que animar, así que `prefers-reduced-motion` no
      tiene con qué pelear — la única animación del sitio sigue estando apagada
      por `global.css`.
    */
    <div
      ref={caja}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={rotuloDelVisor(titulo)}
      className="fixed inset-0 z-50 flex flex-col bg-tinta"
      onPointerDown={alTocarElFondo}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-2">
        {/*
          El contador, y **el `aria-live` de la capa**: es lo que le dice a quien
          no ve la foto nueva que la flecha hizo algo. Sin él, recorrer la
          galería con el teclado es silencio. Con una sola imagen no se pinta —
          «1 de 1» es ruido— pero el nodo del `aria-live` sí queda, que es la
          condición para que un lector anuncie el cambio (uno que aparece recién
          con el texto adentro no siempre se anuncia).
        */}
        <p aria-live="polite" className="label-caps text-hondo">
          {hayVarias ? posicionEnLaGaleria(indice + 1, galeria.length) : ''}
        </p>
        <button type="button" onClick={cerrar} className={claseBotonDelVisor}>
          Cerrar
        </button>
      </div>

      {/*
        `min-h-0` sobre el `flex-1`: sin eso, un flex hijo no se encoge por
        debajo de su contenido y una imagen alta desborda la pantalla en vez de
        entrar — que es exactamente lo que la capa vino a arreglar.
      */}
      <figure className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4">
        <img
          src={actual.url}
          alt={actual.alt}
          width={actual.ancho ?? undefined}
          height={actual.alto ?? undefined}
          decoding="async"
          referrerPolicy="no-referrer"
          className={claseAficheEnVisor}
        />
        {actual.epigrafe && (
          <figcaption className="body-sm shrink-0 text-hondo">{actual.epigrafe}</figcaption>
        )}
      </figure>

      {hayVarias && (
        <div className="flex items-center justify-between gap-4 px-4 pb-segura">
          {/*
            El nombre accesible va en el `aria-label` y no en el texto visible:
            «Anterior» a secas alcanza en la pantalla, donde se ve que hay una
            foto al lado, y no alcanza para un lector de pantalla, que anuncia el
            botón sin ese contexto. La flecha es un carácter y no un icono: no
            hay librería de iconos en el proyecto y no se agrega una (D-146).
          */}
          <button
            type="button"
            onClick={() => mover(-1)}
            aria-label="Imagen anterior"
            className={claseBotonDelVisor}
          >
            ← Anterior
          </button>
          <button
            type="button"
            onClick={() => mover(1)}
            aria-label="Imagen siguiente"
            className={claseBotonDelVisor}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
