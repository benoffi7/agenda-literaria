/**
 * La island del listado: búsqueda, filtros y orden — B-227, §6 del diseño.
 *
 * ── El HTML es la verdad; `events.json` es el índice (§6.3) ───────────────
 * El build imprime **todas** las tarjetas vigentes en el HTML, así que la página
 * sirve completa con JavaScript apagado y el buscador la ve entera. Esta island
 * hace **un solo fetch** de `/events.json` (§2.5) y, recién cuando lo tiene,
 * **saca del DOM la lista del build** y pasa a renderizar la suya con el mismo
 * componente `Tarjeta`. Como el estado inicial es el del build —sin filtros,
 * orden por próxima— lo que aparece es idéntico a lo que había: no hay
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
 * `pushState` (§6.2): veinte toques de chip no son veinte entradas del
 * historial. Sirve para compartir un filtro por WhatsApp y para que volver desde
 * una página de detalle recupere lo que estaba filtrado. El `popstate` se escucha
 * igual, para el caso de que el navegador restaure otra URL.
 *
 * ── Cuánto ocupan los controles antes del primer resultado (B-238) ────────
 * El pedido de móvil del §8 es una **hoja inferior**, y sigue abierto en B-238 a
 * propósito: una capa modal necesita trampa de foco, `Escape`, cierre tocando el
 * fondo, devolver el foco al abridor y `pushState` para que el botón atrás la
 * cierre en vez de salir del sitio, y una capa modal mal hecha es peor que no
 * tenerla. Lo que B-247 sí hizo es que el *disclosure* de hoy no coma la pantalla,
 * y con tres cambios que no necesitan una capa (**D-143**):
 *
 * 1. **Arriba queda una sola fila**: el buscador y, debajo, la fila de botones.
 *    «Cuándo» —que era un `select` con su etiqueta ocupando un tercio del ancho—
 *    se fue adentro del panel, que es donde viven los otros filtros y donde el
 *    contador del botón ya lo cuenta.
 * 2. **El panel abierto está topeado a 65svh con scroll propio** en el teléfono,
 *    así que las primeras tarjetas nunca quedan fuera de la pantalla.
 * 3. **Cierra con «Ver N actividades»** y el foco vuelve al botón que lo abrió,
 *    que es la parte de la hoja inferior que sí se puede tener sin ser modal.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { GrupoDeChips } from '@/components/publico/GrupoDeChips';
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
   * cuando esta island toma el control, para no tener las tarjetas dos veces.
   */
  idListadoEstatico: string;
}

type Carga = { estado: 'cargando' } | { estado: 'listo'; indice: Indice } | { estado: 'error' };

const claseSelect =
  'min-h-touch w-full rounded-lg border border-borde bg-hondo px-2.5 py-1.5 text-sm text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento disabled:opacity-60';

const claseEtiqueta = 'mb-1.5 block text-xs font-semibold tracking-[0.12em] text-tinta/70 uppercase';

const claseBotonPildora =
  'inline-flex min-h-touch shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento disabled:opacity-60';

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
    <div className="flex flex-col gap-3">
      {/* ── Controles ──────────────────────────────────────────────────── */}
      {/*
        `role="search"` sobre un `div` y no el elemento `<search>`: el rol es lo
        que anuncia el lector de pantalla, y no depende de qué versión de React ni
        de qué navegador esté del otro lado.
      */}
      <div role="search">
        <label htmlFor={`${id}-q`} className="sr-only">
          Buscar actividades
        </label>
        {/*
          El campo con la lupa adentro. La lupa es un SVG inline y `aria-hidden`:
          no hay librería de iconos en el proyecto y no se agrega una por un
          dibujo de doce bytes, y el campo ya tiene su etiqueta.
        */}
        <div className="relative">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-tinta/70"
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M12.5 12.5 17 17" />
          </svg>
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
            placeholder="Buscar por título, barrio o tallerista…"
            className="min-h-touch w-full rounded-full border border-borde bg-crema py-2 pr-4 pl-10 text-tinta placeholder:text-tinta/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento disabled:opacity-60"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/*
          Los filtros arrancan colapsados detrás de un botón que dice cuántos hay
          puestos: en 360px seis grupos de chips abiertos empujan el listado
          abajo del pliegue. El número es lo que impide que un filtro olvidado
          explique un listado que parece vacío — mismo criterio que el panel.
        */}
        <button
          ref={botonFiltros}
          type="button"
          aria-expanded={abierto}
          aria-controls={`${id}-filtros`}
          disabled={deshabilitado}
          onClick={() => setAbierto((v) => !v)}
          className={
            puestos > 0
              ? `${claseBotonPildora} border-acento-hondo bg-acento text-papel`
              : `${claseBotonPildora} border-borde bg-crema text-tinta hover:border-acento`
          }
        >
          Filtros
          {puestos > 0 && (
            <span className="rounded-full bg-papel px-1.5 text-xs font-semibold text-acento-hondo">
              {puestos}
            </span>
          )}
        </button>

        {hayFiltrosPublicos(filtros) && (
          <button
            type="button"
            onClick={limpiar}
            className={`${claseBotonPildora} border-transparent text-acento-hondo hover:border-borde`}
          >
            Limpiar
          </button>
        )}

        <div className="ms-auto flex items-center gap-2">
          <label htmlFor={`${id}-orden`} className="sr-only">
            Ordenar por
          </label>
          <select
            id={`${id}-orden`}
            className="min-h-touch max-w-48 rounded-full border border-borde bg-crema px-3 text-sm text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento disabled:opacity-60"
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
        </div>
      </div>

      {/*
        §10 — el contador va en un `aria-live="polite"`: quien usa lector de
        pantalla tiene que enterarse de que la lista cambió sin tener que ir a
        buscarla. `atomic` para que lea la frase entera y no solo el número.
      */}
      <p aria-live="polite" aria-atomic="true" className="text-sm text-tinta/70">
        {carga.estado === 'cargando' && 'Cargando el buscador…'}
        {carga.estado === 'error' && 'No se pudo cargar el buscador'}
        {carga.estado === 'listo' &&
          (visibles.length === entradas.length
            ? `${entradas.length} ${entradas.length === 1 ? 'actividad' : 'actividades'}`
            : `${visibles.length} de ${entradas.length} actividades`)}
      </p>

      {carga.estado === 'error' && (
        <p className="rounded-lg border border-borde bg-crema px-3 py-2 text-sm text-tinta/70">
          No pudimos cargar el buscador. La lista completa sigue abajo; probá
          recargar la página.
        </p>
      )}

      {abierto && indice && (
        /*
          El tope de alto es del teléfono y no del escritorio: `max-h-[65svh]` con
          scroll propio deja siempre a la vista el arranque de la grilla, que es lo
          que la hoja inferior del §8 iba a resolver. `svh` y no `vh` porque en un
          navegador móvil con barra retráctil `vh` mide la pantalla sin la barra y
          el panel termina más alto que el hueco real.
        */
        <div
          id={`${id}-filtros`}
          className="flex max-h-[65svh] flex-col gap-5 overflow-y-auto rounded-xl border border-borde bg-crema px-3 py-4 sm:max-h-none sm:overflow-visible sm:px-5 sm:py-5"
        >
          <div className="max-w-64">
            <label htmlFor={`${id}-cuando`} className={claseEtiqueta}>
              Cuándo
            </label>
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
          </div>

          {EJES.map((eje) => (
            <GrupoDeChips
              key={eje}
              leyenda={ETIQUETA_EJE[eje]}
              chips={chipsDe(eje, entradas, filtros, etiquetas, ahora)}
              onAlternar={(valor) => setFiltros(alternarValor(filtros, eje, valor))}
            />
          ))}

          <fieldset className="border-0 p-0">
            <legend className={claseEtiqueta}>Otros</legend>
            <div className="flex flex-col gap-2">
              <label className="flex min-h-touch items-center gap-2 text-sm text-tinta/80">
                <input
                  type="checkbox"
                  checked={filtros.soloAbierta}
                  onChange={(e) => setFiltros({ ...filtros, soloAbierta: e.target.checked })}
                  className="size-4 accent-acento"
                />
                Solo con inscripción abierta
              </label>
              <label className="flex min-h-touch items-center gap-2 text-sm text-tinta/80">
                Tipo de cursada
                <select
                  className={`${claseSelect} max-w-56`}
                  value={filtros.cursada}
                  onChange={(e) =>
                    setFiltros({ ...filtros, cursada: e.target.value as FiltrosPublicos['cursada'] })
                  }
                >
                  <option value="">Cualquiera</option>
                  <option value="ciclos">Solo ciclos</option>
                  <option value="unicos">Solo encuentros únicos</option>
                </select>
              </label>
            </div>
          </fieldset>

          {/*
            Cerrar desde abajo es la mitad útil de la hoja inferior del §8: quien
            terminó de tocar chips está al final del panel, y volver arriba a
            buscar el botón que lo abrió es el paso que sobra. Devuelve el foco al
            abridor, que es lo que una capa modal también tendría que hacer.
          */}
          <button
            type="button"
            onClick={cerrarPanel}
            className={`${claseBotonPildora} sticky bottom-0 justify-center border-acento-hondo bg-acento text-papel sm:static sm:self-start`}
          >
            {visibles.length === 1 ? 'Ver 1 actividad' : `Ver ${visibles.length} actividades`}
          </button>
        </div>
      )}

      {/* ── El listado, una vez que la island tomó el control ───────────── */}
      {indice &&
        (visibles.length > 0 ? (
          <ListaDeActividades
            entradas={visibles}
            ahora={ahora}
            etiquetas={etiquetas}
            agrupar={orden === 'proxima'}
          />
        ) : (
          /*
            §6.1 — cero resultados no es una pantalla vacía: dice qué sacar. El
            eje que se ofrece se **probó** (ver `ejeQueSobra`), no se adivinó por
            un orden de prioridad: sugerir «sacá el barrio» cuando sacarlo tampoco
            alcanza es peor que no sugerir nada.
          */
          <div className="rounded-xl border border-borde bg-crema px-4 py-10 text-center">
            {/*
              Y distingue «no hay nada publicado» de «tus filtros no dejan pasar
              nada»: son dos situaciones distintas y la segunda tiene arreglo. La
              island borró la lista del build, así que el aviso que esa lista tenía
              para el caso vacío tiene que existir también acá.
            */}
            <p className="font-serif text-lg text-tinta">
              {entradas.length === 0
                ? 'Todavía no hay nada publicado. Volvé en unos días.'
                : 'No hay actividades con estos filtros.'}
            </p>
            {sobra && (
              <p className="mt-2 text-sm text-tinta/70">
                Probá sin el filtro de <strong>{ETIQUETA_EJE[sobra].toLowerCase()}</strong>.
              </p>
            )}
            {hayFiltrosPublicos(filtros) && (
              <button
                type="button"
                onClick={limpiar}
                className={`${claseBotonPildora} mt-5 border-acento-hondo bg-acento text-papel`}
              >
                Limpiar todos los filtros
              </button>
            )}
          </div>
        ))}
    </div>
  );
}
