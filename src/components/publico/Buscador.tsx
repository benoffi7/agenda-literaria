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
 * | los ejes | detrás del botón «Filtros (N)», en una hoja modal — B-238 | siempre visibles en el riel |
 * | el riel | no existe: todo apilado | columna de `--spacing-riel`, pegada al scroll |
 * | cerrar | «Ver N actividades», `Escape`, el fondo o el botón atrás — los cuatro por el mismo camino | no hace falta: nunca se cierra |
 *
 * **Los tres argumentos de D-143 siguen vigentes en el teléfono** y por eso ese
 * trabajo no se repitió: en 360px seis ejes abiertos empujan el listado abajo del
 * pliegue, el panel sigue topeado a 65svh con scroll propio, y sigue cerrando
 * desde abajo devolviendo el foco. Lo que cambió es que en escritorio ese
 * compromiso ya no hace falta, porque hay una columna entera para el índice.
 *
 * **Y desde B-238 (2026-09-03) es una capa modal de verdad**, y no un
 * *disclosure* inline: trampa de foco y cierre con `Escape` salen de
 * `useCapaModal` (`lib/capaModal.ts`, compartido con el panel desde este mismo
 * cambio), cierra tocando el fondo, y abrir la hoja hace `pushState` — el botón
 * atrás del teléfono la cierra en vez de sacar a la persona del sitio. En `lg`
 * ninguna de las tres cosas se activa: el mismo `div` es, ahí, un panel siempre
 * visible y no un diálogo (`role`/`aria-modal` son condicionales, y `useCapaModal`
 * recibe `activo={abierto}`, que en escritorio nunca lo es).
 *
 * ── Por qué la raíz de la island es la grilla ─────────────────────────────
 * Porque la lista que imprime el build vive **fuera** de este componente —la
 * island la borra del DOM por `id` cuando toma el control— así que no puede ser
 * hija de esta grilla. Se alinea desde afuera con `lg:sangria-de-riel`, que sale del
 * **mismo** token `--spacing-riel` que la columna de acá: escrito dos veces, el
 * día que el riel cambie de ancho la lista del build queda corrida, y solo
 * mientras el JavaScript no cargó — que es justo cuando nadie mira.
 */
import { claseBotonPrimario, claseCampo, claseCasilla, foco } from '@/components/sitio/estilos';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { EjeDeFiltro } from '@/components/publico/EjeDeFiltro';
import { ListaDeActividades } from '@/components/publico/ListaDeActividades';
import { useCapaModal } from '@/lib/capaModal';
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
  tonosDeTipo,
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
   * La caja de la hoja de filtros — B-238. Es el `caja` que pide `useCapaModal`:
   * tiene que tener `tabIndex={-1}` para poder recibir el foco al abrirse sin
   * ser una parada de Tab (ver el hook).
   */
  const caja = useRef<HTMLDivElement>(null);
  /**
   * ¿La entrada de historial de la hoja es **nuestra**? — B-238.
   *
   * `cerrarPanel` necesita saber si hay algo que deshacer con `history.back()`
   * antes de llamarlo: sin esta guarda, un cierre disparado en un estado
   * inesperado (el efecto de abajo todavía no corrió, o corrió y se limpió)
   * mandaría a la persona a la página anterior del navegador en vez de solo
   * cerrar la hoja — el peor error posible para un botón que dice «cerrar».
   */
  const entradaPropia = useRef(false);

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

  /**
   * Los filtros y el orden **vigentes**, en un ref — B-238, hallazgo del
   * auditor de trampas.
   *
   * `leer` (más abajo) vive en un efecto con deps `[]`: se engancha una sola
   * vez a propósito, para no sacar y volver a poner el listener de `popstate`
   * en cada tecleo del buscador. Pero por eso mismo su closure ve los
   * `filtros`/`orden` del primer render y no los de ahora — el mismo problema
   * que el `cerrar = useRef(alCerrar)` de `useCapaModal` resuelve para
   * `alCerrar`, acá aplicado al estado en vez de a un callback.
   */
  const vigentes = useRef({ filtros, orden });
  vigentes.current = { filtros, orden };

  /**
   * ¿El próximo `popstate` lo va a disparar **cerrar la hoja**? — B-238,
   * hallazgo del auditor de trampas.
   *
   * Sin esta bandera, cerrar la hoja con un filtro elegido adentro pisaba la
   * selección: `cerrarPanel` hace `history.back()`, que navega a la entrada de
   * **antes** de abrir la hoja —sin el filtro en su URL—, y `leer` (de abajo)
   * la leía y revertía lo que se acababa de elegir. Con la bandera, ese
   * `popstate` puntual no lee la URL vieja: en cambio, vuelve a escribir la
   * URL con los filtros vigentes (que React nunca perdió) — la hoja se cierra
   * y la selección queda.
   */
  const cerrandoLaHoja = useRef(false);

  // ── La URL, en los dos sentidos ─────────────────────────────────────────
  useEffect(() => {
    const leer = () => {
      if (cerrandoLaHoja.current) {
        cerrandoLaHoja.current = false;
        // No se lee la URL que el navegador acaba de restaurar: se vuelve a
        // escribir la de ahora, con los filtros que la hoja dejó elegidos.
        const query = aQuery(vigentes.current.filtros, vigentes.current.orden);
        window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
        return;
      }
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

  /**
   * La hoja de filtros hace `pushState` al abrirse — B-238, §8 del diseño: «el
   * botón atrás del teléfono tiene que cerrarla, no salir del sitio».
   *
   * ── Por qué es la única capa del sitio que empuja historial ───────────────
   * Las otras dos capas de `useCapaModal` (el panel de admin) tampoco lo hacen,
   * y es a propósito: ninguna se abre con la intención de "volver" a un estado
   * anterior de la página, mientras que en el teléfono el botón atrás es el
   * gesto más natural para cerrar una hoja que sube desde abajo — y sin esto
   * cierra el sitio entero, que es la trampa que este ítem viene a evitar.
   *
   * ── Un solo `popstate`, dos motivos para cerrar ────────────────────────────
   * El mismo evento sirve para el botón atrás real **y** para el cierre por UI
   * (`cerrarPanel` llama a `history.back()` en vez de `setAbierto(false)`
   * directo): así los dos caminos dejan el historial en el mismo estado, y no
   * hace falta duplicar el cierre en cada botón.
   *
   * ── La salvedad del resize ─────────────────────────────────────────────────
   * En un teléfono no se redimensiona la ventana, pero en un navegador de
   * escritorio angosto sí: si alguien la agranda con la hoja abierta, `1024px`
   * (el `lg` de Tailwind, no personalizado en este proyecto — ver
   * `global.css`) hace que el riel pase a mostrarse siempre y la hoja fija
   * quede atrás como un modal huérfano, con el scroll todavía bloqueado. El
   * `matchMedia` cierra la hoja apenas se cruza el corte, por el mismo camino
   * que cualquier otro cierre.
   */
  useEffect(() => {
    if (!abierto) return;
    window.history.pushState({ hojaDeFiltros: true }, '', window.location.href);
    entradaPropia.current = true;
    /*
     * Se marca **acá**, con el `pushState`, y no en `cerrarPanel` — a
     * propósito. Un botón atrás **real** (no el que dispara `cerrarPanel`)
     * también tiene que dejar los filtros elegidos dentro de la hoja tal como
     * quedaron: la persona quiso cerrar la hoja, no descartar su selección.
     * Marcándolo apenas se abre, `leer` sabe que CUALQUIER `popstate` que
     * llegue de acá en más — programático o real — cierra la hoja y no es una
     * navegación a leer.
     */
    cerrandoLaHoja.current = true;

    const cerrar = () => setAbierto(false);
    window.addEventListener('popstate', cerrar);

    const anchoDeEscritorio = window.matchMedia('(min-width: 1024px)');
    anchoDeEscritorio.addEventListener('change', cerrar);

    return () => {
      entradaPropia.current = false;
      // Cubre el cierre por `matchMedia`: ahí no hay `popstate` que la
      // consuma (no se navega, solo se cierra por estado), así que sin este
      // reset la bandera quedaría prendida para el próximo `popstate` que no
      // tenga nada que ver con la hoja.
      cerrandoLaHoja.current = false;
      window.removeEventListener('popstate', cerrar);
      anchoDeEscritorio.removeEventListener('change', cerrar);
    };
  }, [abierto]);

  const indice = carga.estado === 'listo' ? carga.indice : null;
  const entradas = useMemo(() => indice?.actividades ?? [], [indice]);
  const etiquetas = useMemo(() => mapaDeEtiquetas(indice?.opciones ?? {}), [indice]);
  /* D-150 — los matices elegidos para los tipos. Del mismo archivo que las
     etiquetas: el color de la categoría es taxonomía, como su nombre. */
  const tonos = useMemo(() => tonosDeTipo(indice?.opciones ?? {}), [indice]);

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

  const abrirPanel = () => setAbierto(true);

  /**
   * Cierra la hoja **deshaciendo su propia entrada de historial**, y no con
   * `setAbierto(false)` directo — es lo que hace que «Ver N actividades»,
   * `Escape`, el click en el fondo y el botón atrás del teléfono sean el mismo
   * camino (ver el efecto de arriba). `useCapaModal` le devuelve el foco al
   * botón que abrió la hoja: no hace falta pedirlo acá.
   *
   * `entradaPropia` es la guarda: sin ella, un cierre en un momento raro
   * mandaría a la persona a la página anterior del navegador en vez de solo
   * cerrar la hoja.
   */
  const cerrarPanel = () => {
    if (!entradaPropia.current) {
      setAbierto(false);
      return;
    }
    /*
     * La bandera se apaga **antes** de `history.back()`, no después —
     * hallazgo del auditor de trampas. `history.back()` es asíncrono: el
     * `popstate` que dispara no es síncrono con esta llamada, así que hay una
     * ventana en la que `entradaPropia.current` seguiría en `true` si se
     * apagara recién en la limpieza del efecto de arriba. Una segunda
     * invocación de `cerrarPanel` en esa ventana —`Escape` mantenido, un doble
     * toque en «Ver N actividades»— repetiría `history.back()` y haría
     * retroceder al navegador una entrada de más, sacando a la persona del
     * sitio. Apagada de una, la segunda invocación cae en la rama de arriba.
     *
     * `cerrandoLaHoja` no se toca acá: ya quedó en `true` desde que se abrió
     * la hoja (ver el efecto de arriba), y tiene que seguir así para un botón
     * atrás **real** además de este cierre programático.
     */
    entradaPropia.current = false;
    window.history.back();
  };

  useCapaModal(caja, cerrarPanel, abierto);

  const deshabilitado = carga.estado !== 'listo';

  return (
    <div className="lg:grid lg:grid-cols-[var(--spacing-riel)_minmax(0,1fr)] lg:items-start lg:gap-x-10">
      {/* ══ El riel: el índice del programa ═══════════════════════════════ */}
      {/*
        `lg:sticky` con el `top` en `--spacing-encabezado`, que es **el mismo
        token** del que sale la altura de la cabecera. Sin el `top` el riel se
        metería debajo de ella al scrollear, y con un número escrito a mano se
        desincroniza el día que la cabecera cambie, sin que falle nada
        (corrección 10 de `stitch-detalle.md`). Y `max-h`/`overflow-y-auto` para que un índice con muchos
        barrios no quede con la mitad fuera de la pantalla y sin forma de llegar.
      */}
      <aside className="regla-gruesa-arriba pt-3 lg:sticky lg:top-encabezado lg:max-h-[calc(100dvh-var(--spacing-encabezado)-2rem)] lg:overflow-y-auto lg:pb-4">
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
            type="button"
            aria-expanded={abierto}
            aria-controls={`${id}-filtros`}
            disabled={deshabilitado}
            onClick={() => (abierto ? cerrarPanel() : abrirPanel())}
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

        {/*
          El fondo de la hoja — B-238. Solo en el teléfono (`lg:hidden`, aunque
          nunca debería montarse ahí: ver el `matchMedia` del efecto de arriba) y
          solo mientras está abierta. El click acá cierra; el click sobre la hoja,
          no — es el mismo patrón que `CentroAyuda` del panel.

          **`bg-tinta` sólida, no atenuada** (`sistema-visual.test.ts`, B-235):
          el sistema no tiene ninguna clase de color con opacidad en todo el
          sitio — «usá la tinta que corresponde en vez de atenuar» es literal,
          y `tinta` sin diluir es la que corresponde acá. No hace falta ver el
          listado *a través* del fondo para entender que quedó inerte: alcanza
          con que la hoja tape lo que sí importa y el resto quede cubierto.
          Sin desenfoque —`backdrop-blur` también está prohibido en todo el
          sitio— y sin la sombra que un modal de plataforma pondría: la
          separación es solo tinta plana, igual que el resto del sistema.
        */}
        {abierto && (
          <div
            className="fixed inset-0 z-40 bg-tinta lg:hidden"
            aria-hidden="true"
            onPointerDown={cerrarPanel}
          />
        )}

        {indice && (
          /*
            Los ejes. En el teléfono son una hoja inferior de verdad — B-238,
            §8 del diseño— con el tope de 65svh de D-143 —`svh` y no `vh` porque
            en un navegador móvil con barra retráctil `vh` mide la pantalla sin
            la barra y el panel termina más alto que el hueco real—. En `lg`
            están siempre, inline en el riel y sin tope propio: el `aside` ya
            tiene el suyo, y ninguna de las clases de hoja (`fixed`, el borde, el
            fondo) aplica ahí.

            Se renderiza siempre (no `abierto && …`) y se esconde con clases: así
            en `lg` está sin depender del estado de la hoja, que allá no se usa.
            `role`/`aria-modal` sí son condicionales: en `lg` este `div` es un
            panel más de la página, no un diálogo, y anunciarlo como tal ahí
            sería un dato falso para quien usa lector de pantalla.
          */
          <div
            ref={caja}
            id={`${id}-filtros`}
            tabIndex={-1}
            role={abierto ? 'dialog' : undefined}
            aria-modal={abierto ? true : undefined}
            aria-label="Filtros"
            className={`${
              abierto
                ? 'fixed inset-x-0 bottom-0 z-50 flex max-h-[65svh] flex-col gap-5 overflow-y-auto border-t-2 border-tinta bg-papel px-4 pt-4 pb-segura'
                : 'hidden'
            } lg:static lg:z-auto lg:mt-6 lg:flex lg:max-h-none lg:flex-col lg:gap-5 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0`}
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
              Cerrar desde abajo, y no solo con Escape o el fondo: quien terminó
              de tocar filtros está al final del panel, y volver arriba a buscar
              un botón "cerrar" es el paso que sobra. Pasa por `cerrarPanel`
              como cualquier otro cierre — B-238 — así que también deshace la
              entrada de historial y (vía `useCapaModal`) devuelve el foco al
              abridor.

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
                tonos={tonos}
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
