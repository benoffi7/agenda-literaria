import { useEffect, useId, useMemo, useState } from 'react';
import { FichaDeSuscripcionFila } from '@/components/publico/FichaDeSuscripcionFila';
import { claseBotonBloque, claseCampo, claseEtiquetaDeCampo } from '@/components/sitio/estilos';
import { normalize } from '@/lib/normalize';
import {
  EJES_DE_SUSCRIPCION,
  fichaDeSuscripcion,
  type EjeDeSuscripcion,
  type FichaDeSuscripcion,
  type IndiceDeSuscripciones,
} from '@/lib/suscripcionPublica';

/**
 * La island de `/guia/suscripciones`: búsqueda por texto y los cuatro filtros del
 * § 5 del PRD — B-832.
 *
 * ── El HTML es la verdad; `suscripciones.json` es el índice ──────────────
 * El mismo contrato que el listado de la agenda (§6.3) y que el de librerías: el
 * build imprime **todas** las fichas en el HTML, así que la página sirve completa
 * con JavaScript apagado y Google la ve entera. Esta island hace **un solo
 * fetch** (§2.5) y recién cuando lo tiene saca del DOM la lista del build y pasa
 * a renderizar la suya, con el **mismo** componente de fila. Si el fetch falla,
 * la lista del build se queda y los controles quedan deshabilitados.
 *
 * ── Los cuatro filtros, en el orden que el PRD fija ──────────────────────
 * 1. **¿Manda libros?** — parte el catálogo en dos mundos. Es el único que no
 *    sale de una taxonomía: es el booleano `envio.manda`, así que sus dos chips
 *    se escriben acá y no vienen del JSON.
 * 2. **Editoriales** — `independientes` es la consulta del circuito.
 * 3. **Alcance** — si no llega a tu ciudad, el resto no importa.
 * 4. **Periodicidad** — el menos útil, va último.
 *
 * Los tres últimos salen de `indice.filtros`, que el build ya recortó a los
 * valores con alguna ficha detrás (§4.4: «la web arma los chips recorriendo
 * `opciones.*` — nada hardcodeado»).
 *
 * ── Y lo que NO hay, que es la mitad que importa ─────────────────────────
 * **Sin filtro de precio y sin orden por precio** — § 5 y § 6 del PRD, DEC-12.
 * No hace falta vigilarlo con disciplina: `ficha.precio` es un **string con la
 * frase armada**, así que acá no hay número que comparar ni por el que ordenar
 * (D-570). Filtrar por precio afirma que los precios son comparables entre sí, y
 * no lo son si uno tiene una semana y otro cuatro meses.
 *
 * Tampoco hay riel, ni hoja modal, ni serialización a la query string: son las
 * piezas que el buscador de la agenda tiene porque ahí hay seis ejes y cientos de
 * filas. Con quince fichas, copiarlas sería traer la complejidad sin el problema.
 *
 * No importa nada de `components/admin/` (`tests/bundle-panel.test.ts`).
 */
interface Props {
  /**
   * La versión del build, como `?v=` del fetch. Con `no-cache` no hace falta para
   * el CDN, pero blinda contra un intermediario mal configurado que sirva el JSON
   * del build anterior contra el HTML del nuevo (§9).
   */
  version: string;
  /** El `id` de la lista que imprimió el build, para sacarla al tomar el control. */
  idListadoEstatico: string;
}

type Carga =
  | { estado: 'cargando' }
  | { estado: 'listo'; indice: IndiceDeSuscripciones }
  | { estado: 'error' };

/** Cómo se llama cada eje en pantalla. El JSON trae los valores, no el rótulo. */
const TITULO_DEL_EJE: Record<EjeDeSuscripcion, string> = {
  'perfil-editorial': 'Editoriales',
  'alcance-envio': 'A dónde llega',
  periodicidad: 'Cada cuánto',
};

/** De qué campo de la ficha sale cada eje, para filtrar. */
const COINCIDE: Record<EjeDeSuscripcion, (s: IndiceDeSuscripciones['suscripciones'][number], slug: string) => boolean> = {
  'perfil-editorial': (s, slug) => s.envio.editoriales === slug,
  'alcance-envio': (s, slug) => s.alcance.includes(slug),
  periodicidad: (s, slug) => s.periodicidad === slug,
};

export function BuscadorDeSuscripciones({ version, idListadoEstatico }: Props) {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [texto, setTexto] = useState('');
  /** `null` = «todas». El booleano del primer filtro, en tres estados. */
  const [manda, setManda] = useState<boolean | null>(null);
  const [elegidos, setElegidos] = useState<Partial<Record<EjeDeSuscripcion, string>>>({});
  const idBusqueda = useId();

  useEffect(() => {
    let vigente = true;
    fetch(`/suscripciones.json?v=${encodeURIComponent(version)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<IndiceDeSuscripciones>;
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
   * Las etiquetas salen del propio índice, y **el enlace a la librería que la
   * ofrece no se arma acá**: cuál librería está publicada lo sabe el build
   * (`fichasDeSuscripcion`), no el navegador. Antes que publicar un enlace a
   * ciegas —que sería un 404 en cada suscripción cuya librería espera decisión—
   * la fila re-renderizada muestra el nombre como texto, igual que la del build
   * cuando la librería no está.
   */
  const fichas: FichaDeSuscripcion[] = useMemo(() => {
    if (!indice) return [];
    const etiquetas = new Map<string, string>(
      EJES_DE_SUSCRIPCION.flatMap((eje) =>
        indice.filtros[eje].map((v) => [`${eje}|${v.slug}`, v.label] as [string, string]),
      ),
    );
    const aguja = normalize(texto).trim();
    return indice.suscripciones
      .filter((s) => (manda === null ? true : s.envio.manda === manda))
      .filter((s) =>
        EJES_DE_SUSCRIPCION.every((eje) => {
          const slug = elegidos[eje];
          return slug ? COINCIDE[eje](s, slug) : true;
        }),
      )
      .filter((s) => (aguja ? s.searchText.includes(aguja) : true))
      .map((s) =>
        fichaDeSuscripcion(s, { etiqueta: (campo, slug) => etiquetas.get(`${campo}|${slug}`) }),
      );
  }, [indice, texto, manda, elegidos]);

  const deshabilitado = carga.estado !== 'listo';

  const alternar = (eje: EjeDeSuscripcion, slug: string) =>
    setElegidos((prev) => ({ ...prev, [eje]: prev[eje] === slug ? undefined : slug }));

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
            placeholder="Nombre, quién la ofrece o tema"
            value={texto}
            disabled={deshabilitado}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>

        {indice && (
          <>
            {/*
              El primer filtro del § 5, y el único que no viene del JSON: es un
              booleano del documento y no un vocabulario. «Todas» es un botón más
              y no la ausencia de botones, por lo mismo que en librerías: sin él,
              quitar el filtro obliga a volver a tocar el mismo chip.
            */}
            <div>
              <p className={claseEtiquetaDeCampo}>¿Manda libros?</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { valor: null, texto: 'Todas' },
                  { valor: true, texto: 'Manda libros' },
                  { valor: false, texto: 'Sin envío' },
                ].map((opcion) => (
                  <button
                    key={String(opcion.valor)}
                    type="button"
                    aria-pressed={manda === opcion.valor}
                    onClick={() => setManda(opcion.valor)}
                    className={`${claseBotonBloque} ${manda === opcion.valor ? 'bg-tinta text-papel' : ''}`}
                  >
                    {opcion.texto}
                  </button>
                ))}
              </div>
            </div>

            {EJES_DE_SUSCRIPCION.filter((eje) => indice.filtros[eje].length > 0).map((eje) => (
              <div key={eje}>
                <p className={claseEtiquetaDeCampo}>{TITULO_DEL_EJE[eje]}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-pressed={!elegidos[eje]}
                    onClick={() => setElegidos((prev) => ({ ...prev, [eje]: undefined }))}
                    className={`${claseBotonBloque} ${!elegidos[eje] ? 'bg-tinta text-papel' : ''}`}
                  >
                    Todas
                  </button>
                  {indice.filtros[eje].map((v) => (
                    <button
                      key={v.slug}
                      type="button"
                      aria-pressed={elegidos[eje] === v.slug}
                      onClick={() => alternar(eje, v.slug)}
                      className={`${claseBotonBloque} ${elegidos[eje] === v.slug ? 'bg-tinta text-papel' : ''}`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
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
              ? 'Ninguna suscripción con ese filtro'
              : `${fichas.length} ${fichas.length === 1 ? 'suscripción' : 'suscripciones'}`}
          </p>
          <ul className="mt-4 flex flex-col gap-4">
            {fichas.map((f) => (
              <FichaDeSuscripcionFila key={f.slug} ficha={f} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
