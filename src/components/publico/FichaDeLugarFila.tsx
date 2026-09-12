import { claseBloque, claseEnlace, claseRotulo } from '@/components/sitio/estilos';
import type { FichaDeLugar } from '@/lib/lugarPublico';

/**
 * Un lugar en el listado de `/guia/lugares` — B-833.
 *
 * ── Por qué es un componente de React y no markup en el `.astro` ──────────
 * Por lo mismo que `FichaDeLibreriaFila` y `FichaDeSuscripcionFila`: **la misma
 * fila la pinta el build y la pinta la island** después de hidratar con
 * `/lugares.json`. Con dos markups, la lista cambia de aspecto al cargar el JSON
 * y cualquier corrección hay que hacerla dos veces (la clase de B-88).
 *
 * ── Sin imágenes, como los otros dos listados ────────────────────────────
 * Lo que se recorre en un directorio es el **nombre y las condiciones**; una tira
 * de fotos convierte la lista en una pared —que es `/cartelera`, la página de al
 * lado—. Las fotos siguen estando, en la ficha.
 *
 * ── El orden de lo que dice la fila es el § 9 del PRD, no una preferencia ─
 * «El lugar se presenta por lo que permite hacer, no por lo que cuesta.» Por eso
 * la fila dice primero **qué es y dónde queda**, después **para cuántos y qué
 * incluye**, y el precio al final y en gris. El contra del § 9 es que esta
 * sección se convierta en una inmobiliaria de salones, y la mitigación «es de
 * producto, no de código»: esto es esa mitigación, escrita en el orden de dos
 * párrafos.
 *
 * ── La dirección **no se pinta acá aunque venga** ────────────────────────
 * Ni siquiera cuando el flag la dejó salir. En el listado no aporta —lo que se
 * recorre es el barrio— y servirla en lote es la salida más barata de cosechar
 * (D-129). La ficha la tiene, que es donde alguien la lee cuando ya decidió ir.
 *
 * Es puro: recibe la ficha ya armada por `lugarPublico.ts` y no deriva nada del
 * documento. No importa nada de `components/admin/`, que es lo que
 * `tests/bundle-panel.test.ts` verifica de todo lo que llega a una página
 * pública.
 */
export function FichaDeLugarFila({ ficha }: { ficha: FichaDeLugar }) {
  const que = [ficha.tipo, ficha.donde.barrio].filter(Boolean).join(' · ');
  const paraCuantos = ficha.capacidad
    ? `Hasta ${ficha.capacidad} personas`
    : ficha.capacidadNotas
      ? ficha.capacidadNotas
      : '';
  const incluye = ficha.incluye.filter(Boolean).slice(0, 4).join(' · ');

  return (
    <li className={`flex min-w-0 flex-col p-5 sm:p-6 ${claseBloque}`}>
      <p className={claseRotulo}>{que}</p>

      <h2 className="headline-sm mt-1 text-tinta">
        <a className={claseEnlace} href={ficha.ruta}>
          {ficha.nombre}
        </a>
      </h2>

      {(paraCuantos || ficha.condicion) && (
        <p className="body-sm mt-1 text-super">
          {[paraCuantos, ficha.condicion].filter(Boolean).join(' · ')}
        </p>
      )}

      {ficha.descripcion && (
        <p className="body-md mt-3 max-w-[65ch] text-super">{ficha.descripcion}</p>
      )}

      {incluye && <p className="body-sm mt-3 text-super">{incluye}</p>}

      {/*
        La frase entera, tal como la armó el módulo puro. Si no hay precio —o si
        su fecha no es usable— `ficha.precio` es `''` y acá no se pinta nada, que
        es lo correcto: un precio sin fecha no se publica (D-570). Va al final y
        en la tinta suave, que es el § 9 del PRD hecho jerarquía visual.
      */}
      {ficha.precio && <p className="body-sm mt-3 text-suave">{ficha.precio}</p>}
    </li>
  );
}
