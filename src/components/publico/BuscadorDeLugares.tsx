import { useEffect, useId, useMemo, useState } from 'react';
import { FichaDeLugarFila } from '@/components/publico/FichaDeLugarFila';
import { claseBotonBloque, claseCampo, claseEtiquetaDeCampo } from '@/components/sitio/estilos';
import { normalize } from '@/lib/normalize';
import {
  CLASES_DE_COSTO,
  EJES_DE_LUGAR,
  RANGOS_DE_CAPACIDAD,
  TEXTO_DE_COSTO,
  entraEnElRango,
  fichaDeLugar,
  type ClaseDeCosto,
  type EjeDeLugar,
  type FichaDeLugar,
  type IndiceDeLugares,
} from '@/lib/lugarPublico';

/**
 * La island de `/guia/lugares`: búsqueda por texto y los cinco filtros del § 7
 * del PRD — B-833.
 *
 * ── El HTML es la verdad; `lugares.json` es el índice ────────────────────
 * El mismo contrato que los otros dos directorios: el build imprime **todas** las
 * fichas en el HTML, así que la página sirve completa con JavaScript apagado y
 * Google la ve entera. Esta island hace **un solo fetch** (§2.5) y recién cuando
 * lo tiene saca del DOM la lista del build y pasa a renderizar la suya, con el
 * **mismo** componente de fila. Si el fetch falla, la lista del build se queda y
 * los controles quedan deshabilitados.
 *
 * ── Los cinco filtros, en el orden de utilidad real que el PRD fija ──────
 * 1. **Capacidad** — «somos 20» es la primera pregunta. En **rangos** y no un
 *    input numérico: los rangos toleran que la capacidad esté aproximada. Los
 *    rangos salen de `RANGOS_DE_CAPACIDAD`, del módulo puro, no de acá.
 * 2. **Condición** — las tres clases del § 5: sin costo, consumiendo, pagando. La
 *    clase la deriva la proyección (`costo`), así que acá no hay ningún mapa de
 *    slugs que se pueda quedar viejo.
 * 3. **Barrio** — reusa `/opciones/barrio`.
 * 4. **Qué incluye** — el que más ayuda con proyector y accesibilidad.
 * 5. **Tipo de lugar** — último; suena importante y filtra poco.
 *
 * Los tres últimos salen de `indice.filtros`, que el build ya recortó a los
 * valores con alguna ficha detrás (§4.4: «la web arma los chips recorriendo
 * `opciones.*` — nada hardcodeado»).
 *
 * ── Y lo que NO hay, que es la mitad que importa ─────────────────────────
 * **Sin filtro «hasta $X» y sin orden por precio** — § 5 y § 9 del PRD. No hace
 * falta vigilarlo con disciplina: `ficha.precio` es un **string con la frase
 * armada**, así que acá no hay número que comparar ni por el que ordenar
 * (D-570). Y el § 9 lo pide además como mitigación de producto: un slider de
 * precio empuja esta sección hacia la inmobiliaria de salones que el proyecto no
 * quiere ser.
 *
 * **Y sin la dirección en ninguna parte**: la fila no la pinta y este componente
 * no la toca. Para una casa `ficha.donde.direccion` ya viene vacía del build
 * (§ 6), y para un café no aporta en un listado.
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
  | { estado: 'listo'; indice: IndiceDeLugares }
  | { estado: 'error' };

/** Cómo se llama cada eje en pantalla. El JSON trae los valores, no el rótulo. */
const TITULO_DEL_EJE: Record<EjeDeLugar, string> = {
  barrio: 'Barrio',
  'incluye-lugar': 'Qué incluye',
  'tipo-lugar': 'Qué es',
};

/** De qué campo de la ficha sale cada eje, para filtrar. */
const COINCIDE: Record<
  EjeDeLugar,
  (l: IndiceDeLugares['lugares'][number], slug: string) => boolean
> = {
  barrio: (l, slug) => l.donde.barrio === slug,
  'incluye-lugar': (l, slug) => l.incluye.includes(slug),
  'tipo-lugar': (l, slug) => l.tipo === slug,
};

export function BuscadorDeLugares({ version, idListadoEstatico }: Props) {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [texto, setTexto] = useState('');
  /** `null` = «cualquiera». El filtro 1 del § 7. */
  const [rango, setRango] = useState<string | null>(null);
  /** `null` = «todos». El filtro 2: las tres clases del § 5. */
  const [costo, setCosto] = useState<ClaseDeCosto | null>(null);
  const [elegidos, setElegidos] = useState<Partial<Record<EjeDeLugar, string>>>({});
  const idBusqueda = useId();

  useEffect(() => {
    let vigente = true;
    fetch(`/lugares.json?v=${encodeURIComponent(version)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<IndiceDeLugares>;
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
   * Las etiquetas salen del propio índice, y **el enlace al hub de barrio no se
   * arma acá**: qué barrios tienen hub lo sabe el build (`fichasDeLugar`), no el
   * navegador. Antes que publicar un enlace a ciegas —que sería un 404 en cada
   * lugar de un barrio sin actividades— la fila re-renderizada muestra el barrio
   * como texto, igual que la del build cuando el hub no está.
   */
  const fichas: FichaDeLugar[] = useMemo(() => {
    if (!indice) return [];
    const etiquetas = new Map<string, string>(
      EJES_DE_LUGAR.flatMap((eje) =>
        indice.filtros[eje].map((v) => [`${eje}|${v.slug}`, v.label] as [string, string]),
      ),
    );
    const aguja = normalize(texto).trim();
    return indice.lugares
      .filter((l) => (rango === null ? true : entraEnElRango(l.capacidad, rango)))
      .filter((l) => (costo === null ? true : l.costo === costo))
      .filter((l) =>
        EJES_DE_LUGAR.every((eje) => {
          const slug = elegidos[eje];
          return slug ? COINCIDE[eje](l, slug) : true;
        }),
      )
      .filter((l) => (aguja ? l.searchText.includes(aguja) : true))
      .map((l) =>
        fichaDeLugar(l, { etiqueta: (campo, slug) => etiquetas.get(`${campo}|${slug}`) }),
      );
  }, [indice, texto, rango, costo, elegidos]);

  const deshabilitado = carga.estado !== 'listo';

  const alternar = (eje: EjeDeLugar, slug: string) =>
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
            placeholder="Nombre, barrio o qué tiene"
            value={texto}
            disabled={deshabilitado}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>

        {indice && (
          <>
            {/*
              Filtro 1 — la capacidad, en rangos. «Todos» es un botón más y no la
              ausencia de botones, por lo mismo que en los otros dos directorios:
              sin él, quitar el filtro obliga a volver a tocar el mismo chip.
            */}
            <div>
              <p className={claseEtiquetaDeCampo}>Para cuántas personas</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={rango === null}
                  onClick={() => setRango(null)}
                  className={`${claseBotonBloque} ${rango === null ? 'bg-tinta text-papel' : ''}`}
                >
                  Cualquiera
                </button>
                {RANGOS_DE_CAPACIDAD.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={rango === r.id}
                    onClick={() => setRango(rango === r.id ? null : r.id)}
                    className={`${claseBotonBloque} ${rango === r.id ? 'bg-tinta text-papel' : ''}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/*
              Filtro 2 — **las tres clases del § 5, y no un rango de precios.**
              «El filtro que la gente quiere no es "hasta $X": es "¿tengo que
              pagar algo?"». La clase de cada lugar la derivó la proyección
              (`costo`), así que acá no hay ningún mapa de condiciones que se
              pueda quedar viejo.
            */}
            <div>
              <p className={claseEtiquetaDeCampo}>¿Hay que pagar algo?</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={costo === null}
                  onClick={() => setCosto(null)}
                  className={`${claseBotonBloque} ${costo === null ? 'bg-tinta text-papel' : ''}`}
                >
                  Todos
                </button>
                {CLASES_DE_COSTO.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={costo === c}
                    onClick={() => setCosto(costo === c ? null : c)}
                    className={`${claseBotonBloque} ${costo === c ? 'bg-tinta text-papel' : ''}`}
                  >
                    {TEXTO_DE_COSTO[c]}
                  </button>
                ))}
              </div>
            </div>

            {EJES_DE_LUGAR.filter((eje) => indice.filtros[eje].length > 0).map((eje) => (
              <div key={eje}>
                <p className={claseEtiquetaDeCampo}>{TITULO_DEL_EJE[eje]}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-pressed={!elegidos[eje]}
                    onClick={() => setElegidos((prev) => ({ ...prev, [eje]: undefined }))}
                    className={`${claseBotonBloque} ${!elegidos[eje] ? 'bg-tinta text-papel' : ''}`}
                  >
                    Todos
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
              ? 'Ningún lugar con ese filtro'
              : `${fichas.length} ${fichas.length === 1 ? 'lugar' : 'lugares'}`}
          </p>
          <ul className="mt-4 flex flex-col gap-4">
            {fichas.map((f) => (
              <FichaDeLugarFila key={f.slug} ficha={f} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
