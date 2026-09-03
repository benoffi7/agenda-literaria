/**
 * El buscador del archivo — B-292, §4.5: «sin filtros salvo la búsqueda».
 *
 * ── Qué le faltaba a `/pasadas` ───────────────────────────────────────────
 * La página se construyó sin buscador (B-109, **D-167**) con un motivo escrito:
 * la búsqueda del sitio es la island de la home, que filtra `vigentesDelIndice`
 * —el índice de lo **vigente**, que por definición no incluye una pasada— así que
 * traerla acá era enseñarle un modo nuevo y cambiarle el contrato. Mientras
 * tanto la página enlazaba la búsqueda de la agenda, que busca en otra cosa.
 *
 * ── Y por qué esto no es una segunda búsqueda ─────────────────────────────
 * Porque lo que se reusa es **el match**, que es lo único que puede contestar
 * distinto: `buscarEnPasadas` (`lib/pasadasPublicas.ts`) filtra con
 * `coincideBusqueda` (`lib/listadoPublico.ts`), la misma función que usa
 * `filtrarPublico` para la home, los hubs y las páginas de mes. Dos definiciones
 * de «coincide» serían la home y el archivo contestando distinto a la misma
 * consulta, en lo único que la gente usa tipeando — la clase de B-88.
 *
 * Lo mismo con el markup: las filas las pinta `ListaDeActividades`, el **mismo**
 * componente que imprime el build, así que no hay dos ideas de cómo se ve una
 * fila del archivo (es lo que el §6.3 pide para la home y vale igual acá).
 *
 * Y con el texto: las frases salen de `frasesDePasadas` y el contador de
 * `cuentaDePasadas`, que es lo que hace que el barrido de centinelas de la salida
 * 10 los vea. **Este componente no escribe ni una palabra**, y hay un test que lo
 * exige —ningún literal suelto en el markup, ningún template con los datos
 * adentro—: el contador **sí** estaba armado acá con un template, y lo encontró
 * el `auditor-privacidad`. Un texto escrito en este archivo queda fuera del
 * barrido, y la mutación que pasaría en verde es de un carácter.
 *
 * ── Por qué una island chica y no `Buscador` ──────────────────────────────
 * `Buscador` trae el riel de filtros, la hoja modal del teléfono, el selector de
 * orden, los chips y la serialización a la query string: todo eso es la home, y
 * el §4.5 pide para el archivo **una** dimensión. Montarlo acá sería montar la
 * home en el archivo, y además obligaría a darle un modo nuevo —justo lo que
 * D-167 dejó anotado como el costo de esta funcionalidad.
 *
 * ── El HTML del build no se toca hasta tener el índice ────────────────────
 * Mismo patrón que la home (§6.3): el build imprime el archivo completo, esta
 * island hace **un solo fetch** de `/events.json` y recién cuando lo tiene saca
 * del DOM la lista del build y renderiza la suya. Como el estado inicial es sin
 * texto, lo que aparece es idéntico a lo que había: no hay parpadeo.
 *
 * **Si el fetch falla no se saca nada**: la lista del build sigue ahí, el campo
 * queda deshabilitado y hay un aviso. Nunca una pantalla vacía — que en esta
 * página importa más que en la home, porque la razón de ser del archivo es que
 * cada actividad que pasó conserve un link interno (§2.1).
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { ListaDeActividades } from '@/components/publico/ListaDeActividades';
import { claseCampo, claseEtiquetaDeCampo } from '@/components/sitio/estilos';
import type { Indice } from '@/lib/eventsJson';
import { mapaDeEtiquetas, tonosDeTipo } from '@/lib/listadoPublico';
import {
  buscarEnPasadas,
  cuentaDePasadas,
  frasesDePasadas,
  pasadasDelSitio,
} from '@/lib/pasadasPublicas';

interface Props {
  /**
   * La versión del build. Va como `?v=` del fetch, igual que en la home: blinda
   * contra un intermediario que sirva el JSON del build anterior contra el HTML
   * del nuevo (§9).
   */
  version: string;
  /**
   * El id del contenedor con el archivo que imprimió el build. Se saca del DOM
   * cuando esta island toma el control, para no tener las filas dos veces.
   */
  idListadoEstatico: string;
}

type Carga = { estado: 'cargando' } | { estado: 'listo'; indice: Indice } | { estado: 'error' };

export function BuscadorDePasadas({ version, idListadoEstatico }: Props) {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [q, setQ] = useState('');
  /**
   * El reloj **del cliente**, congelado al montar — igual que en la home.
   *
   * Acá decide qué actividad ya pasó, así que es el que hace que una que terminó
   * después del build aparezca en el archivo sin esperar al rebuild siguiente.
   * Congelado y no `new Date()` en cada render: dos renders seguidos darían dos
   * «ahora» distintos y una actividad podría cambiar de lado en medio de un tipeo.
   */
  const [ahora] = useState(() => new Date());
  const id = useId();

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
        // Recién acá se saca el archivo del build: sacándolo antes, un fetch que
        // falla dejaría la página sin una sola fila.
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
  /*
   * `pasadasDelSitio` es la misma función que usó el build (`vistaDePasadas`), así
   * que el orden —de lo más reciente a lo más viejo— y el criterio de «pasó» son
   * los mismos de los dos lados. Derivarlos acá otra vez sería que la lista se
   * reacomode sola al hidratar.
   */
  const pasadas = useMemo(
    () => (indice ? pasadasDelSitio(indice.actividades, ahora) : []),
    [indice, ahora],
  );
  const etiquetas = useMemo(() => mapaDeEtiquetas(indice?.opciones ?? {}), [indice]);
  const tonos = useMemo(() => tonosDeTipo(indice?.opciones ?? {}), [indice]);
  const visibles = useMemo(() => buscarEnPasadas(pasadas, q), [pasadas, q]);
  const frases = useMemo(() => frasesDePasadas(pasadas), [pasadas]);

  const deshabilitado = carga.estado !== 'listo';

  return (
    <div>
      <div className="max-w-xl">
        <label htmlFor={`${id}-q`} className={claseEtiquetaDeCampo}>
          {frases.buscar}
        </label>
        {/*
          No roba el foco al cargar: en un teléfono abriría el teclado y taparía
          el archivo, que es lo que se vino a ver (mismo criterio que la home).
        */}
        <input
          id={`${id}-q`}
          type="search"
          value={q}
          disabled={deshabilitado}
          onChange={(e) => setQ(e.target.value)}
          placeholder={frases.pista}
          className={`${claseCampo} body-md disabled:opacity-60`}
        />
      </div>

      {/*
        §10 — el contador va en un `aria-live="polite"`: quien usa lector de
        pantalla tiene que enterarse de que la lista cambió sin ir a buscarla.
        `atomic` para que lea la frase entera y no solo el número.
      */}
      <p aria-live="polite" aria-atomic="true" className="label-caps mt-4 text-super">
        {carga.estado === 'cargando' && frases.cargando}
        {carga.estado === 'error' && frases.error}
        {carga.estado === 'listo' && cuentaDePasadas(visibles.length, pasadas.length)}
      </p>

      {/* ── El archivo, una vez que la island tomó el control ─────────── */}
      {indice && (
        <div className="mt-8 sm:mt-10">
          {visibles.length > 0 ? (
            <ListaDeActividades
              entradas={visibles}
              ahora={ahora}
              etiquetas={etiquetas}
              tonos={tonos}
            />
          ) : (
            <p className="body-md regla-gruesa-arriba px-4 py-12 text-center text-super">
              {/*
                Y distingue «el archivo está vacío» de «no encontré eso»: son dos
                situaciones distintas y la segunda tiene arreglo. La island borró la
                lista del build, así que el aviso que esa lista tenía para el caso
                vacío tiene que existir también acá.
              */}
              {pasadas.length === 0 ? frases.vacio : frases.sinResultados}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
