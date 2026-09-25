import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { textoDeFallo } from '@/lib/fallosDelPanel';
// M-17 — cada pestaña en su archivo; este se queda con la carga y las pestañas.
import { PanelCatalogo } from '@/components/admin/estadisticas/PanelCatalogo';
import { PanelSitioPublico } from '@/components/admin/estadisticas/PanelSitioPublico';
import { encuentrosDe } from '@/lib/calendarioPanel';
import { ritmoDelCatalogo } from '@/lib/ritmoDelCatalogo';
import { useLabelsTaxonomia, useOpciones } from '@/components/admin/useOpciones';
import { listarActividades } from '@/lib/actividades';
import { medirFuncion } from '@/lib/analytics';
import { estadoDelCatalogo } from '@/lib/estadoDelCatalogo';
/*
 * D-150 — los matices elegidos a mano salen de la **misma** función que los
 * saca del `events.json` para el sitio público, no de un `filter` copiado acá:
 * la promesa de D-150 es que el panel y el listado pinten la misma categoría
 * del mismo color, y dos derivaciones de «qué tono cuenta» es exactamente la
 * forma de que se separen sin que nada falle.
 */
import { tonosDeTipo } from '@/lib/listadoPublico';
import { legible } from '@/lib/filtrosActividades';
import { leerAnaliticaDelSitio } from '@/lib/analiticaDelSitio';
import type { ResumenDelSitio } from '@/lib/resumenDelSitio';
import type { ActividadConId, CampoTaxonomia } from '@/types/actividad';

/**
 * «Estado del catálogo» — el tablero del panel (B-370, D-860).
 *
 * Es el primer tramo de [`docs/16-analitica-del-sitio.md`](../../../docs/16-analitica-del-sitio.md):
 * el pedido era un tablero de estadísticas del sitio, y el sitio público **no
 * mide nada**, así que no hay visitas que mostrar. Esto muestra lo que se sabe
 * **sin medir a ningún visitante**, que además es lo único que se convierte en
 * trabajo del día siguiente.
 *
 * **Dos pestañas internas, no una página larga (B-501).** El pedido original
 * era «una opción para ver estadísticas del sitio» y creció a dos mitades bien
 * distintas —el catálogo, medido hoy, y el sitio público, que todavía no mide
 * nada (§2 del documento)— y apilarlas en una sola página las hacía competir
 * por el primer scroll. Es un island `client:only`, así que hay JavaScript de
 * sobra para pestañas de verdad: estado de React, sin navegación, con el
 * patrón de pestañas de WAI-ARIA (activación automática con las flechas, la
 * misma familia que ya usa `CentroAyuda`).
 *
 * Cuatro propiedades, todas deliberadas:
 *
 * 1. **No mide a nadie** en la pestaña del catálogo. No existe el visitante
 *    ahí, y nada de lo que se ve sale del navegador del dueño.
 * 2. **No cuesta una lectura de Firestore de más**: es la misma
 *    `listarActividades()` que el listado ya hace, agrupada de otra manera. El
 *    cálculo es puro y vive en `lib/estadoDelCatalogo.ts`; acá solo se acomoda.
 * 3. **Los gráficos son barras de CSS**, sin ninguna dependencia nueva —y cada
 *    barra lleva su número escrito al lado: la barra ayuda a comparar, no
 *    informa sola. Va `aria-hidden` justamente por eso. El mapa de calor del
 *    ritmo (B-1081, `estadisticas/Ritmo.tsx`) sigue la misma regla con otra
 *    forma: es una `<table>` con el número escrito en cada celda, y el color
 *    solo ayuda a encontrar la semana cargada.
 * 4. **Los avisos van primero.** Es lo accionable, y lo demás es contexto. Un
 *    tablero que abre con gráficos y esconde «hay tres publicadas a las que no
 *    se puede entrar» tiene el orden al revés.
 *
 * Las etiquetas de taxonomía las resuelve esta pantalla y no el módulo puro
 * (§4.1): el reparto viene por slug y el label sale de `/opciones/*`, con
 * `legible` de último recurso — el mismo respaldo que usa el listado.
 *
 * **Cada pestaña vive en su archivo** (M-17): `estadisticas/PanelCatalogo.tsx` y
 * `estadisticas/PanelSitioPublico.tsx`. Este se queda con lo que es de las dos:
 * la carga, las pestañas y el reloj congelado.
 */

interface Props {
  /** Abre una actividad señalada por un aviso. Un aviso sin salida no se atiende. */
  onEditar: (a: ActividadConId) => void;
}

// ─────────────────────────────────────────────────────────────────
// Pestañas — B-501
// ─────────────────────────────────────────────────────────────────

type Pestania = 'catalogo' | 'sitio-publico';

const PESTANIAS: { id: Pestania; etiqueta: string }[] = [
  { id: 'catalogo', etiqueta: 'El catálogo' },
  { id: 'sitio-publico', etiqueta: 'El sitio público' },
];

// ─────────────────────────────────────────────────────────────────
// El panel entero — pestañas + estado de carga
// ─────────────────────────────────────────────────────────────────

export function EstadisticasPanel({ onEditar }: Props) {
  const [actividades, setActividades] = useState<ActividadConId[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState<string | null>(null);
  const [pestania, setPestania] = useState<Pestania>('catalogo');
  /**
   * El resumen del sitio (B-374/B-373). `null` = todavía no se pidió.
   *
   * **Se pide al abrir la pestaña y no al montar el tablero**: es una lectura
   * de Firestore que la mayoría de las visitas al tablero no necesita —la
   * pestaña por defecto es la del catálogo—, y el §8 hace un punto de que esta
   * pantalla no cueste una lectura de más. Una vez pedido queda: el documento
   * lo reescribe una Function una vez por día, así que volver a la pestaña no
   * tiene nada nuevo que traer.
   */
  const [resumenDelSitio, setResumenDelSitio] = useState<ResumenDelSitio | null>(null);
  const labels = useLabelsTaxonomia();
  /** Los valores crudos de `tipo`, que son los que llevan el matiz elegido (D-150). */
  const opcionesDeTipo = useOpciones('tipo');
  const idBase = useId();

  /** Un botón por pestaña, para poder moverle el foco con las flechas. */
  const botonesPestania = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * El reloj se congela al montar. Sin esto, cada render volvería a preguntar la
   * hora y «lo que queda por pasar» podría cambiar entre dos renders del mismo
   * tablero — el mismo criterio con el que el listado del panel pasa `ahora` como
   * parámetro en vez de leerlo adentro del cálculo.
   */
  const ahora = useRef(new Date()).current;

  useEffect(() => {
    let vivo = true;
    // B-888 — `'admin'` explícito por lo mismo que en `ReporteFormulario`: el
    // tablero es de admin por construcción (lee además `/sistema`, que el
    // publicador no puede leer) y necesita el catálogo entero para que los
    // números signifiquen algo. `uid` no lo usa la query del admin, y esta
    // pantalla no lo recibe: pasarlo sería cablear un dato que nadie lee.
    listarActividades('admin', '')
      .then((lista) => {
        if (!vivo) return;
        setActividades(lista);
        setCargando(false);
        /**
         * La única cosa que esta pantalla mide, y es sobre el panel y no sobre el
         * sitio: **¿alguien abre el tablero?** Es lo que decide si vale construir
         * la mitad que lee GA4 (B-374). Un entero y nada más.
         */
        medirFuncion('estadisticas-abrir', undefined, lista.length);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setFallo(textoDeFallo(e, { respaldo: 'No se pudieron leer las actividades.' }));
        setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  /*
   * La lectura del resumen del sitio, colgada de la pestaña.
   *
   * `leerAnaliticaDelSitio` **no tira nunca** (un permiso denegado o un fallo
   * de red devuelven el resumen vacío, que ya sabe decir qué falta), así que
   * acá no hay rama de error: el estado de esta pestaña es siempre el mismo
   * objeto, y quién lo dibuja decide qué frase va.
   */
  useEffect(() => {
    if (pestania !== 'sitio-publico' || resumenDelSitio) return;
    let vivo = true;
    leerAnaliticaDelSitio().then((r) => {
      if (vivo) setResumenDelSitio(r);
    });
    return () => {
      vivo = false;
    };
  }, [pestania, resumenDelSitio]);

  const estado = useMemo(() => estadoDelCatalogo(actividades, ahora), [actividades, ahora]);

  /*
   * B-1081 — sobre `encuentrosDe`, el mismo aplanado que alimenta la grilla del
   * mes: un segundo aplanado acá podría pintar en el mapa un encuentro que el
   * calendario no muestra. Es cálculo en memoria sobre la misma lectura; no
   * cuesta un solo documento de Firestore más.
   */
  const ritmo = useMemo(
    () => ritmoDelCatalogo(encuentrosDe(actividades), ahora),
    [actividades, ahora],
  );

  const porId = useMemo(
    () => new Map(actividades.map((a) => [a.id, a])),
    [actividades],
  );

  const deTaxonomia = (campo: CampoTaxonomia) => (valor: string) =>
    labels[campo]?.[valor] ?? legible(valor);

  /**
   * D-150 — los matices que alguien eligió a mano desde Opciones.
   *
   * Se pasan **solo las excepciones**: un tipo que no esté en el mapa no es un
   * tipo sin color, es un tipo con el color que `colorDeTipo` le deriva del
   * slug. Y se saca con `tonosDeTipo`, la misma función que los saca del
   * `events.json` para el sitio: la promesa de D-150 es que las dos pantallas
   * pinten igual, y eso se sostiene compartiendo la función, no el criterio.
   */
  const tonos = useMemo(
    () => tonosDeTipo({ tipo: opcionesDeTipo.valores }),
    [opcionesDeTipo.valores],
  );

  if (cargando) return <p className="text-sm text-tinta/65">Cargando…</p>;

  if (fallo) {
    return (
      <p className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento">
        {fallo}
      </p>
    );
  }

  /**
   * Pestañas — patrón «tabs, automatic activation» de WAI-ARIA APG: las
   * flechas mueven el foco Y cambian la pestaña activa en el mismo gesto (no
   * hace falta Enter/Espacio después). Home/End van a los extremos. Tab entra
   * una sola vez, al botón activo (roving tabindex: los demás llevan `-1`).
   */
  const alTeclaEnPestania = (indice: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    let siguiente: number | null = null;
    if (e.key === 'ArrowRight') siguiente = (indice + 1) % PESTANIAS.length;
    else if (e.key === 'ArrowLeft') siguiente = (indice - 1 + PESTANIAS.length) % PESTANIAS.length;
    else if (e.key === 'Home') siguiente = 0;
    else if (e.key === 'End') siguiente = PESTANIAS.length - 1;
    if (siguiente === null) return;
    e.preventDefault();
    setPestania(PESTANIAS[siguiente].id);
    botonesPestania.current[siguiente]?.focus();
  };

  const idTab = (id: Pestania) => `${idBase}-tab-${id}`;
  const idPanel = (id: Pestania) => `${idBase}-panel-${id}`;

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Vista del tablero"
        className="flex gap-1 border-b border-borde"
      >
        {PESTANIAS.map((p, i) => {
          const activa = pestania === p.id;
          return (
            <button
              key={p.id}
              ref={(el) => {
                botonesPestania.current[i] = el;
              }}
              type="button"
              role="tab"
              id={idTab(p.id)}
              aria-selected={activa}
              aria-controls={idPanel(p.id)}
              tabIndex={activa ? 0 : -1}
              onClick={() => setPestania(p.id)}
              onKeyDown={alTeclaEnPestania(i)}
              className={`-mb-px min-h-touch border-b-2 px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acento/40 ${
                activa
                  ? 'border-acento text-tinta'
                  : 'border-transparent text-tinta/65 hover:border-borde hover:text-tinta'
              }`}
            >
              {p.etiqueta}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={idPanel(pestania)} aria-labelledby={idTab(pestania)} tabIndex={0}>
        {pestania === 'catalogo' ? (
          <PanelCatalogo
            estado={estado}
            ritmo={ritmo}
            porId={porId}
            onEditar={onEditar}
            deTaxonomia={deTaxonomia}
            tonosDeTipo={tonos}
          />
        ) : resumenDelSitio ? (
          <PanelSitioPublico resumen={resumenDelSitio} />
        ) : (
          <p className="text-sm text-tinta/65">Cargando…</p>
        )}
      </div>
    </div>
  );
}
