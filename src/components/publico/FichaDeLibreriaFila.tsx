import { claseBloque, claseEnlace, claseRotulo } from '@/components/sitio/estilos';
import type { FichaDeLibreria } from '@/lib/libreriaPublica';

/**
 * Una librería en el listado de `/guia/librerias` — B-831.
 *
 * ── Por qué es un componente de React y no markup en el `.astro` ──────────
 * Por lo mismo que `FilaDeActividad`: **la misma fila la pinta el build y la
 * pinta la island** después de hidratar con `/librerias.json`. Con dos markups,
 * la lista cambia de aspecto al cargar el JSON —el parpadeo que el §6.3 evita— y
 * cualquier corrección hay que hacerla dos veces (la clase de B-88).
 *
 * ── Sin imágenes, como el listado de la agenda ────────────────────────────
 * `ListaDeActividades` lo dice de su propia lista: «el listado no tiene imágenes,
 * así que no hay nada que priorizar y la página no pide un solo byte de imagen. Es
 * la mejora de rendimiento más grande del rediseño y salió de una decisión de
 * diseño, no de una optimización». Vale igual acá y por partida doble: lo que se
 * recorre en un directorio es el **nombre y el barrio**, y una tira de fotos
 * convierte la lista en una pared —que es `/cartelera`, la página de al lado—.
 *
 * ⚠️ Esto revisa el criterio de aceptación 10 del PRD («el peso de
 * `/guia/librerias` con 40 fichas **y sus miniaturas** se mide y se anota»): sin
 * imágenes en el listado no hay miniaturas que medir, y el peso que queda es
 * texto. Las fotos siguen estando, en la ficha (§ 4 del PRD, criterio de B-296).
 *
 * Es puro: recibe la ficha ya armada por `libreriaPublica.ts` y no deriva nada
 * del documento. No importa nada de `components/admin/`, que es lo que
 * `tests/bundle-panel.test.ts` verifica de todo lo que llega a una página pública.
 */
export function FichaDeLibreriaFila({ ficha }: { ficha: FichaDeLibreria }) {
  return (
    <li className={`flex min-w-0 flex-col p-5 sm:p-6 ${claseBloque}`}>
      <p className={claseRotulo}>
        {ficha.barrio}
        {ficha.ciudad ? ` · ${ficha.ciudad}` : ''}
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
    </li>
  );
}
