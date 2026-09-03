/**
 * El tríptico de «¿Qué hay ahora?» — **B-600**, la mitad de UI de B-99.
 *
 * Tres paneles —**Hoy · Mañana · Este finde**— arriba del listado de la home,
 * con los encuentros que caen en cada ventana. Es la portada del programa: la
 * respuesta a «¿qué hay el sábado?», que el listado ordenado por próxima fecha
 * no da de un vistazo.
 *
 * ── Es presentacional, y no puede no serlo ────────────────────────────────
 * No decide una sola frase ni formatea una sola fecha: todo llega resuelto desde
 * `lib/ahoraPublico.ts`, que es puro y está testeado. Acá no hay `Intl`, no hay
 * comparaciones de fecha y **no se lee ninguna `EntradaDeIndice`** — eso último
 * lo verifica `tests/listado-del-sitio.test.ts`, que falla si un componente de
 * esta carpeta que no sea la fila le abre un campo a la entrada.
 *
 * Es el mismo corte que `FilaDeActividad` / `lib/tarjetaPublica.ts`, y por el
 * mismo motivo: los componentes de este repo no tienen tests de render
 * (`docs/05-patrones.md`), así que lo que quede acá adentro no se verifica en
 * ninguna parte.
 *
 * ── Un solo markup, dos relojes ───────────────────────────────────────────
 * Este componente lo renderiza el **build** (Astro lo pasa a HTML, sin
 * hidratar y sin mandar un byte de JavaScript por él) y lo renderiza la
 * **island** cuando tiene el `events.json`, que es la que lo recalcula con el
 * reloj de quien mira. Una sola definición, dos usos — la regla del §6.3, que
 * acá pesa más que en el listado: el rótulo «Hoy» del build envejece de un día
 * para el otro, mientras que una fila de listado no.
 *
 * ── La forma ──────────────────────────────────────────────────────────────
 * Tres columnas en `lg`, apiladas en el teléfono, separadas por **reglas** y no
 * por cajas: es una sección del programa, no tres tarjetas. La regla cambia de
 * eje con el viewport —arriba de cada panel cuando están apilados, a la
 * izquierda cuando están al lado— porque un separador horizontal entre columnas
 * no separa nada.
 */
import { CLASES_DEL_TRIPTICO, foco } from '@/components/sitio/estilos';
import type { ProgramacionInmediata } from '@/lib/ahoraPublico';
import { estiloDeTipo, type TonosDeTipo } from '@/lib/listadoPublico';

interface Props {
  /** Los tres paneles y el sello de frescura, ya resueltos. */
  programacion: ProgramacionInmediata;
  /** Los matices elegidos para los tipos (D-150), para pintar la categoría. */
  tonos: TonosDeTipo;
  /** El `id` del `h2`, para que el `aria-labelledby` de la sección lo alcance. */
  id?: string;
}

/** El alto de las columnas no se iguala: cada panel mide lo que tiene. */
export function PanelesDeAhora({ programacion, tonos, id = 'ahora' }: Props) {
  const { sello, paneles } = programacion;
  /*
   * Cuántas columnas: **las que hay**, topeadas a tres y con piso en una.
   *
   * El tope y el piso no son defensivos de más, son lo que hace que el índice sea
   * del tipo que el mapa declara. El piso lo pidió el `auditor-privacidad`: con
   * `paneles: []` el `Math.min` da **0**, `CLASES_DEL_TRIPTICO[0]` es `undefined`
   * y el `div` saldría sin ninguna clase de grilla. Hoy es inalcanzable —
   * `panelesDeAhora` devuelve `null` antes que una lista vacía— pero el `as` apaga
   * al type-checker justo donde `ProgramacionInmediata` no codifica el «no
   * vacío», así que el `|| 1` es lo que evita que un cambio de contrato allá se
   * convierta acá en una grilla sin clase.
   */
  const columnas = (Math.min(paneles.length, 3) || 1) as 1 | 2 | 3;

  return (
    /*
      El margen de abajo lo trae la sección y no el llamador: la pintan el build
      —arriba del buscador— y la island —arriba de la grilla—, y escrito en los
      dos lados el día que cambie el ritmo vertical quedan dos separaciones
      distintas para la misma banda, cada una visible en un momento distinto.
      El de arriba sí es del llamador: lo pone el contenedor del ancla.
    */
    <section aria-labelledby={id} className="regla-gruesa-arriba mb-8 sm:mb-10">
      {/*
        La banda de la sección, en la capa tonal: es lo que la separa del
        encabezado de la página sin dibujar una caja. `label-caps` y no un
        titular — el gesto grande de la home es el marcador de mes, y esta banda
        es un rótulo de sección, no un segundo título.
      */}
      <div className="regla-fina flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-crema px-2 py-2 lg:px-4">
        <h2 id={id} className="label-caps text-tinta">
          ¿Qué hay ahora?
        </h2>
        {/*
          De cuándo son los datos. Es la línea que explica por qué algo cargado
          hace diez minutos todavía no está: el sitio es estático y se rehace con
          unos minutos de latencia (§8). Sin ella, «Hoy» promete ser el estado
          del mundo.
        */}
        {sello && <p className="label-caps text-super">{sello}</p>}
      </div>

      {/*
        **La grilla se adapta a cuántos paneles quedaron** — D-320, 2026-09-03.
        Desde que un panel sin encuentros no se dibuja pueden ser uno, dos o tres,
        y `lg:grid-cols-3` fija dejaría columnas fantasma. El mapa de literales
        vive en `components/sitio/estilos.ts` por una razón mecánica: Tailwind
        genera las utilidades leyendo el fuente, así que una clase armada acá en
        tiempo de ejecución no existiría en la hoja.
      */}
      <div className={CLASES_DEL_TRIPTICO[columnas]}>
        {paneles.map((panel, i) => (
          <article
            key={panel.clave}
            /*
              La regla que separa un panel del siguiente, y **cambia de eje**: en
              el teléfono los paneles van uno debajo del otro y la regla va
              arriba; en `lg` van al lado y la regla va a la izquierda. El primero
              no lleva ninguna: ya lo cerró la banda de la sección.
            */
            className={`min-w-0 border-borde ${
              i === 0 ? '' : 'border-t lg:border-t-0 lg:border-l'
            }`}
          >
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-2 pb-2 pt-3 lg:px-4">
              <h3 className="headline-sm text-tinta">{panel.rotulo}</h3>
              {/*
                **Los días que abarca, escritos.** No es decoración: es lo que
                impide que un rótulo del build —«Hoy»— mienta cuando la página se
                mira un día después del último rebuild. Ver el docblock de
                `lib/ahoraPublico.ts`.
              */}
              <p className="label-caps text-super">{panel.fechas}</p>
            </header>

            {/*
              **No hay rama vacía**: un panel sin encuentros ya no llega hasta
              acá — lo filtra `panelesDeAhora`, que es donde se puede testear. La
              había, y la sacó el dueño mirando la pantalla (D-320).
            */}
            <ul className="flex flex-col">
              {panel.encuentros.map((e) => (
                /*
                  La regla fina va en el `<li>` y no en el `<a>`, como en la
                  fila del listado: así el hover pinta hasta el borde sin
                  comerse la regla.
                */
                <li key={e.clave} className="regla-fina min-w-0">
                  {/*
                    Todo el encuentro es un link y no hay botones adentro: en
                    móvil un botón dentro de un link es un blanco ambiguo
                    (§4.2). Lleva a la actividad —no hay página por encuentro—,
                    que es donde están las ocho fechas del ciclo, la sede y cómo
                    anotarse.
                  */}
                  <a
                    href={e.ruta}
                    className={`group flex min-w-0 flex-col gap-1 px-2 py-3 transition-colors hover:bg-crema lg:px-4 ${foco}`}
                  >
                    {/*
                      La hora, y el día solo cuando el panel abarca dos (el
                      finde). En «Hoy» el día ya lo dijo el encabezado.

                      En el panel de hoy va en el acento: es la tinta de lo que
                      se puede hacer, y hoy es el único de los tres donde la
                      hora es una decisión inmediata.
                    */}
                    <time
                      dateTime={e.iso}
                      className={`label-caps ${panel.clave === 'hoy' ? 'text-acento' : 'text-tinta'}`}
                    >
                      {e.dia ? `${e.dia} · ${e.hora}` : e.hora}
                    </time>

                    <h4 className="headline-sm text-tinta group-hover:text-acento">{e.titulo}</h4>

                    <p className="body-sm text-super">{e.lugar}</p>

                    <div className="flex flex-wrap items-center gap-2">
                      {/*
                        La categoría en la tinta de su tipo (D-150): el color
                        sale de `estiloDeTipo` y va por `style`, porque es un
                        dato —el matiz derivado del slug, o el elegido desde
                        Opciones— y Tailwind solo genera las clases que ve
                        escritas. Sin tinta escrita a mano acá: dos colores para
                        el mismo elemento es la clase de bug de B-260.
                      */}
                      <span
                        className="label-caps border px-1.5 py-1"
                        style={estiloDeTipo(tonos, e.tipo)}
                      >
                        {e.tipoEtiqueta}
                      </span>
                      {e.arancel.texto && (
                        <span
                          className={`label-caps ${
                            /*
                              «A la gorra» es la mitad de los casos del circuito
                              y no entra en el binario gratis/pago (§4.1 del
                              `CLAUDE.md`): va con el acento. Lo decide
                              `esSinCosto` en el módulo, no una comparación acá.
                            */
                            e.arancel.sinCosto ? 'text-acento' : 'text-tinta'
                          }`}
                        >
                          {e.arancel.texto}
                        </span>
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </ul>

            {/*
              Lo que el tope dejó afuera. Es texto y no un link a propósito: el
              día no es una URL de este sitio (§2.3) y el listado completo está en
              esta misma página, más abajo. El motivo largo está en
              `lib/ahoraPublico.ts`.
            */}
            {panel.resto && (
              <p className="label-caps px-2 py-3 text-super lg:px-4">{panel.resto}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
