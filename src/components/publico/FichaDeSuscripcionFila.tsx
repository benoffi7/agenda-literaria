import { claseBloque, claseEnlace, claseRotulo } from '@/components/sitio/estilos';
import type { FichaDeSuscripcion } from '@/lib/suscripcionPublica';

/**
 * Una suscripción en el listado de `/guia/suscripciones` — B-832.
 *
 * ── Por qué es un componente de React y no markup en el `.astro` ──────────
 * Por lo mismo que `FichaDeLibreriaFila` y que `FilaDeActividad`: **la misma fila
 * la pinta el build y la pinta la island** después de hidratar con
 * `/suscripciones.json`. Con dos markups, la lista cambia de aspecto al cargar el
 * JSON y cualquier corrección hay que hacerla dos veces (la clase de B-88).
 *
 * ── Sin imágenes, como los otros dos listados ────────────────────────────
 * Lo que se recorre en un directorio es el **nombre y las condiciones**; una tira
 * de fotos convierte la lista en una pared —que es `/cartelera`, la página de al
 * lado—. Las fotos siguen estando, en la ficha.
 *
 * ── El precio se muestra **entero o no se muestra** ──────────────────────
 * `ficha.precio` ya es la frase con su fecha adentro (DEC-12): acá no hay un
 * número que formatear ni una fecha que pegar, y por eso **no se puede** pintar
 * el precio sin su fecha aunque la fila sea angosta. Es la garantía de D-570
 * llegando hasta la última pantalla, que es exactamente el modo de falla que ese
 * diseño anticipa: «la primera pantalla lo pinta bien y la cuarta pinta el valor
 * solo».
 *
 * Es puro: recibe la ficha ya armada por `suscripcionPublica.ts` y no deriva nada
 * del documento. No importa nada de `components/admin/`, que es lo que
 * `tests/bundle-panel.test.ts` verifica de todo lo que llega a una página pública.
 */
export function FichaDeSuscripcionFila({ ficha }: { ficha: FichaDeSuscripcion }) {
  const alcance = ficha.alcance.filter(Boolean).join(' · ');
  const queManda = ficha.envio.manda
    ? ficha.envio.tematica
      ? `Manda libros de ${ficha.envio.tematica}`
      : 'Manda libros'
    : 'Sin envío de libros';

  return (
    <li className={`flex min-w-0 flex-col p-5 sm:p-6 ${claseBloque}`}>
      <p className={claseRotulo}>
        {ficha.ofrecidaPor.nombre}
        {ficha.periodicidad ? ` · ${ficha.periodicidad}` : ''}
      </p>

      <h2 className="headline-sm mt-1 text-tinta">
        <a className={claseEnlace} href={ficha.ruta}>
          {ficha.nombre}
        </a>
      </h2>

      <p className="body-sm mt-1 text-super">
        {queManda}
        {alcance ? ` · ${alcance}` : ''}
      </p>

      {ficha.descripcion && (
        <p className="body-md mt-3 max-w-[65ch] text-super">{ficha.descripcion}</p>
      )}

      {/*
        La frase entera, tal como la armó el módulo puro. Si no hay precio —o si
        su fecha no es usable— `ficha.precio` es `''` y acá no se pinta nada, que
        es lo correcto: un precio sin fecha no se publica.
      */}
      {ficha.precio && <p className="body-sm mt-3 text-suave">{ficha.precio}</p>}
    </li>
  );
}
