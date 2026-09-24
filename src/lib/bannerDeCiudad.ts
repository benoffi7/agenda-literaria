/**
 * **El banner de una ciudad: lo que aparece cuando el listado se filtra por
 * ella.**
 *
 * La agenda se publica por ciudad —hay un rol `publicador` con su ciudad en el
 * claim (B-919)— y quien publica una ciudad suele tener su propio
 * emprendimiento literario ahí. Esto le da un lugar: cuando alguien pone el
 * filtro **Ciudad → Mar del Plata** en la home, arriba del listado aparece una
 * imagen que lleva al sitio de ese emprendimiento.
 *
 * ── **No es publicidad** — decisión del dueño (2026-09-15) ────────────────
 * Conviene que esté escrito acá porque la primera versión de este archivo asumía
 * lo contrario y se equivocaba, y porque es lo que decide dos cosas del marcado:
 * el banner **no lleva rótulo «Publicidad»** y su enlace **no lleva
 * `rel="sponsored"`** (ver `components/publico/BannerDeCiudad.tsx`). No es
 * espacio vendido: es el proyecto de quien publica esa ciudad en la agenda, así
 * que declararlo como aviso pago —a quien mira, o a Google— sería afirmar algo
 * que no es cierto. El día que sí se venda un espacio, las dos cosas vuelven, y
 * **no alcanza con agregar una fila acá**: es otra decisión.
 *
 * ── Por qué es una lista por ciudad y no un `if` con «Mar del Plata» ──────
 * Porque la segunda ciudad llega sola: el mecanismo es «la ciudad que se
 * filtra», no «Mar del Plata». Escrito como condición suelta en el JSX, la
 * segunda entra copiando la primera y la tercera copiando la segunda, y el día
 * que haya que apagarlos todos hay que ir a buscarlos al marcado. Acá son datos:
 * una fila por ciudad, y el componente no sabe qué ciudades existen.
 *
 * ── La ciudad se compara en **slug**, nunca en lo tipeado ─────────────────
 * El eje `ciudad` del listado (`lib/listadoPublico.ts`) filtra por
 * `sede.ciudad`, que es un `<input>` de texto libre: «Mar del Plata», «mar del
 * plata» y « MAR DEL PLATA » son tres valores distintos y los tres tienen que
 * encontrar el mismo banner. Por eso el match pasa por `slugDeCiudad`, la misma
 * función con la que se escribe `ciudades[]` en el documento y con la que se
 * slugifica la ciudad del claim del publicador. Una comparación contra el texto
 * crudo sería un banner que desaparece el día que alguien carga la sede con otra
 * mayúscula, y sin que nada falle.
 *
 * ── Dos archivos, no uno ──────────────────────────────────────────────────
 * Una sola imagen no sirve para las dos formas de la página: en escritorio el
 * banner ocupa una franja apaisada de ~1080px de ancho, y en el teléfono una
 * caja de ~360px. La misma pieza en los dos lugares o se ve ilegible (la
 * apaisada achicada a 360px) o desperdicia media pantalla (la compacta estirada
 * a 1080px). Así que hay dos, y las elige el `<picture>` con `CORTE_DE_BANNER`.
 *
 * `MEDIDA_ANCHA` y `MEDIDA_COMPACTA` son **las medidas que se le piden a quien
 * manda el arte**, y están acá y no en la doc para que el test las verifique
 * contra los archivos de verdad: un banner declarado con otra relación se pone
 * rojo antes de deformarse en producción.
 *
 * **Lo que se le pide y lo que se declara en la fila son dos cosas distintas, y
 * conviene no confundirlas** (B-962): la fila lleva las medidas **del archivo**,
 * porque `ancho`/`alto` están en el marcado para reservar el espacio. El test
 * compara la **relación** contra estas constantes y las **medidas** contra los
 * bytes del archivo; el primer arte real llegó en 1600×400 y ese desacople es
 * exactamente el caso que lo hizo falta.
 *
 * ── Qué NO hay acá ────────────────────────────────────────────────────────
 * - **El clic se mide, pero no desde acá** (B-963): `clic_banner_ciudad`, con
 *   la ciudad en slug y nada más, lo emite el componente. **Una ciudad nueva en
 *   `BANNERS_DE_CIUDAD` tiene que sumarse también a `CIUDADES_CON_BANNER`** de
 *   `analyticsSitio.ts` —una copia, no un import, por el peso de todas las
 *   páginas—; si no, su clic llega a GA4 como `ciudad=otro`.
 *   `tests/analyticsSitio.test.ts` compara las dos listas y lo frena antes.
 * - **No sale al `events.json` ni a ninguna proyección.** Es contenido del
 *   sitio, del lado del build, y no toca ningún documento de Firestore.
 */
import { slugDeCiudad } from '@/lib/ciudades.mjs';

/** Un archivo del banner, con su tamaño real: los dos van al marcado (§CLS). */
export interface ImagenDeBanner {
  /** Ruta desde la raíz del sitio. El archivo vive en `public/`. */
  src: string;
  ancho: number;
  alto: number;
}

export interface BannerDeCiudad {
  /**
   * El **slug** de la ciudad que lo muestra (`slugDeCiudad`), no el texto que
   * se tipeó en la sede.
   */
  ciudad: string;
  /**
   * De quién es. **No se dibuja**: es lo que anuncia la región
   * (`aria-label`) a quien usa lector de pantalla, porque el banner no lleva
   * rótulo visible.
   */
  nombre: string;
  /** A dónde lleva. Se abre en una pestaña nueva. */
  href: string;
  /**
   * Qué se ve en la imagen, para quien no la ve. Describe **el contenido**, no
   * el rol: «banner de X» no le dice nada a nadie (es el mismo criterio que el
   * `textoAlternativo` de las portadas, B-301).
   */
  textoAlternativo: string;
  /** La apaisada: de `CORTE_DE_BANNER` para arriba. */
  ancha: ImagenDeBanner;
  /** La compacta: el teléfono. */
  compacta: ImagenDeBanner;
}

/**
 * El ancho a partir del cual entra la apaisada. 40rem = 640px, que es donde la
 * columna de contenido deja de ser una tira angosta: abajo de eso una franja
 * 4:1 mide 90px de alto y no se lee nada.
 */
export const CORTE_DE_BANNER = '(min-width: 40rem)';

/**
 * La medida de la apaisada: **2400 × 600** (4:1).
 *
 * El ancho máximo que llega a ocupar es el de la columna de contenido de la
 * home —1440px de contenedor − 80 de márgenes − 240 de riel − 40 de medianil =
 * **1080px**— así que 2400 la cubre con holgura en pantallas de densidad doble.
 */
export const MEDIDA_ANCHA = { ancho: 2400, alto: 600 } as const;

/**
 * La medida de la compacta: **1200 × 900** (4:3).
 *
 * Abajo del corte el banner ocupa el ancho de la pantalla menos los márgenes:
 * entre ~330px (un teléfono chico) y 608px (justo abajo del corte). 1200 alcanza
 * para el doble de densidad en todo ese rango.
 */
export const MEDIDA_COMPACTA = { ancho: 1200, alto: 900 } as const;

/**
 * Los banners declarados, uno por ciudad.
 *
 * **Estuvo vacío a propósito hasta que llegaron los archivos** (B-962, las mandó
 * el dueño el 2026-09-18). Un banner declarado cuyas imágenes no están en
 * `public/` es una imagen rota en producción, y `tests/banner-de-ciudad.test.ts`
 * exige que cada archivo declarado exista: la fila se agrega en el mismo cambio
 * que las dos imágenes, no antes. Es el mismo patrón que `LISTA_DE_CORREO` en
 * `lib/enlaces.ts`, y sigue valiendo para la segunda ciudad.
 *
 * **Las medidas de la apaisada son las del archivo, no las de `MEDIDA_ANCHA`**, y
 * eso es deliberado: el arte llegó en 1600×400 (4:1, la relación correcta) en vez
 * de 2400×600, y `ancho`/`alto` están en el marcado para reservar el espacio
 * (§CLS) — o sea que tienen que ser los del archivo de verdad o el navegador
 * reserva mal. El test compara la **relación**, que es lo que importa para que no
 * se deforme. 1600 cubre la columna de 1080px con holgura en una pantalla común y
 * queda algo justo en densidad doble; se aceptó así, y es tipografía sobre fondo
 * plano, que es lo que menos lo sufre.
 */
export const BANNERS_DE_CIUDAD: readonly BannerDeCiudad[] = [
  {
    ciudad: 'mar-del-plata',
    nombre: 'Biblioguía',
    href: 'https://biblioguia.com.ar/',
    /*
     * Describe **lo que se lee**, que es todo lo que hay en la pieza: es
     * tipografía sobre un fondo liso, sin foto ni escena. Un «banner de
     * Biblioguía» no le diría nada a quien no la ve (B-301).
     *
     * **Y no dice «en Instagram»**, aunque el handle lo parezca: la pieza muestra
     * `@biblioguia.ok` sin nombrar la plataforma, así que agregarla sería una
     * afirmación **nuestra** sobre un tercero, en la home indexada. Lo marcó el
     * `auditor-privacidad` sobre el borrador de esta fila. El alternativo dice lo
     * que se lee y nada más.
     */
    textoAlternativo: 'Biblioguía, portal literario de Mar del Plata, @biblioguia.ok.',
    ancha: { src: '/banners/biblioguia-ancha.webp', ancho: 1600, alto: 400 },
    compacta: { src: '/banners/biblioguia-compacta.webp', ...MEDIDA_COMPACTA },
  },
];

/**
 * El banner que corresponde a las ciudades elegidas en el filtro, o `null`.
 *
 * Recibe los valores **crudos** del eje `ciudad` —lo que hay en `sede.ciudad`—
 * y los slugifica acá: es el único lugar donde esa normalización tiene que
 * pasar, y así ni el componente ni la island saben de slugs.
 *
 * **Se muestra uno solo, el de la primera ciudad elegida que tenga.** El eje es
 * multivalor (se pueden marcar Mar del Plata y Necochea a la vez) y dos banners
 * apilados arriba del listado empujan abajo del pliegue lo que la persona vino a
 * ver. El orden es el de `elegidas`, que es el orden en que se marcaron los
 * chips.
 *
 * `banners` entra por parámetro para que el test pueda ejercitar el mecanismo
 * sin depender de qué ciudades estén contratadas hoy — que es dato, y cambia.
 */
export const bannerParaCiudades = (
  elegidas: readonly string[],
  banners: readonly BannerDeCiudad[] = BANNERS_DE_CIUDAD,
): BannerDeCiudad | null => {
  for (const cruda of elegidas) {
    const slug = slugDeCiudad(cruda);
    if (!slug) continue;
    const banner = banners.find((b) => b.ciudad === slug);
    if (banner) return banner;
  }
  return null;
};
