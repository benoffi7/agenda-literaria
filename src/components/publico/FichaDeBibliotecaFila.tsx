import { claseBloque, claseEnlace, claseRotulo } from '@/components/sitio/estilos';
import type { FichaDeBiblioteca } from '@/lib/bibliotecaPublica';

/**
 * Una biblioteca en el listado de `/guia/bibliotecas` — B-960.
 *
 * ── Por qué es un componente de React y no markup en el `.astro` ──────────
 * Por lo mismo que `FilaDeActividad` y que la fila de una librería: **la misma
 * fila la pinta el build y la pinta la island** después de hidratar con
 * `/bibliotecas.json`. Con dos markups, la lista cambia de aspecto al cargar el
 * JSON —el parpadeo que el §6.3 evita— y cualquier corrección hay que hacerla
 * dos veces (la clase de B-88).
 *
 * ── Sin imágenes, como el resto de los listados ───────────────────────────
 * Lo que se recorre en un directorio es el **nombre y el barrio**, y una tira de
 * fotos convierte la lista en una pared —que es `/cartelera`, la página de al
 * lado—. Las fotos siguen estando, en la ficha.
 *
 * ── Qué se muestra acá y qué se deja para la ficha ────────────────────────
 * De los cuatro campos propios de una biblioteca, en la fila entran **dos**: el
 * tipo, que es el eje de filtro y ubica de un vistazo, y si hace falta
 * asociarse, que es la pregunta que decide si vale la pena ir. El horario de
 * sala y el catálogo se leen en la ficha.
 *
 * **El costo NO entra a la fila**, y es deliberado: sale como frase con su fecha
 * pegada («$3.000 por año · cargado el 17 de septiembre de 2026») y eso ocupa un
 * renglón entero que en una lista de cuarenta fichas es ruido. Lo que la fila
 * contesta es el binario —hace falta o no—, que es estable y no envejece. El
 * número, con su fecha al lado para poder juzgarlo, está a un click.
 *
 * Es puro: recibe la ficha ya armada por `bibliotecaPublica.ts` y no deriva nada
 * del documento. No importa nada de `components/admin/`, que es lo que
 * `tests/bundle-panel.test.ts` verifica de todo lo que llega a una página
 * pública.
 */
export function FichaDeBibliotecaFila({ ficha }: { ficha: FichaDeBiblioteca }) {
  return (
    <li className={`flex min-w-0 flex-col p-5 sm:p-6 ${claseBloque}`}>
      {/*
        El mismo renglón que la ficha, con la regla de CABA. Acá **sin enlaces**:
        la fila entera ya lleva al detalle, y un `<a>` adentro de otro sería un
        ancla anidada — el mismo criterio que la cartelera.

        El tipo va pegado a la zona y no en un renglón propio: es una etiqueta
        corta («Popular», «Universitaria») y separarla le daría el peso de un
        dato que no tiene.
      */}
      <p className={claseRotulo}>
        {[...ficha.zona.map((p) => p.texto), ficha.tipo].filter(Boolean).join(' · ')}
      </p>

      <h2 className="headline-sm mt-1 text-tinta">
        <a className={claseEnlace} href={ficha.ruta}>
          {ficha.nombre}
        </a>
      </h2>

      <p className="body-sm mt-1 text-super">{ficha.direccion}</p>

      {ficha.descripcion && (
        <p className="body-md mt-3 max-w-[65ch] text-super">{ficha.descripcion}</p>
      )}

      {/*
        Si hace falta asociarse. Se dice **solo cuando hace falta**: «no hace
        falta asociarse» en cuarenta fichas es una línea que nadie lee, y la
        ausencia ya significa eso.
      */}
      {ficha.asociarse.haceFalta && (
        <p className="body-sm mt-2 text-super">Hay que asociarse para llevarse libros.</p>
      )}
    </li>
  );
}
