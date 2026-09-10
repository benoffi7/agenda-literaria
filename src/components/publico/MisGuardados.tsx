import { useEffect, useMemo, useState } from 'react';

import { FilaDeActividad } from '@/components/publico/FilaDeActividad';
import { claseBotonSecundario, claseEnlace, claseRotulo } from '@/components/sitio/estilos';
import type { Indice } from '@/lib/eventsJson';
import {
  leerBusquedas,
  leerFavoritos,
  olvidarBusqueda,
  olvidarFavorito,
} from '@/lib/guardadoDelNavegador';
import {
  cuantosSinFicha,
  llaveDeFavorito,
  resolverFavoritos,
  type BusquedaGuardada,
  type Favorito,
} from '@/lib/guardadosDelSitio';
import { mapaDeEtiquetas, tonosDeTipo } from '@/lib/listadoPublico';
import { RUTA_AGENDA } from '@/lib/rutasPublicas';

/**
 * La sección propia de lo guardado — B-848, D-630.
 *
 * ── Por qué esta página sí es una island y el detalle no ─────────────────
 * `/mis-favoritos` **no tiene contenido que el build pueda imprimir**: lo que
 * muestra sale del `localStorage` de quien la abre. Así que acá no aplica el
 * argumento de B-239 —«no le agregues el runtime de React a la página más
 * visitada»— porque esta no es la página más visitada ni la que llega desde
 * Google: es una página a la que se entra a propósito, y sin JavaScript no
 * podría existir de ninguna manera. Se monta con `client:only="react"`, que es
 * lo único honesto cuando el servidor no puede renderizar nada.
 *
 * El botón de la ficha del detalle, en cambio, **no es React**: es un `<script>`
 * liso, la misma forma que ya usan el aviso de cookies y «copiar la
 * dirección del calendario». Esa decisión está tomada allá y es la que mantiene
 * a la página de detalle sin framework.
 *
 * ── El markup de la fila no se reescribe ─────────────────────────────────
 * Cada favorito se pinta con `FilaDeActividad`, el mismo componente del listado
 * y del build. Un segundo markup de la fila «pero para favoritos» se separaría en
 * el primer cambio, que es exactamente lo que el §6.3 pide evitar. Lo único que
 * agrega esta pantalla es el botón «Quitar», y va por la prop `accion` — fuera
 * del enlace, porque un botón adentro de un link es un blanco ambiguo (§4.2).
 *
 * ── La actividad que ya pasó sigue estando, y sin atenuar ────────────────
 * Es la decisión del dueño: **la actividad vencida sigue siendo favorita y no se
 * esconde**. Lo que **no** se hace es griseala, y eso no es una preferencia: el
 * sistema visual del sitio prohíbe las opacidades («tintas con nombre, no
 * opacidades», D-146/B-235, y lo verifica `tests/sistema-visual.test.ts`), y ya
 * hubo un pedido idéntico rechazado con ese argumento — el §4.5 pedía las
 * tarjetas de `/pasadas` «atenuadas» y se resolvió con **tinta**, no con
 * opacidad (D-167).
 *
 * La distinción ya la trae la fila y **no es solo color**: el bloque de fecha de
 * una pasada va en `super` en vez de terracota *y dice la palabra* «Pasó»
 * (`bloqueDeFecha`). Eso es lo que pide la regla de accesibilidad —el color
 * nunca puede ser la única señal— y ya estaba resuelto antes de este cambio.
 *
 * ── Lo que no está en la agenda tampoco se esconde ───────────────────────
 * Un favorito cuyo slug no aparece en el `events.json` del último build —se
 * despublicó, se canceló, se borró— se dibuja igual, con lo poco que sabemos de
 * él y su botón para sacarlo. Hacerlo desaparecer sería borrarle a alguien algo
 * que guardó sin decirle nada; dejarlo sin botón sería dejárselo para siempre.
 */

interface Props {
  /** La versión del build, para cachear el `events.json` igual que el listado. */
  version: string;
}

type Carga = { estado: 'cargando' } | { estado: 'listo'; indice: Indice } | { estado: 'error' };

export function MisGuardados({ version }: Props) {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [busquedas, setBusquedas] = useState<BusquedaGuardada[]>([]);
  /*
   * El reloj de quien mira, y no el del build: es lo mismo que hace el listado
   * (§6.4). Un favorito de anteayer tiene que decir «Pasó» aunque el último
   * build sea de la semana pasada.
   */
  const [ahora] = useState(() => new Date());

  // Lo guardado se lee **al montar** y no en el `useState` inicial: `leerFavoritos`
  // toca `localStorage`, y eso es un efecto, no un cálculo.
  useEffect(() => {
    setFavoritos(leerFavoritos());
    setBusquedas(leerBusquedas());
  }, []);

  useEffect(() => {
    let vigente = true;
    fetch(`/events.json?v=${encodeURIComponent(version)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Indice>;
      })
      .then((indice) => {
        if (vigente) setCarga({ estado: 'listo', indice });
      })
      .catch(() => {
        if (vigente) setCarga({ estado: 'error' });
      });
    return () => {
      vigente = false;
    };
  }, [version]);

  const indice = carga.estado === 'listo' ? carga.indice : null;
  const etiquetas = useMemo(() => mapaDeEtiquetas(indice?.opciones ?? {}), [indice]);
  const tonos = useMemo(() => tonosDeTipo(indice?.opciones ?? {}), [indice]);
  const resueltos = useMemo(
    () => resolverFavoritos(favoritos, indice?.actividades ?? []),
    [favoritos, indice],
  );
  const perdidos = cuantosSinFicha(resueltos);

  return (
    <div className="mt-8 flex flex-col gap-12">
      {/* ══ Los favoritos ═════════════════════════════════════════════════ */}
      <section aria-labelledby="favoritos">
        <h2 id="favoritos" className="headline-sm regla-gruesa-arriba pt-3 text-tinta">
          Lo que guardaste
        </h2>

        {favoritos.length === 0 ? (
          <p className="body-md mt-4 text-super">
            Todavía no guardaste nada. En la página de cada actividad hay un botón
            para guardarla, y desde acá la vas a poder ver y sacar.{' '}
            <a href={RUTA_AGENDA} className={claseEnlace}>
              Ir a la agenda
            </a>
          </p>
        ) : (
          <>
            <p aria-live="polite" className={`${claseRotulo} mt-3`}>
              {carga.estado === 'cargando' && 'Buscando en la agenda…'}
              {carga.estado === 'error' &&
                'No se pudo leer la agenda: mostramos lo guardado sin sus datos'}
              {carga.estado === 'listo' &&
                `${favoritos.length} ${favoritos.length === 1 ? 'guardada' : 'guardadas'}`}
            </p>

            {/*
              El aviso de las que ya no están. Va **arriba de la lista** y no
              pegado a cada fila: pegado a cada fila se repite N veces y no dice
              nada nuevo; acá explica de una qué son esas filas distintas.
            */}
            {perdidos > 0 && carga.estado === 'listo' && (
              <p className="body-sm mt-2 text-super">
                {perdidos === 1
                  ? 'Una de las que guardaste ya no está en la agenda.'
                  : `${perdidos} de las que guardaste ya no están en la agenda.`}{' '}
                Puede ser que se haya dado de baja. Podés sacarla de la lista.
              </p>
            )}

            <ul className="regla-gruesa-arriba mt-4">
              {resueltos.map(({ favorito, ficha }) => {
                /*
                  La `key` es **tipo + slug** y no el slug solo, por lo mismo que la
                  llave de lo guardado: el día que exista `libreria`, una librería
                  y un taller con el mismo slug —«la-boca»— son dos favoritos
                  distintos, y con la key repetida React reusaría el nodo del
                  otro. Sale de la misma función que la llave, no escrita acá.
                */
                const llave = llaveDeFavorito(favorito.tipo, favorito.slug);
                const quitar = (
                  <button
                    type="button"
                    className={`${claseBotonSecundario} body-sm`}
                    onClick={() => setFavoritos(olvidarFavorito(favorito.tipo, favorito.slug))}
                  >
                    Quitar de mis guardadas
                  </button>
                );

                return ficha ? (
                  <FilaDeActividad
                    key={llave}
                    entrada={ficha}
                    ahora={ahora}
                    etiquetas={etiquetas}
                    tonos={tonos}
                    accion={quitar}
                  />
                ) : (
                  /*
                    La fila de la que no está. **No usa `FilaDeActividad`** y no
                    puede: aquélla necesita una `EntradaDeIndice` entera y acá lo
                    único que hay es el slug. Se dibuja con la misma regla fina
                    para que la lista se lea como una sola, y dice qué pasó con
                    palabras — no con un color.

                    Mientras el índice todavía no llegó **esta rama no se pinta**:
                    con `carga` en «cargando» todos los favoritos resuelven a
                    `null` y la pantalla diría que se cayeron todos.
                  */
                  carga.estado !== 'cargando' && (
                    <li key={llave} className="regla-fina min-w-0 px-2 py-4 lg:px-4">
                      {/*
                        **El rótulo depende de por qué no está**, y no es un
                        detalle: con el fetch caído todos los favoritos resuelven
                        a `null`, y decirle a alguien que sus doce actividades
                        «ya no están en la agenda» por una CDN que no contestó es
                        una mentira que asusta. Es el mismo cuidado que el
                        listado tiene con su aviso de error (§6.3).
                      */}
                      <p className={claseRotulo}>
                        {carga.estado === 'error'
                          ? 'No se pudo cargar la agenda'
                          : 'Ya no está en la agenda'}
                      </p>
                      <p className="body-md mt-1 text-tinta">{favorito.slug}</p>
                      <div className="mt-1">{quitar}</div>
                    </li>
                  )
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* ══ Las búsquedas guardadas ═══════════════════════════════════════ */}
      <section aria-labelledby="busquedas">
        <h2 id="busquedas" className="headline-sm regla-gruesa-arriba pt-3 text-tinta">
          Tus búsquedas guardadas
        </h2>

        {busquedas.length === 0 ? (
          <p className="body-md mt-4 text-super">
            Cuando pongas filtros en la agenda —un barrio, un tema, «gratis»— vas a
            poder guardar esa búsqueda con un nombre y volver a ella desde acá.{' '}
            <a href={RUTA_AGENDA} className={claseEnlace}>
              Ir a la agenda
            </a>
          </p>
        ) : (
          <ul className="regla-gruesa-arriba mt-4">
            {busquedas.map((b) => (
              <li
                key={b.url}
                className="regla-fina flex min-w-0 flex-col gap-1 px-2 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 lg:px-4"
              >
                {/*
                  El `href` sale de `esRutaGuardable`, que ya rechazó todo lo que
                  no sea una ruta interna de este sitio: sin esa validación, un
                  `javascript:` escrito a mano en la consola sería XSS en la
                  propia máquina. Ver `guardadosDelSitio.ts`.
                */}
                <a href={b.url} className={`${claseEnlace} body-md min-w-0`}>
                  {b.nombre}
                </a>
                <button
                  type="button"
                  className={`${claseBotonSecundario} body-sm shrink-0`}
                  onClick={() => setBusquedas(olvidarBusqueda(b.url))}
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
