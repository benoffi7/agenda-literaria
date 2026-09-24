import { foco } from '@/components/sitio/estilos';
import { CORTE_DE_BANNER, type BannerDeCiudad as Banner } from '@/lib/bannerDeCiudad';
import { medirSitio } from '@/lib/medicionSitio';

/**
 * El banner de la ciudad filtrada, arriba del listado.
 *
 * Lo decide quien lo monta (`Buscador`): este componente solo dibuja el banner
 * que le pasan, igual que `GuardarBusqueda` no decide si hay algo que guardar.
 * Los datos y la regla de «cuál corresponde» viven en `lib/bannerDeCiudad.ts`.
 *
 * ── No es publicidad, y por eso no dice «Publicidad» ni lleva `sponsored` ──
 * **Decisión del dueño (2026-09-15), y la primera versión de este archivo la
 * tenía al revés.** Lo que se muestra es el proyecto de quien publica esa ciudad
 * en la agenda: no es un espacio vendido, así que rotularlo como aviso pago
 * declararía algo que no es cierto, y `rel="sponsored"` se lo declararía a
 * Google —ese valor significa «este enlace es publicidad o está pago»—.
 *
 * Lo que sí queda del planteo anterior es **que no se lea como una fila del
 * listado**: no lo resuelve un rótulo sino la forma —caja con borde, ancho
 * completo, separada— y el `alt`, que dice qué es. Lo que no se puede es dejarlo
 * sin identificar: por eso el `aside` lleva el nombre en su `aria-label`, que es
 * lo que anuncia un lector de pantalla al entrar en la región.
 *
 * ── Dos archivos, un `<picture>` ──────────────────────────────────────────
 * La apaisada de `CORTE_DE_BANNER` para arriba, la compacta abajo. Los dos
 * `width`/`height` van en el marcado —también en el `<source>`— para que el
 * navegador reserve el alto antes de bajar la imagen: sin eso el listado salta
 * hacia abajo cuando el banner termina de cargar, justo mientras alguien lo está
 * leyendo.
 *
 * ── Pestaña nueva, con `noopener` y **sin `noreferrer`** ──────────────────
 * Quien está filtrando la agenda no pierde el filtro que armó, y `noopener`
 * impide que la página destino toque ésta.
 *
 * Lo de `noreferrer` es la decisión que `/apoyar` dejó pedida (`apoyar.astro`,
 * el bloque del `rel`): omitirlo era aceptable «mientras el enlace salga de una
 * página cuya URL no diga nada», y **éste es justo el caso que ese comentario
 * anticipaba** — el primer enlace saliente de la home, cuya query string lleva
 * los filtros y el texto tipeado en el buscador. Se verificó, y la omisión sigue
 * estando bien: el repo no declara ningún `Referrer-Policy`, así que rige el
 * default del navegador (`strict-origin-when-cross-origin`) y al destino le
 * llega el origen pelado, sin la ruta y sin la query. **Hay que volver a
 * decidirlo si** alguna página declara un `Referrer-Policy` más laxo, o si este
 * banner se monta en una página cuya ruta diga algo (una ficha, un detalle).
 * Lo pidió el `auditor-privacidad`.
 *
 * ── El destino lo escribe quien tiene commit, y por eso no pasa por `urlSegura`
 * `banner.href` sale de `BANNERS_DE_CIUDAD`, una constante del repo: no hay
 * texto de ningún formulario en el camino, que es lo que `urlSegura`
 * (`lib/enlaceSeguro.ts`) existe para sanear. Lo que sostiene esa premisa es el
 * chequeo de `tests/banner-de-ciudad.test.ts`, que exige `https:` en cada banner
 * declarado **y se prueba a sí mismo** contra banners de mentira, que es lo que lo
 * mantiene honesto ahora que la lista real tiene una fila (B-962) y lo que lo
 * mantenía vivo cuando estaba vacía. **El día que un banner venga de un documento** —cargarlo
 * desde el panel es la continuación natural de esto— **este `href` tiene que
 * pasar por `urlSegura` antes de entrar al marcado.**
 *
 * ── El clic se mide, con la ciudad y nada más — B-963 ─────────────────────
 * `clic_banner_ciudad` lleva **`banner.ciudad`**, que es el slug de la fila de
 * `BANNERS_DE_CIUDAD`, y ningún otro campo: ni `href` ni `nombre`, que son
 * función de la ciudad y el primero es justo lo que «Clics salientes» apagado
 * en GA4 existe para no mandar (el porqué entero está en `EVENTOS_SITIO`).
 * `medirSitio` no manda nada si no hubo «aceptar» — la guarda del
 * consentimiento es suya, no de este componente.
 *
 * **El handler va acá y no en `Buscador`**, a diferencia del tríptico, y el
 * motivo de aquel caso no aplica: `PanelesDeAhora` lo pintan el build **y** la
 * island, y el del build no se hidrata. Este componente lo monta **solo** la
 * island (`Buscador`, detrás de `indice`, que recién existe en el navegador), así
 * que el `onClick` corre en su único uso, y `medicionSitio` ya viene en ese chunk.
 *
 * **Mide el clic, no la rueda del mouse**: un clic del medio abre la pestaña con
 * `auxclick` y no se cuenta. Se aceptó así — el tríptico tiene el mismo borde, y
 * dos criterios distintos entre eventos hermanos serían peores que el faltante.
 */

interface Props {
  banner: Banner;
}

export const BannerDeCiudad = ({ banner }: Props) => (
  <aside className="mt-6" aria-label={banner.nombre}>
    <a
      href={banner.href}
      target="_blank"
      rel="noopener"
      className={`block ${foco}`}
      onClick={() => medirSitio('clic_banner_ciudad', { ciudad: banner.ciudad })}
    >
      <picture>
        <source
          media={CORTE_DE_BANNER}
          srcSet={banner.ancha.src}
          width={banner.ancha.ancho}
          height={banner.ancha.alto}
        />
        <img
          src={banner.compacta.src}
          alt={banner.textoAlternativo}
          width={banner.compacta.ancho}
          height={banner.compacta.alto}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full border border-borde"
        />
      </picture>
    </a>
  </aside>
);
