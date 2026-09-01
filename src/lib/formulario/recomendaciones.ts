/**
 * Lo que conviene tener y **no** bloquea nada — B-264.
 *
 * ── Por qué hace falta un tercer nivel ────────────────────────────────────
 * El formulario ya tenía dos (D-120): lo que se exige para **guardar** y lo que
 * se exige para **publicar**. Los dos los decide el schema y los dos bloquean; la
 * barra los muestra en rojo y en gris respectivamente, pero el gris es solo un
 * adelanto — el día que se publique, frena.
 *
 * El flyer no entra en ninguno de los dos. Bloquear la publicación por una imagen
 * agrega fricción justo donde no conviene: lo que hay que lograr es que se carguen
 * más actividades, y una actividad publicada sin flyer es mucho mejor que una
 * actividad que no se publicó. Pero el campo existe hace días y **no lo usa
 * nadie** —2 de 42—, así que dejarlo sin decir nada tampoco sirve.
 *
 * Entonces: un aviso que dice **qué se pierde**, no qué falta. «Falta el flyer» no
 * mueve a nadie; «sin flyer la actividad no entra en la cartelera» sí, porque
 * nombra una consecuencia concreta que quien organiza quiere evitar.
 *
 * ── Por qué es un módulo puro y no un `&&` en el JSX ──────────────────────
 * Por lo mismo que `camposFaltantes.ts` y que `tarjetaPublica.ts`: los componentes
 * de React de este repo no tienen tests de render (`docs/05-patrones.md`), así que
 * una frase escrita adentro del `.tsx` no se verifica en ninguna parte. Y estas
 * frases deciden si el flyer se carga o no, que es el objetivo entero del cambio.
 */
import { faltaElFlyer } from '@/lib/imagenes';
import type { IdSeccion } from '@/lib/formulario/camposFaltantes';
import type { ActividadForm } from '@/types/actividad';

/** Un consejo, con dónde se resuelve. */
export interface Recomendacion {
  /** Estable: es la clave de React y la que un test nombra. No se renombra. */
  id: string;
  /** El nombre corto, que es lo que se toca para ir hasta el campo. */
  etiqueta: string;
  /** Qué se pierde si no se hace. Una frase, en el idioma de quien carga. */
  porQue: string;
  /** La sección que hay que abrir y hasta donde hay que scrollear. */
  seccion: IdSeccion;
}

/**
 * Los consejos que aplican a este formulario, en orden de importancia.
 *
 * Hoy hay uno. La lista existe igual —y no un booleano— porque el segundo va a
 * llegar (el epígrafe, las etiquetas) y con un booleano el segundo obliga a
 * rehacer la barra.
 */
export const recomendacionesDelFormulario = (form: ActividadForm): Recomendacion[] => {
  const recomendaciones: Recomendacion[] = [];

  if (faltaElFlyer(form.imagenes)) {
    recomendaciones.push({
      id: 'flyer',
      etiqueta: 'el flyer',
      /*
       * Las dos consecuencias son ciertas y las dos son verificables mirando el
       * sitio: `/cartelera` se arma con las que tienen imagen, y el `og:image`
       * del detalle sale de la portada. No se promete nada que el sitio no haga.
       */
      porQue: 'sin imagen no entra en la cartelera y el link se comparte sin nada que mirar',
      seccion: 'que-es',
    });
  }

  return recomendaciones;
};
