/**
 * La island del listado: búsqueda, filtros y orden — B-227, rehecha en B-260.
 *
 * ── El HTML es la verdad; `events.json` es el índice (§6.3) ───────────────
 * El build imprime **todas** las filas vigentes en el HTML, así que la página
 * sirve completa con JavaScript apagado y el buscador la ve entera. Esta island
 * hace **un solo fetch** de `/events.json` (§2.5) y, recién cuando lo tiene,
 * **saca del DOM la lista del build** y pasa a renderizar la suya con el mismo
 * componente `FilaDeActividad`. Como el estado inicial es el del build —sin
 * filtros, orden por próxima— lo que aparece es idéntico a lo que había: no hay
 * parpadeo, que es el peor defecto del patrón «island que re-renderiza todo».
 *
 * Si el fetch falla (offline, CDN caída) **no se saca nada**: la lista del build
 * sigue ahí, los controles quedan deshabilitados y hay un aviso chico. Nunca una
 * pantalla vacía.
 *
 * ── Dos relojes, y por eso hay un `ahora` en el estado ────────────────────
 * El HTML lo armó el build con **su** reloj; acá se recalcula con el de quien
 * mira (§6.4). Es lo que hace que una inscripción que cerró hace una hora se vea
 * cerrada sin esperar al rebuild siguiente — que es el punto de que el índice
 * mande `cierraEn` y no un booleano (B-111).
 *
 * ── La URL ────────────────────────────────────────────────────────────────
 * Los filtros se serializan a la query string con `replaceState`, no con
 * `pushState` (§6.2): veinte toques de filtro no son veinte entradas del
 * historial. Sirve para compartir un filtro por WhatsApp y para que volver desde
 * una página de detalle recupere lo que estaba filtrado.
 *
 * ── El riel de filtros: el índice del programa (B-260, D-146) ─────────────
 * El sistema visual pide «una barra de índice: una lista persistente de
 * categorías, con el aspecto del índice de un libro», y la referencia la dibuja
 * como una **columna izquierda fija de 256px**. Eso reemplaza al disclosure de
 * D-143 **en escritorio y solo ahí**:
 *
 * | | teléfono | escritorio (`lg`) |
 * |---|---|---|
 * | los ejes | detrás del botón «Filtros (N)», como en D-143 | siempre visibles en el riel |
 * | el riel | no existe: todo apilado | columna de `--spacing-riel`, pegada al scroll |
 * | cerrar | «Ver N actividades», y el foco vuelve al botón | no hace falta: nunca se cierra |
 *
 * **Los tres argumentos de D-143 siguen vigentes en el teléfono** y por eso el
 * disclosure no se tocó: en 360px seis ejes abiertos empujan el listado abajo del
 * pliegue, el panel sigue topeado a 65svh con scroll propio, y sigue cerrando
 * desde abajo devolviendo el foco. Lo que cambió es que en escritorio ese
 * compromiso ya no hace falta, porque hay una columna entera para el índice.
 *
 * **B-238 sigue abierto igual**: la hoja inferior modal del §8 no se construyó, y
 * el motivo es el mismo (trampa de foco, `Escape`, cierre por el fondo,
 * `pushState`; una capa modal mal hecha es peor que no tenerla).
 *
 * ── Por qué la raíz de la island es la grilla ─────────────────────────────
 * Porque la lista que imprime el build vive **fuera** de este componente —la
 * island la borra del DOM por `id` cuando toma el control— así que no puede ser
 * hija de esta grilla. Se alinea desde afuera con `lg:ps-riel`, que sale del
 * **mismo** token `--spacing-riel` que la columna de acá: escrito dos veces, el
 * día que el riel cambie de ancho la lista del build queda corrida, y solo
 * mientras el JavaScript no cargó — que es justo cuando nadie mira.
 */
import { claseBotonPrimario, claseCampo, claseCasilla, foco } from '@/components/sitio/estilos';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { EjeDeFiltro } from '@/components/publico/EjeDeFiltro';
import { ListaDeActividades } from '@/components/publico/ListaDeActividades';
import { nombreDeMes } from '@/lib/fechasPublicas';
import {
  CUANDO_ESTE_MES,
  CUANDO_PROXIMAS,
  CUANDO_TRES_MESES,
  EJES,
  ETIQUETA_EJE,
  ETIQUETA_ORDEN_PUBLICO,
  ORDENES_PUBLICOS,
  ORDEN_PUBLICO_POR_DEFECTO,
  aQuery,
  alternarValor,
  cantidadDeFiltrosPublicos,
  chipsDe,
  desdeQuery,
  ejeQueSobra,
  filtrosVacios,
  hayFiltrosPublicos,
  listaPublica,
  mapaDeEtiquetas,
  mesesConActividad,
  type FiltrosPublicos,
  type OrdenPublico,
} from '@/lib/listadoPublico';
import type { Indice } from '@/lib/eventsJson';

interface Props {
  /**
   * La versión del build. Va como `?v=` del fetch: con `no-cache` no hace falta
   * para el CDN, pero blinda contra un intermediario mal configurado que sirva
   * el JSON del build anterior contra el HTML del nuevo (§9).
   */
  version: string;
  /**
   * El id del contenedor con la lista que imprimió el build. Se saca del DOM
   * cuando esta island toma el control, para no tener las filas dos veces.
   */
  idListadoEstatico: string;
}

type Carga = { estado: 'cargando' } | { estado: 'listo'; indice: Indice } | { estado: 'error' };

/** Un `select` del sistema: sin caja, apoyado sobre su regla, y **sin radio**. */
const claseSelect = `${claseCampo} appearance-none pe-6 body-md disabled:opacity-60`;

/** El rótulo de un control, en versalitas y azul tinta. */
const claseEtiqueta = 'label-caps mb-1 block text-azul';

/** Un botón rectangular macizo, la otra forma de botón del sistema. */
const claseBotonBloque = `label-caps inline-flex min-h-touch shrink-0 items-center justify-center gap-2 border border-borde px-4 transition-colors ${foco} disabled:opacity-60`;

/**
 * La flecha del desplegable, dibujada con bordes.
 *
 * `appearance-none` es lo que saca las esquinas redondeadas que el sistema
 * operativo le pone al `select` —radio 0 es la regla 1— pero también le saca la
 * flecha, y sin flecha un `select` se lee como texto estático. Se repone con un
 * **triángulo de CSS puro**: tres bordes, dos transparentes. Ni librería de
 * iconos ni SVG ni una imagen para doce píxeles de decoración.
 */
function Flecha() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute end-1 bottom-3 size-0 border-x-4 border-t-4 border-x-transparent border-t-azul"
    />
  );
}

export function Buscador({ version, idListadoEstatico }: Props) {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [filtros, setFiltros] = useState<FiltrosPublicos>(filtrosVacios);
  const [orden, setOrden] = useState<OrdenPublico>(ORDEN_PUBLICO_POR_DEFECTO);
  const [abierto, setAbierto] = useState(false);
  /**
   * El reloj **del cliente**, congelado al montar.
   *
   * No se llama a `new Date()` dentro del render: dos renders seguidos darían
   * dos «ahora» distintos y una actividad podría cambiar de lado en el medio de
   * un tipeo. Se toma uno y se usa para toda la sesión, que para una página que
   * se mira unos minutos es exacto de sobra.
   */
  const [ahora] = useState(() => new Date());
  const id = useId();
  const primeraVez = useRef(true);
  /**
   * El botón que abre el panel. Se guarda para **devolverle el foco** al cerrar
   * desde «Ver N actividades»: sin eso el foco se cae al `body` y quien navega
   * con teclado vuelve a arrancar desde el principio de la página.
   */
  const botonFiltros = useRef<HTMLButtonElement | null>(null);

  // ── El fetch, una sola vez ──────────────────────────────────────────────
  useEffect(() => {
    let vigente = true;
    fetch(`/events.json?v=${encodeURIComponent(version)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Indice>;
      })
      .then((indice) => {
        if (!vigente) return;
        setCarga({ estado: 'listo', indice });
        // Recién acá se saca la lista del build: si se sacara antes, un fetch
        // que falla dejaría la página sin contenido.
        document.getElementById(idListadoEstatico)?.remove();
      })
      .catch(() => {
        if (vigente) setCarga({ estado: 'error' });
      });
    return () => {
      vigente = false;
    };
  }, [version, idListadoEstatico]);

  // ── La URL, en los dos sentidos ─────────────────────────────────────────
  useEffect(() => {
    const leer = () => {
      const { filtros: f, orden: o } = desdeQuery(window.location.search);
      setFiltros(f);
      setOrden(o);
    };
    leer();
    window.addEventListener('popstate', leer);
    return () => window.removeEventListener('popstate', leer);
  }, []);

  useEffect(() => {
    // El primer render es el que acaba de leer la URL: escribirla de vuelta ahí
    // borraría un parámetro que todavía no se aplicó.
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    const query = aQuery(filtros, orden);
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }, [filtros, orden]);

  const indice = carga.estado === 'listo' ? carga.indice : null;
  const entradas = useMemo(() => indice?.actividades ?? [], [indice]);
  const etiquetas = useMemo(() => mapaDeEtiquetas(indice?.opciones ?? {}), [indice]);

  const visibles = useMemo(
    () => (indice ? listaPublica(entradas, filtros, orden, ahora) : []),
    [indice, entradas, filtros, orden, ahora],
  );

  const meses = useMemo(() => mesesConActividad(entradas), [entradas]);
  const puestos = cantidadDeFiltrosPublicos(filtros);
  const sobra = useMemo(
    () => (visibles.length === 0 ? ejeQueSobra(entradas, filtros, ahora) : null),
    [visibles.length, entradas, filtros, ahora],
  );

  const limpiar = () => {
    setFiltros(filtrosVacios());
    setOrden(ORDEN_PUBLICO_POR_DEFECTO);
  };

  const cerrarPanel = () => {
    setAbierto(false);
    botonFiltros.current?.focus();
  };

  const deshabilitado = carga.estado !== 'listo';

  return (
    <div className="lg:grid lg:grid-cols-[var(--spacing-riel)_minmax(0,1fr)] lg:items-start lg:gap-x-10">
      {/* ══ El riel: el índice del programa ═══════════════════════════════ */}
      {/*
        `lg:sticky` con `top` a la altura del encabezado, que también se pega de
        `sm` en adelante. Sin el `top` el riel se metería debajo de la cabecera al
        scrollear. Y `max-h`/`overflow-y-auto` para que un índice con muchos
        barrios no quede con la mitad fuera de la pantalla y sin forma de llegar.
      */}
      <aside className="regla-gruesa-arriba pt-3 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pb-4">
        <div role="search" className="relative">
          {/*
            La etiqueta es **visible**, no `sr-only`: el sistema dice «campos: una
            etiqueta de texto apoyada sobre una regla de 1pt, sin caja». Con la
            etiqueta a la vista sobra la lupa que había antes —un SVG inline de
            doce bytes— así que el campo queda con una pieza menos y sin ningún
            icono, que es lo que D-146 pide.
          */}
          <label htmlFor={`${id}-q`} className={claseEtiqueta}>
            Buscar
          </label>
          {/*
            El buscador **no roba el foco al cargar**: en un teléfono abriría el
            teclado y taparía la lista, que es lo que se vino a ver (§4.1).
          */}
          <input
            id={`${id}-q`}
            type="search"
            value={filtros.q}
            disabled={deshabilitado}
            onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
            placeholder="Título, barrio, tallerista…"
            className={`${claseCampo} body-md disabled:opacity-60`}
          />
        </div>

        {/*
          El botón que abre los ejes, **solo en el teléfono**: en `lg` el riel los
          muestra siempre, así que un botón para desplegar lo que ya está
          desplegado es un control que miente. El número es lo que impide que un
          filtro olvidado explique un listado que parece vacío.
        */}
        <div className="mt-4 flex flex-wrap items-center gap-2 lg:hidden">
          <button
            ref={botonFiltros}
            type="button"
            aria-expanded={abierto}
            aria-controls={`${id}-filtros`}
            disabled={deshabilitado}
            onClick={() => setAbierto((v) => !v)}
            className={
              puestos > 0
                ? `${claseBotonBloque} border-acento bg-acento text-papel`
                : `${claseBotonBloque} bg-papel text-tinta hover:bg-crema`
            }
          >
            Filtros
            {puestos > 0 && <span className="tabular-nums">({puestos})</span>}
          </button>

          {hayFiltrosPublicos(filtros) && (
            <button
              type="button"
              onClick={limpiar}
              className={`${claseBotonBloque} border-transparent text-acento hover:bg-crema`}
            >
              Limpiar
            </button>
          )}
        </div>

        {indice && (
          /*
            Los ejes. En el teléfono viven detrás del disclosure y con el tope de
            65svh de D-143 —`svh` y no `vh` porque en un navegador móvil con barra
            retráctil `vh` mide la pantalla sin la barra y el panel termina más
            alto que el hueco real—. En `lg` están siempre y sin tope propio: el
            `aside` ya tiene el suyo.

            Se renderiza siempre (no `abierto && …`) y se esconde con clases: así
            en `lg` está sin depender del estado del disclosure, que allá no se usa.
          */
          <div
            id={`${id}-filtros`}
            className={`mt-4 flex-col gap-5 overflow-y-auto lg:mt-6 lg:flex lg:max-h-none lg:overflow-visible ${
              abierto ? 'flex max-h-[65svh]' : 'hidden'
            }`}
          >
            <div>
              <label htmlFor={`${id}-cuando`} className={claseEtiqueta}>
                Cuándo
              </label>
              <div className="relative">
                <select
                  id={`${id}-cuando`}
                  className={claseSelect}
                  value={filtros.cuando}
                  onChange={(e) => setFiltros({ ...filtros, cuando: e.target.value })}
                >
                  <option value={CUANDO_PROXIMAS}>Próximas</option>
                  <option value={CUANDO_ESTE_MES}>Este mes</option>
                  <option value={CUANDO_TRES_MESES}>Próximos 3 meses</option>
                  {meses.map((m) => (
                    <option key={m} value={m}>
                      {nombreDeMes(m)}
                    </option>
                  ))}
                </select>
                <Flecha />
              </div>
            </div>

            {EJES.map((eje) => (
              <EjeDeFiltro
                key={eje}
                leyenda={ETIQUETA_EJE[eje]}
                chips={chipsDe(eje, entradas, filtros, etiquetas, ahora)}
                onAlternar={(valor) => setFiltros(alternarValor(filtros, eje, valor))}
              />
            ))}

            <fieldset className="border-0 p-0">
              <legend className="label-caps regla-fina mb-1 w-full pb-1 text-azul">Otros</legend>
              <div className="flex flex-col gap-2">
                <label className="body-md flex min-h-touch items-center gap-2 text-tinta">
                  <input
                    type="checkbox"
                    checked={filtros.soloAbierta}
                    onChange={(e) => setFiltros({ ...filtros, soloAbierta: e.target.checked })}
                    className={claseCasilla}
                  />
                  Solo con inscripción abierta
                </label>
                <div>
                  <label htmlFor={`${id}-cursada`} className={claseEtiqueta}>
                    Tipo de cursada
                  </label>
                  <div className="relative">
                    <select
                      id={`${id}-cursada`}
                      className={claseSelect}
                      value={filtros.cursada}
                      onChange={(e) =>
                        setFiltros({
                          ...filtros,
                          cursada: e.target.value as FiltrosPublicos['cursada'],
                        })
                      }
                    >
                      <option value="">Cualquiera</option>
                      <option value="ciclos">Solo ciclos</option>
                      <option value="unicos">Solo encuentros únicos</option>
                    </select>
                    <Flecha />
                  </div>
                </div>
              </div>
            </fieldset>

            {/*
              Cerrar desde abajo es la mitad útil de la hoja inferior del §8: quien
              terminó de tocar filtros está al final del panel, y volver arriba a
              buscar el botón que lo abrió es el paso que sobra. Devuelve el foco
              al abridor, que es lo que una capa modal también tendría que hacer.

              `lg:hidden` porque allá el panel no se cierra nunca.
            */}
            <button
              type="button"
              onClick={cerrarPanel}
              className={`${claseBotonPrimario} label-caps sticky bottom-0 lg:hidden`}
            >
              {visibles.length === 1 ? 'Ver 1 actividad' : `Ver ${visibles.length} actividades`}
            </button>
          </div>
        )}
      </aside>

      {/* ══ La columna de contenido ═══════════════════════════════════════ */}
      <div className="min-w-0">
        {/*
          La fila de estado: el contador y el orden. `regla-gruesa-arriba` para que
          la columna arranque contra la misma regla que el riel y las dos empiecen
          a la misma altura.
        */}
        <div className="regla-gruesa-arriba flex flex-wrap items-end justify-between gap-3 pt-3">
          {/*
            §10 — el contador va en un `aria-live="polite"`: quien usa lector de
            pantalla tiene que enterarse de que la lista cambió sin tener que ir a
            buscarla. `atomic` para que lea la frase entera y no solo el número.
          */}
          <p aria-live="polite" aria-atomic="true" className="label-caps text-super">
            {carga.estado === 'cargando' && 'Cargando el buscador…'}
            {carga.estado === 'error' && 'No se pudo cargar el buscador'}
            {carga.estado === 'listo' &&
              (visibles.length === entradas.length
                ? `${entradas.length} ${entradas.length === 1 ? 'actividad' : 'actividades'}`
                : `${visibles.length} de ${entradas.length} actividades`)}
          </p>

          <div className="relative">
            <label htmlFor={`${id}-orden`} className="sr-only">
              Ordenar por
            </label>
            <select
              id={`${id}-orden`}
              className={`${claseSelect} label-caps max-w-56 text-azul`}
              value={orden}
              disabled={deshabilitado}
              onChange={(e) => setOrden(e.target.value as OrdenPublico)}
            >
              {ORDENES_PUBLICOS.map((o) => (
                <option key={o} value={o}>
                  {ETIQUETA_ORDEN_PUBLICO[o]}
                </option>
              ))}
            </select>
            <Flecha />
          </div>
        </div>

        {carga.estado === 'error' && (
          <p className="body-md regla-fina mt-3 border-borde px-3 py-2 text-super">
            No pudimos cargar el buscador. La lista completa sigue abajo; probá
            recargar la página.
          </p>
        )}

        {/* ── El listado, una vez que la island tomó el control ─────────── */}
        {indice && (
          <div className="mt-6">
            {visibles.length > 0 ? (
              <ListaDeActividades
                entradas={visibles}
                ahora={ahora}
                etiquetas={etiquetas}
                agrupar={orden === 'proxima'}
              />
            ) : (
              /*
                §6.1 — cero resultados no es una pantalla vacía: dice qué sacar. El
                eje que se ofrece se **probó** (ver `ejeQueSobra`), no se adivinó
                por un orden de prioridad: sugerir «sacá el barrio» cuando sacarlo
                tampoco alcanza es peor que no sugerir nada.
              */
              <div className="regla-gruesa-arriba px-4 py-12 text-center">
                {/*
                  Y distingue «no hay nada publicado» de «tus filtros no dejan
                  pasar nada»: son dos situaciones distintas y la segunda tiene
                  arreglo. La island borró la lista del build, así que el aviso que
                  esa lista tenía para el caso vacío tiene que existir también acá.
                */}
                <p className="headline-sm text-tinta">
                  {entradas.length === 0
                    ? 'Todavía no hay nada publicado. Volvé en unos días.'
                    : 'No hay actividades con estos filtros.'}
                </p>
                {sobra && (
                  <p className="body-md mt-2 text-super">
                    Probá sin el filtro de <strong>{ETIQUETA_EJE[sobra].toLowerCase()}</strong>.
                  </p>
                )}
                {hayFiltrosPublicos(filtros) && (
                  <button
                    type="button"
                    onClick={limpiar}
                    className={`${claseBotonPrimario} label-caps mt-6`}
                  >
                    Limpiar todos los filtros
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
