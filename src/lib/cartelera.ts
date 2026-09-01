/**
 * La pared de afiches de `/cartelera` — B-265, D-148.
 *
 * ── Para qué existe la página ─────────────────────────────────────────────
 * El flyer es el medio de difusión del circuito literario, y hasta B-264 el
 * sitio lo trataba como un adorno: 2 actividades con imagen sobre 42, y las que
 * la tenían la mostraban en un solo lugar —la cabecera de su propia página—
 * donde solo llega quien ya decidió entrar.
 *
 * Una cartelera le da al flyer un lugar propio: **todos, grandes, uno al lado
 * del otro**, cada uno enlazando a su actividad. Es la mitad que hace que valga
 * la pena cargarlos, y es lo que la recomendación del panel promete cuando dice
 * «sin imagen no entra en la cartelera». Las dos mitades tienen que existir a la
 * vez o la promesa es falsa.
 *
 * ── De dónde salen los datos, y por qué de ahí ────────────────────────────
 * De `DetallePublico`, el view-model que ya arma `detallePublico.ts` para la
 * página de cada actividad. **No** de una segunda proyección del documento, y
 * **nunca** de un listado de Storage — la trampa 13 del §13 es exactamente eso:
 * `allow list` está cerrado a propósito y un `listAll()` devolvería también los
 * flyers de las actividades en borrador. La cartelera se arma desde el índice de
 * lo publicado, igual que el resto del sitio.
 *
 * Reusar `DetallePublico` tiene además la consecuencia que importa para el §5:
 * la frontera de privacidad ya es un tipo (D-140) y ya está auditada. Esta
 * proyección solo **saca** campos; no puede agregar ninguno que aquella no haya
 * decidido publicar. `storagePath` no está ahí, así que tampoco puede estar acá.
 *
 * Puro y sin red, como el resto de `src/lib`: el `.astro` no se puede importar
 * desde vitest, así que lo que decida qué entra a la pared tiene que vivir acá.
 */
import { rutaDeDetalle } from '@/lib/rutasPublicas';
import type { DetallePublico } from '@/lib/detallePublico';

/** Un afiche pegado en la pared. */
export interface Afiche {
  /** Para la clave de React/Astro y para el enlace. */
  slug: string;
  ruta: string;
  titulo: string;
  tipoEtiqueta: string;
  url: string;
  /**
   * El pie de foto que cargó quien organiza, si lo cargó. Se muestra tal cual;
   * **no** es el texto alternativo (DEC-7a, D-125).
   */
  epigrafe: string;
  ancho: number | null;
  alto: number | null;
  /** «viernes 12 de septiembre», el mismo texto que la ficha del detalle. */
  cuando: string;
  /** «Casa Brandon · Boedo» o «Online por Meet». */
  donde: string;
  /** La misma fecha, ordenable. No se pinta. */
  iso: string;
}

/**
 * Los afiches de la pared, en el orden en que se leen.
 *
 * Tres decisiones, y las tres se pueden discutir mirando esta función:
 *
 * **1 · Una por actividad, la portada.** Una actividad puede tener hasta cuatro
 * imágenes y las otras tres suelen ser fotos del espacio o de ediciones
 * anteriores. Una pared con las cuatro deja de ser una pared de flyers y pasa a
 * ser un álbum. `portada` es justamente el flag de «esta es la que quiero que se
 * vea al compartir» (D-125), o sea la que ya significa *afiche*.
 *
 * `DetallePublico.imagenes[0]` **es** la portada, y desde B-268 eso es cierto de
 * verdad: `detalleDeActividad` pone primera la que tiene el flag, no la que se
 * cargó primero. Hasta entonces tiraba el flag y confiaba en el orden del array,
 * así que marcar el flyer como portada en el panel no cambiaba nada — ni acá ni
 * en la cabecera de la actividad, coherentemente equivocadas las dos.
 *
 * Que las dos páginas muestren la misma imagen no es casualidad: las dos leen el
 * mismo índice del mismo view-model.
 *
 * **2 · Solo lo que todavía va a pasar.** La misma regla que la home
 * (`vigentesDelIndice`). Una pared de afiches de cosas que ya ocurrieron es un
 * museo, y el clic lleva a una página que arranca con «esta actividad ya pasó».
 * Si algún día vale la pena, el archivo es otra página y no esta.
 *
 * **3 · Por fecha, la más próxima primero.** Es el orden por defecto del listado
 * y el único que le sirve a alguien que está decidiendo a qué ir. El desempate
 * es el título, para que dos actividades del mismo día no se ordenen distinto en
 * cada build —el orden de lectura de Firestore no está garantizado— y la página
 * no cambie sin que haya cambiado nada.
 */
export const carteleraDeDetalles = (detalles: readonly DetallePublico[]): Afiche[] =>
  detalles
    .flatMap((d) => {
      const portada = d.imagenes[0];
      // Sin imagen no hay afiche, y sin fecha próxima tampoco: las dos son la
      // condición de entrar a la pared, no un caso de error.
      if (!portada?.url || !d.proxima) return [];
      return [
        {
          slug: d.slug,
          ruta: rutaDeDetalle(d.slug),
          titulo: d.titulo,
          tipoEtiqueta: d.tipoEtiqueta,
          url: portada.url,
          epigrafe: portada.epigrafe,
          ancho: portada.ancho,
          alto: portada.alto,
          cuando: d.proxima.fecha,
          donde: d.donde,
          iso: d.proxima.iso,
        } satisfies Afiche,
      ];
    })
    .sort((a, b) => a.iso.localeCompare(b.iso) || a.titulo.localeCompare(b.titulo, 'es'));
