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
  'min-h-touch w-full rounded-md border border-borde bg-white/70 px-2.5 py-1.5 text-sm text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento';

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

  const deshabilitado = carga.estado !== 'listo';

  return (
    <div className="flex flex-col gap-4">
      {/* ── Controles ──────────────────────────────────────────────────── */}
      {/*
        `role="search"` sobre un `div` y no el elemento `<search>`: el rol es lo
        que anuncia el lector de pantalla, y no depende de qué versión de React ni
        de qué navegador esté del otro lado.
      */}
      <div role="search">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor={`${id}-q`} className="mb-1 block text-xs font-semibold tracking-wide text-tinta/65 uppercase">
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
              className="min-h-touch w-full rounded-md border border-borde bg-white/70 px-3 py-2 text-tinta placeholder:text-tinta/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento disabled:opacity-60"
            />
          </div>

          <div className="w-full sm:w-44">
            <label htmlFor={`${id}-cuando`} className="mb-1 block text-xs font-semibold tracking-wide text-tinta/65 uppercase">
              Cuándo
            </label>
            <select
              id={`${id}-cuando`}
              className={claseSelect}
              value={filtros.cuando}
              disabled={deshabilitado}
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

          <div className="w-full sm:w-52">
            <label htmlFor={`${id}-orden`} className="mb-1 block text-xs font-semibold tracking-wide text-tinta/65 uppercase">
              Ordenar por
            </label>
            <select
              id={`${id}-orden`}
              className={claseSelect}
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/*
          Los filtros arrancan colapsados detrás de un botón que dice cuántos hay
          puestos: en 360px seis grupos de chips abiertos empujan el listado
          abajo del pliegue. El número es lo que impide que un filtro olvidado
          explique un listado que parece vacío — mismo criterio que el panel.
        */}
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={`${id}-filtros`}
          disabled={deshabilitado}
          onClick={() => setAbierto((v) => !v)}
          className="min-h-touch rounded-full border border-borde bg-white/60 px-4 text-sm font-medium text-tinta transition-colors hover:border-tinta/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento disabled:opacity-60"
        >
          Filtros{puestos > 0 ? ` (${puestos})` : ''}
        </button>

        {hayFiltrosPublicos(filtros) && (
          <button
            type="button"
            onClick={limpiar}
            className="min-h-touch rounded-full px-3 text-sm text-acento underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
          >
            Limpiar filtros
          </button>
        )}

        {/*
          §10 — el contador va en un `aria-live="polite"`: quien usa lector de
          pantalla tiene que enterarse de que la lista cambió sin tener que ir a
          buscarla. `atomic` para que lea la frase entera y no solo el número.
        */}
        <p
          aria-live="polite"
          aria-atomic="true"
          className="ml-auto text-sm text-tinta/65"
        >
          {carga.estado === 'cargando' && 'Cargando el buscador…'}
          {carga.estado === 'error' && 'No se pudo cargar el buscador'}
          {carga.estado === 'listo' &&
            (visibles.length === entradas.length
              ? `${entradas.length} ${entradas.length === 1 ? 'actividad' : 'actividades'}`
              : `${visibles.length} de ${entradas.length} actividades`)}
        </p>
      </div>

      {carga.estado === 'error' && (
        <p className="rounded-md border border-borde bg-white/60 px-3 py-2 text-sm text-tinta/70">
          No pudimos cargar el buscador. La lista completa sigue abajo; probá
          recargar la página.
        </p>
      )}

      {abierto && indice && (
        <div
          id={`${id}-filtros`}
          className="flex flex-col gap-4 rounded-lg border border-borde bg-white/50 px-3 py-4 sm:px-4"
        >
          {EJES.map((eje) => (
            <GrupoDeChips
              key={eje}
              leyenda={ETIQUETA_EJE[eje]}
              chips={chipsDe(eje, entradas, filtros, etiquetas, ahora)}
              onAlternar={(valor) => setFiltros(alternarValor(filtros, eje, valor))}
            />
          ))}

          <fieldset className="border-0 p-0">
            <legend className="mb-1.5 text-xs font-semibold tracking-wide text-tinta/65 uppercase">
              Otros
            </legend>
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
          <div className="rounded-lg border border-borde bg-white/60 px-4 py-8 text-center">
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
                className="mt-4 min-h-touch rounded-full border border-acento px-4 text-sm font-medium text-acento transition-colors hover:bg-acento/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
              >
                Limpiar todos los filtros
              </button>
            )}
          </div>
        ))}
    </div>
  );
}
