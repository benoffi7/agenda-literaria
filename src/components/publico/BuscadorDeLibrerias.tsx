import { useEffect, useId, useMemo, useState } from 'react';
import { FichaDeLibreriaFila } from '@/components/publico/FichaDeLibreriaFila';
import { claseBotonBloque, claseCampo, claseEtiquetaDeCampo } from '@/components/sitio/estilos';
import { fichaDeLibreria, type IndiceDeLibrerias } from '@/lib/libreriaPublica';
import { normalize } from '@/lib/normalize';
import type { FichaDeLibreria } from '@/lib/libreriaPublica';

/**
 * La island de `/guia/librerias`: búsqueda por texto y filtro por barrio — B-831,
 * § 4 del PRD 2.
 *
 * ── El HTML es la verdad; `librerias.json` es el índice ───────────────────
 * El mismo contrato que el listado de la agenda (§6.3): el build imprime **todas**
 * las fichas en el HTML, así que la página sirve completa con JavaScript apagado
 * y Google la ve entera. Esta island hace **un solo fetch** de `/librerias.json`
 * (§2.5) y recién cuando lo tiene saca del DOM la lista del build y pasa a
 * renderizar la suya, con el **mismo** componente de fila — por eso no hay
 * parpadeo: sin filtros, lo que aparece es idéntico a lo que había.
 *
 * Si el fetch falla (offline, CDN caída) **no se saca nada**: la lista del build
 * sigue ahí y los controles quedan deshabilitados con un aviso chico. Nunca una
 * pantalla vacía.
 *
 * ── Dos ejes y no seis ───────────────────────────────────────────────────
 * Barrio y texto, que es lo que el PRD fija para la v1: «con 40 librerías un
 * filtro de más es ruido». Por eso tampoco hay riel, ni hoja modal, ni
 * serialización a la query string — las tres piezas que el buscador de la agenda
 * tiene porque ahí hay seis ejes y cientos de filas. Copiarlas acá sería traer la
 * complejidad sin el problema.
 *
 * ── Las etiquetas de los chips viajan en el JSON ─────────────────────────
 * §4.4: «la web arma los chips de filtro recorriendo `opciones.*` — nada
 * hardcodeado». Acá es `indice.barrios`, que el build ya recortó a los barrios
 * con alguna librería publicada: un chip que promete cero resultados es ruido.
 *
 * No importa nada de `components/admin/` (`tests/bundle-panel.test.ts`).
 */
interface Props {
  /**
   * La versión del build, como `?v=` del fetch. Con `no-cache` no hace falta para
   * el CDN, pero blinda contra un intermediario mal configurado que sirva el JSON
   * del build anterior contra el HTML del nuevo (§9) — mismo motivo que en la home.
   */
  version: string;
  /** El `id` de la lista que imprimió el build, para sacarla al tomar el control. */
  idListadoEstatico: string;
}

type Carga =
  | { estado: 'cargando' }
  | { estado: 'listo'; indice: IndiceDeLibrerias }
  | { estado: 'error' };

export function BuscadorDeLibrerias({ version, idListadoEstatico }: Props) {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [texto, setTexto] = useState('');
  const [barrio, setBarrio] = useState<string | null>(null);
  const idBusqueda = useId();

  useEffect(() => {
    let vigente = true;
    fetch(`/librerias.json?v=${encodeURIComponent(version)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<IndiceDeLibrerias>;
      })
      .then((indice) => {
        if (!vigente) return;
        setCarga({ estado: 'listo', indice });
        // Recién acá se saca la lista del build: si se sacara antes, un fetch que
        // falla dejaría la página sin contenido.
        document.getElementById(idListadoEstatico)?.remove();
      })
      .catch(() => {
        if (vigente) setCarga({ estado: 'error' });
      });
    return () => {
      vigente = false;
    };
  }, [version, idListadoEstatico]);

  const indice = carga.estado === 'listo' ? carga.indice : null;

  /**
   * Las fichas filtradas.
   *
   * La etiqueta del barrio sale del propio índice y el hub **no se linkea desde
   * acá**: cuál barrio tiene página lo sabe el build (`fichasDeLibreria`), no el
   * navegador. Antes que publicar un enlace a ciegas —que sería un 404 en cada
   * barrio sin actividades— la fila re-renderizada muestra el barrio como texto,
   * igual que la del build cuando el hub no existe.
   */
  const fichas: FichaDeLibreria[] = useMemo(() => {
    if (!indice) return [];
    const etiquetas = new Map(indice.barrios.map((b) => [b.slug, b.label]));
    const aguja = normalize(texto).trim();
    return indice.librerias
      .filter((l) => (barrio ? l.barrio === barrio : true))
      .filter((l) => (aguja ? l.searchText.includes(aguja) : true))
      .map((l) => fichaDeLibreria(l, { etiquetaDeBarrio: etiquetas.get(l.barrio) }));
  }, [indice, texto, barrio]);

  const deshabilitado = carga.estado !== 'listo';

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4">
        <div>
          <label className={claseEtiquetaDeCampo} htmlFor={idBusqueda}>
            Buscar
          </label>
          <input
            id={idBusqueda}
            type="search"
            className={claseCampo}
            placeholder="Nombre, dirección o barrio"
            value={texto}
            disabled={deshabilitado}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>

        {indice && indice.barrios.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {/*
              «Todos» es un botón más y no la ausencia de botones: sin él, quitar
              un barrio elegido obliga a volver a tocar el mismo chip, que es un
              gesto que nadie descubre.
            */}
            <button
              type="button"
              aria-pressed={barrio === null}
              onClick={() => setBarrio(null)}
              className={`${claseBotonBloque} ${barrio === null ? 'bg-tinta text-papel' : ''}`}
            >
              Todos
            </button>
            {indice.barrios.map((b) => (
              <button
                key={b.slug}
                type="button"
                aria-pressed={barrio === b.slug}
                onClick={() => setBarrio(barrio === b.slug ? null : b.slug)}
                className={`${claseBotonBloque} ${barrio === b.slug ? 'bg-tinta text-papel' : ''}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {carga.estado === 'error' && (
        <p className="body-sm mt-4 text-super">
          No se pudo cargar el buscador. La lista de abajo sigue completa.
        </p>
      )}

      {indice && (
        <>
          <p className="label-caps mt-8 text-azul">
            {fichas.length === 0
              ? 'Ninguna librería con ese filtro'
              : `${fichas.length} ${fichas.length === 1 ? 'librería' : 'librerías'}`}
          </p>
          <ul className="mt-4 flex flex-col gap-4">
            {fichas.map((f) => (
              <FichaDeLibreriaFila key={f.slug} ficha={f} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
