import { useEffect, useId, useMemo, useState } from 'react';
import { FichaDeBibliotecaFila } from '@/components/publico/FichaDeBibliotecaFila';
import { claseBotonBloque, claseCampo, claseEtiquetaDeCampo } from '@/components/sitio/estilos';
import { conFiltroDeGeografia, muestraEjeDeGeografia } from '@/lib/geografia.mjs';
import {
  EJES_DE_BIBLIOTECA,
  fichaDeBiblioteca,
  type EjeDeBiblioteca,
  type IndiceDeBibliotecas,
  type BibliotecaPublica,
} from '@/lib/bibliotecaPublica';
import { normalize } from '@/lib/normalize';
import type { FichaDeBiblioteca } from '@/lib/bibliotecaPublica';

/**
 * La island de `/guia/bibliotecas`: búsqueda por texto, la cascada de lugar
 * —provincia, y de ahí barrio o ciudad—, el tipo de biblioteca y si hace falta
 * asociarse. B-960.
 *
 * ── El HTML es la verdad; `bibliotecas.json` es el índice ─────────────────
 * El mismo contrato que el listado de la agenda (§6.3): el build imprime
 * **todas** las fichas en el HTML, así que la página sirve completa con
 * JavaScript apagado y Google la ve entera. Esta island hace **un solo fetch** de
 * `/bibliotecas.json` (§2.5) y recién cuando lo tiene saca del DOM la lista del
 * build y pasa a renderizar la suya, con el **mismo** componente de fila — por
 * eso no hay parpadeo: sin filtros, lo que aparece es idéntico a lo que había.
 *
 * Si el fetch falla (offline, CDN caída) **no se saca nada**: la lista del build
 * sigue ahí y los controles quedan deshabilitados con un aviso chico. Nunca una
 * pantalla vacía.
 *
 * ── Los ejes, y por qué «asociarse» no es uno ────────────────────────────
 * Los tres de la geografía y el tipo salen de `EJES_DE_BIBLIOTECA`, que es la
 * misma lista que el build usó para armar los vocabularios: son taxonomías de
 * `/opciones/*` y sus chips llevan la etiqueta que viaja en el JSON (§4.4, «nada
 * hardcodeado»).
 *
 * **«Hay que asociarse» es un toggle aparte y no un eje**, y la diferencia
 * importa: no es una taxonomía renombrable sino un booleano derivado de la
 * ficha. Meterlo en el registro obligaría a inventarle un vocabulario de dos
 * valores y a que el JSON lo publicara como si fuera una opción que alguien
 * puede editar desde la pantalla de taxonomías, que no lo es.
 *
 * **Y el costo no se filtra, ni acá ni en ningún lado**: es la regla 2 de
 * `datoConFecha.ts` (D-570). Filtrar por precio afirma que los precios son
 * comparables, y no lo son si uno tiene una semana y otro cuatro meses. Por eso
 * la proyección lo publica como frase y no como número: la forma es la que
 * impone la regla, no la disciplina de quien escribe esta island.
 *
 * No importa nada de `components/admin/` (`tests/bundle-panel.test.ts`).
 */
interface Props {
  /**
   * La versión del build, como `?v=` del fetch. Con `no-cache` no hace falta
   * para el CDN, pero blinda contra un intermediario mal configurado que sirva
   * el JSON del build anterior contra el HTML del nuevo (§9).
   */
  version: string;
  /** El `id` de la lista que imprimió el build, para sacarla al tomar el control. */
  idListadoEstatico: string;
}

/** Cómo se llama cada eje en pantalla. El JSON trae los valores, no el rótulo. */
const TITULO_DEL_EJE: Record<EjeDeBiblioteca, string> = {
  provincia: 'Provincia',
  barrio: 'Barrio',
  ciudad: 'Ciudad',
  'tipo-biblioteca': 'Qué biblioteca',
};

/** De qué campo de la ficha sale cada eje, para filtrar. */
const COINCIDE: Record<EjeDeBiblioteca, (b: BibliotecaPublica, slug: string) => boolean> = {
  provincia: (b, slug) => b.provincia === slug,
  barrio: (b, slug) => b.barrio === slug,
  ciudad: (b, slug) => b.ciudad === slug,
  'tipo-biblioteca': (b, slug) => b.tipo === slug,
};

/**
 * Los tres ejes a los que se les aplica la cascada de lugar.
 *
 * Se declara y no se deriva de `EJES_DE_BIBLIOTECA` porque el cuarto (`tipo`)
 * **no es geografía**: pasarlo por `muestraEjeDeGeografia` lo escondería según
 * la provincia elegida, que es exactamente lo que no tiene que pasar. El día que
 * entre un quinto eje, esta lista es la que dice si es de lugar o no.
 */
const EJES_DE_LUGAR = ['provincia', 'barrio', 'ciudad'] as const;
const esEjeDeLugar = (eje: EjeDeBiblioteca): boolean =>
  (EJES_DE_LUGAR as readonly string[]).includes(eje);

type Carga =
  | { estado: 'cargando' }
  | { estado: 'listo'; indice: IndiceDeBibliotecas }
  | { estado: 'error' };

export function BuscadorDeBibliotecas({ version, idListadoEstatico }: Props) {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [texto, setTexto] = useState('');
  const [elegidos, setElegidos] = useState<Partial<Record<EjeDeBiblioteca, string>>>({});
  /** El toggle propio de esta guía. `false` es «no filtres», no «no hace falta». */
  const [soloConAsociarse, setSoloConAsociarse] = useState(false);
  const idBusqueda = useId();

  useEffect(() => {
    let vigente = true;
    fetch(`/bibliotecas.json?v=${encodeURIComponent(version)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<IndiceDeBibliotecas>;
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
   * Las etiquetas salen del propio índice y el hub **no se linkea desde acá**:
   * cuál barrio tiene página lo sabe el build (`lib/contenidoDeLaGuia.ts`), no el
   * navegador. Antes que publicar un enlace a ciegas —que sería un 404 en cada
   * barrio sin actividades— la fila re-renderizada muestra el barrio como texto,
   * igual que la del build cuando el hub no existe.
   */
  const fichas: FichaDeBiblioteca[] = useMemo(() => {
    if (!indice) return [];
    const deBarrio = new Map(indice.filtros.barrio.map((b) => [b.slug, b.label]));
    const deTipo = new Map(indice.filtros['tipo-biblioteca'].map((t) => [t.slug, t.label]));
    const aguja = normalize(texto).trim();
    return indice.bibliotecas
      /*
       * AND entre ejes, igual que en el riel del listado. Se recorre
       * `EJES_DE_BIBLIOTECA` y no se enumeran los cuatro, por lo mismo que el
       * constructor del índice: el eje que se agregue mañana entra solo.
       */
      .filter((b) =>
        EJES_DE_BIBLIOTECA.every((eje) => {
          const slug = elegidos[eje];
          return slug ? COINCIDE[eje](b, slug) : true;
        }),
      )
      .filter((b) => (soloConAsociarse ? b.asociarse.haceFalta : true))
      .filter((b) => (aguja ? b.searchText.includes(aguja) : true))
      .map((b) =>
        fichaDeBiblioteca(b, {
          etiquetaDeBarrio: deBarrio.get(b.barrio),
          etiquetaDeTipo: deTipo.get(b.tipo),
        }),
      );
  }, [indice, texto, elegidos, soloConAsociarse]);

  /*
   * La cascada la aplica `conFiltroDeGeografia`: al cambiar de provincia hay que
   * soltar el barrio o la ciudad de antes. Es la misma regla y el mismo módulo
   * que en las otras dos guías. Para el tipo no aplica —no es geografía—, así
   * que se setea derecho.
   */
  const alternar = (eje: EjeDeBiblioteca, slug: string) =>
    setElegidos((prev) =>
      esEjeDeLugar(eje)
        ? conFiltroDeGeografia(prev, eje, slug)
        : { ...prev, [eje]: prev[eje] === slug ? undefined : slug },
    );

  /** «Todas» es apagar el eje, y apagar la provincia arrastra su subdivisión. */
  const quitar = (
    prev: Partial<Record<EjeDeBiblioteca, string>>,
    eje: EjeDeBiblioteca,
  ): Partial<Record<EjeDeBiblioteca, string>> => {
    if (prev[eje] === undefined) return prev;
    return esEjeDeLugar(eje)
      ? conFiltroDeGeografia(prev, eje, prev[eje]!)
      : { ...prev, [eje]: undefined };
  };

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

        {indice &&
          /*
            Dos recortes, y el orden importa. Primero el de siempre: un eje sin
            ningún valor detrás es un chip que promete cero resultados. Y después
            el de la cascada, **solo para los de lugar**: `barrio` y `ciudad` se
            ofrecen si la provincia elegida los subdivide. La regla vive en
            `geografia.mjs` y acá no se reescribe.
          */
          EJES_DE_BIBLIOTECA.filter(
            (eje) =>
              indice.filtros[eje].length > 0 &&
              (!esEjeDeLugar(eje) ||
                muestraEjeDeGeografia(
                  eje,
                  elegidos.provincia ? [elegidos.provincia] : [],
                  Boolean(elegidos[eje]),
                )),
          ).map((eje) => (
            <div key={eje}>
              <p className={claseEtiquetaDeCampo}>{TITULO_DEL_EJE[eje]}</p>
              <div className="flex flex-wrap gap-2">
                {/*
                  «Todas» es un botón más y no la ausencia de botones: sin él,
                  quitar un valor elegido obliga a volver a tocar el mismo chip,
                  que es un gesto que nadie descubre.
                */}
                <button
                  type="button"
                  aria-pressed={!elegidos[eje]}
                  onClick={() => setElegidos((prev) => quitar(prev, eje))}
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

        {/*
          El toggle de asociarse. Un solo botón y no un par «sí/no»: la pregunta
          real es «¿puedo llevarme un libro sin trámite?», y el caso contrario
          —«mostrame solo las que piden carnet»— no se lo hace nadie.
        */}
        {indice && (
          <div>
            <p className={claseEtiquetaDeCampo}>Para llevarse libros</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={!soloConAsociarse}
                onClick={() => setSoloConAsociarse(false)}
                className={`${claseBotonBloque} ${!soloConAsociarse ? 'bg-tinta text-papel' : ''}`}
              >
                Todas
              </button>
              <button
                type="button"
                aria-pressed={soloConAsociarse}
                onClick={() => setSoloConAsociarse(true)}
                className={`${claseBotonBloque} ${soloConAsociarse ? 'bg-tinta text-papel' : ''}`}
              >
                Hay que asociarse
              </button>
            </div>
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
              ? 'Ninguna biblioteca con ese filtro'
              : `${fichas.length} ${fichas.length === 1 ? 'biblioteca' : 'bibliotecas'}`}
          </p>
          <ul className="mt-4 flex flex-col gap-4">
            {fichas.map((f) => (
              <FichaDeBibliotecaFila key={f.slug} ficha={f} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
