import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { claseEnlaceCelda } from '@/components/admin/campos/Campo';
import { Reparto } from '@/components/admin/estadisticas/Reparto';
import { useLabelsTaxonomia, useOpciones } from '@/components/admin/useOpciones';
import { listarActividades } from '@/lib/actividades';
import { medirFuncion } from '@/lib/analytics';
import {
  DIAS_PROXIMOS,
  estadoDelCatalogo,
  porcentaje,
  type EstadoDelCatalogo,
} from '@/lib/estadoDelCatalogo';
import { porcentajeLegible } from '@/lib/tortaDelPanel';
/*
 * D-150 — los matices elegidos a mano salen de la **misma** función que los
 * saca del `events.json` para el sitio público, no de un `filter` copiado acá:
 * la promesa de D-150 es que el panel y el listado pinten la misma categoría
 * del mismo color, y dos derivaciones de «qué tono cuenta» es exactamente la
 * forma de que se separen sin que nada falle.
 */
import { tonosDeTipo } from '@/lib/listadoPublico';
import { ETIQUETA_ESTADO, ETIQUETA_MODALIDAD, legible } from '@/lib/filtrosActividades';
import { leerAnaliticaDelSitio } from '@/lib/analiticaDelSitio';
/*
 * El vocabulario de los eventos del **sitio público**, no del panel. Es un
 * `EVENTOS_SITIO` de puros tipos y strings: importarlo acá no arrastra nada del
 * transporte (`medicionSitio.ts`), que es lo único que no puede aparecer del
 * lado del panel.
 */
import { NOMBRES_EVENTOS_SITIO } from '@/lib/analyticsSitio';
import {
  ctrLegible,
  diaLegible,
  periodoLegible,
  duracionLegible,
  engancheLegible,
  variacionLegible,
  type FilaDeBusqueda,
  type FilaDeRanking,
  type MetricaConVariacion,
  type ResumenDelSitio,
  type SituacionDeFuente,
} from '@/lib/resumenDelSitio';
import type { ActividadConId, CampoTaxonomia, Estado, Modalidad } from '@/types/actividad';

/**
 * «Estado del catálogo» — el tablero del panel (B-370, D-200).
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
 *    informa sola. Va `aria-hidden` justamente por eso.
 * 4. **Los avisos van primero.** Es lo accionable, y lo demás es contexto. Un
 *    tablero que abre con gráficos y esconde «hay tres publicadas a las que no
 *    se puede entrar» tiene el orden al revés.
 *
 * Las etiquetas de taxonomía las resuelve esta pantalla y no el módulo puro
 * (§4.1): el reparto viene por slug y el label sale de `/opciones/*`, con
 * `legible` de último recurso — el mismo respaldo que usa el listado.
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

/** Barra de comparación. Decorativa: el número siempre está escrito al lado. */
function Barra({ parte, total }: { parte: number; total: number }) {
  return (
    <span
      aria-hidden="true"
      className="block h-1.5 w-full overflow-hidden rounded-sm bg-tinta/8"
    >
      <span
        className="block h-full bg-acento"
        style={{ width: `${porcentaje(parte, total)}%` }}
      />
    </span>
  );
}

/**
 * Una proporción sin «falta»: `N de M (x %)` y nada más — B-703.
 *
 * Es la hermana corta de `Cobertura`, para lo que **no** es una cobertura
 * incompleta sino un dato: «12 de 20 piden inscripción» no tiene una acción
 * pendiente detrás, «8 de 20 sin imagen» sí.
 */
function Proporcion({ que, cuantas, total }: { que: string; cuantas: number; total: number }) {
  return (
    <li className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm">{que}</span>
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {cuantas} de {total}
          <span className="ml-1 font-normal text-tinta/50">
            ({porcentajeLegible(cuantas, total)})
          </span>
        </span>
      </div>
      <Barra parte={cuantas} total={total} />
    </li>
  );
}

/** Una fila de «cuántas de las publicadas tienen esto». */
function Cobertura({
  que,
  cuantas,
  total,
  falta,
}: {
  que: string;
  cuantas: number;
  total: number;
  falta: string;
}) {
  return (
    <li className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm">{que}</span>
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {cuantas} de {total}
          <span className="ml-1 font-normal text-tinta/50">
            ({porcentaje(cuantas, total)} %)
          </span>
        </span>
      </div>
      <Barra parte={cuantas} total={total} />
      {cuantas < total && <p className="mt-0.5 text-xs text-tinta/50">{falta}</p>}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────
// La pestaña «El catálogo» — lo que ya existía, reorganizado (B-501)
// ─────────────────────────────────────────────────────────────────

/**
 * **La reorganización, en una frase:** «Lo que se publica» y «Qué hay
 * cargado» pasan de ir apiladas a ir lado a lado desde `lg`, para que el
 * tablero entre en una pantalla sin un scroll interminable. Los avisos siguen
 * arriba y a todo lo ancho porque son lo accionable — eso no se toca.
 */
function PanelCatalogo({
  estado,
  porId,
  onEditar,
  deTaxonomia,
  tonosDeTipo,
}: {
  estado: EstadoDelCatalogo;
  porId: Map<string, ActividadConId>;
  onEditar: (a: ActividadConId) => void;
  deTaxonomia: (campo: CampoTaxonomia) => (valor: string) => string;
  /** D-150 — los matices elegidos a mano para los tipos, si hay alguno. */
  tonosDeTipo: Record<string, number>;
}) {
  if (estado.total === 0) {
    return (
      <p className="text-sm text-tinta/60">
        Todavía no hay actividades cargadas. Cuando haya, acá aparece qué se está
        ofreciendo y qué le falta.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-tinta/60">
        Esto es lo que se sabe del catálogo cargado: nada de acá sale del navegador
        de nadie que visite el sitio.
      </p>

      {/* ── El encabezado de números ── */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { que: 'Actividades', valor: estado.total },
          { que: 'Publicadas', valor: estado.publicadas.total },
          { que: 'Encuentros por venir', valor: estado.encuentros.porVenir },
          { que: `En los próximos ${DIAS_PROXIMOS} días`, valor: estado.encuentros.enLosProximosDias },
        ].map((n) => (
          <div key={n.que} className="rounded-md border border-borde bg-white px-3 py-2">
            <dt className="text-xs text-tinta/55">{n.que}</dt>
            <dd className="font-serif text-2xl font-semibold tabular-nums">{n.valor}</dd>
          </div>
        ))}
      </dl>

      {/* ── Los avisos, primero porque son lo accionable ── */}
      <section>
        <h2 className="font-serif text-lg font-semibold">Qué conviene mirar</h2>
        {estado.avisos.length === 0 ? (
          <p className="mt-2 text-sm text-tinta/60">
            Nada pendiente: todo lo publicado tiene imagen, etiquetas, descripción y
            encuentros por venir.
          </p>
        ) : (
          /*
            B-621 · D-400 — a todo ancho, los avisos se reparten en dos
            columnas desde `xl`. Cada aviso es un título corto y una lista de
            títulos de actividad que envuelve: a 1600px en una sola columna, la
            tarjeta queda con más blanco que texto y los avisos se separan tanto
            que dejan de leerse como una lista. Dos y no cuatro: el título de un
            taller ya usa el ancho de media columna.
          */
          <ul className="mt-3 grid gap-4 xl:grid-cols-2">
            {estado.avisos.map((aviso) => (
              <li key={aviso.clase} className="rounded-md border border-borde bg-white p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="min-w-0 text-sm font-medium">{aviso.titulo}</h3>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {aviso.actividades.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-tinta/55">{aviso.porque}</p>
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {aviso.actividades.map((a) => {
                    const completa = porId.get(a.id);
                    return (
                      <li key={a.id} className="min-w-0">
                        {completa ? (
                          <button
                            type="button"
                            className={claseEnlaceCelda}
                            onClick={() => onEditar(completa)}
                          >
                            {a.titulo}
                          </button>
                        ) : (
                          <span className="text-xs text-tinta/60">{a.titulo}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Cobertura y repartos, lado a lado desde `lg` (B-501): la razón
          por la que esto era una página larga era apilar estas dos ── */}
      <div className="grid gap-8 lg:grid-cols-2">
        {estado.publicadas.total > 0 && (
          <section>
            <h2 className="font-serif text-lg font-semibold">Lo que se publica, completo o no</h2>
            <p className="mt-0.5 text-xs text-tinta/50">
              Sobre las {estado.publicadas.total} publicadas.
            </p>
            <ul className="mt-3 space-y-3">
              <Cobertura
                que="Con imagen"
                cuantas={estado.publicadas.conFlyer}
                total={estado.publicadas.total}
                falta="Las que no tienen no aparecen en la cartelera."
              />
              <Cobertura
                que="Con etiquetas"
                cuantas={estado.publicadas.conEtiquetas}
                total={estado.publicadas.total}
                falta="Las que no tienen no se encuentran filtrando por etiqueta."
              />
              <Cobertura
                que="Con descripción suficiente"
                cuantas={estado.publicadas.conDescripcionSuficiente}
                total={estado.publicadas.total}
                falta="La descripción es lo que Google muestra debajo del título."
              />
              <Cobertura
                que="Con encuentros por venir"
                cuantas={estado.publicadas.conFuturo}
                total={estado.publicadas.total}
                falta="Las demás ya pasaron y quedaron como archivo."
              />
            </ul>
            {/*
              B-703 — las tres de inscripción van acá y **no** son un gráfico:
              son tres preguntas de sí/no independientes, no las partes de un
              todo. Una torta sobre ellas sumaría porcentajes que se solapan
              (una actividad puede estar en las tres) y dibujaría más de una
              vuelta. El denominador de las dos últimas son las que piden
              inscripción, no todas las publicadas.
            */}
            {estado.publicadas.conInscripcion > 0 && (
              <ul className="mt-3 space-y-3 border-t border-borde pt-3">
                <Proporcion
                  que="Piden inscripción"
                  cuantas={estado.publicadas.conInscripcion}
                  total={estado.publicadas.total}
                />
                <Proporcion
                  que="…y declaran cupo"
                  cuantas={estado.publicadas.conCupo}
                  total={estado.publicadas.conInscripcion}
                />
                <Proporcion
                  que="…y están completas"
                  cuantas={estado.publicadas.completas}
                  total={estado.publicadas.conInscripcion}
                />
              </ul>
            )}
          </section>
        )}

        <section>
          <h2 className="font-serif text-lg font-semibold">Qué hay cargado</h2>
          {/*
            B-700 · D-400 — cuatro repartos con torta o lista. A todo ancho van
            de a cuatro desde `2xl`: una torta de 112px con su referencia al
            lado entra en 380px, así que cuatro columnas caben en 1600 y ninguna
            queda apretada. En `lg` van de a dos, que es donde la referencia
            empieza a truncar títulos de barrio.
          */}
          <div className="mt-3 grid gap-x-8 gap-y-6 lg:grid-cols-2 2xl:grid-cols-4">
            <Reparto
              titulo="Por estado"
              clave="estado"
              unidad="actividades"
              tajadas={estado.porEstado}
              etiqueta={(v) => ETIQUETA_ESTADO[v as Estado] ?? legible(v)}
            />
            <Reparto
              titulo="Por tipo"
              clave="tipo"
              unidad="actividades"
              tajadas={estado.porTipo}
              etiqueta={deTaxonomia('tipo')}
              tonos={tonosDeTipo}
            />
            <Reparto
              titulo="Por arancel"
              clave="arancel"
              unidad="actividades"
              tajadas={estado.porArancel}
              etiqueta={deTaxonomia('arancel')}
            />
            <Reparto
              titulo="Por barrio"
              clave="barrio"
              unidad="barrios ofrecidos"
              nota="Solo lo presencial, y una actividad en dos barrios cuenta en los dos."
              /*
                La lista por defecto y no la torta: es el único reparto que se
                come el tope de seis cuñas de entrada —el circuito porteño tiene
                veinte barrios— y donde la torta muestra «las cinco primeras y el
                resto», que contesta menos que la lista entera.
              */
              porDefecto="lista"
              tajadas={estado.porBarrio}
              etiqueta={deTaxonomia('barrio')}
            />
          </div>

          {/*
            B-224 — la forma de cursar va **abajo y sin torta**, a propósito. Es
            el único reparto donde una actividad cuenta en más de una tajada por
            razones que no son geográficas, y una torta que dibuja «47 formas»
            al lado de tres tortas que dibujan «40 actividades» invita a
            compararlas — que es justo lo que no se puede hacer. La lista dice el
            número sin sugerir esa comparación.
          */}
          <div className="mt-6 grid gap-x-8 gap-y-6 lg:grid-cols-2">
            <Reparto
              titulo="Por forma de cursar"
              clave="modalidad"
              unidad="formas de cursar ofrecidas"
              nota="Una actividad cuenta en cada forma que ofrece, así que suman más que el total."
              porDefecto="lista"
              tajadas={estado.porModalidad}
              etiqueta={(v) => ETIQUETA_MODALIDAD[v as Modalidad] ?? legible(v)}
            />
            <p className="self-end text-sm text-tinta/60">
              {estado.ciclos} {estado.ciclos === 1 ? 'ciclo' : 'ciclos'} y {estado.sueltas}{' '}
              {estado.sueltas === 1 ? 'actividad suelta' : 'actividades sueltas'}, con{' '}
              {estado.encuentros.total}{' '}
              {estado.encuentros.total === 1 ? 'encuentro' : 'encuentros'} cargados en total.
              {/*
                Ciclos vs. sueltas se queda como frase y **no** pasa a gráfico:
                son dos categorías, y una torta de dos cuñas no dice nada que
                «12 ciclos y 28 sueltas» no diga mejor y en menos lugar.
              */}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// La pestaña «El sitio público» — el andamiaje, sin un número inventado (B-502)
// ─────────────────────────────────────────────────────────────────

/**
 * Lo que GA4 da solo, sin ningún evento propio (mitad **a** del §2 del
 * documento) — los números para ofrecer a un anunciante.
 */
const METRICAS_PARA_VENDER: { titulo: string; detalle: string }[] = [
  {
    titulo: 'Visitas y personas',
    detalle:
      'Sesiones y usuarios activos de los últimos 28 días, con la variación contra los 28 anteriores.',
  },
  {
    titulo: 'Vistas de página',
    detalle: 'Cuántas páginas se miran por visita, no solo cuánta gente entra.',
  },
  {
    titulo: 'Las páginas más vistas',
    detalle:
      'Qué se mira más: el inicio, la cartelera, la agenda por mes, el detalle de cada ' +
      'actividad, el archivo de lo que pasó.',
  },
  {
    titulo: 'De dónde entra la gente',
    detalle: 'El buscador, las redes, un link pegado o directo — y con qué aparato.',
  },
];

/**
 * Cómo se llama cada evento propio en la pantalla, y qué mide.
 *
 * El nombre técnico (`clic_inscripcion`) es el que viaja a GA4; acá va el
 * castellano. Y la aclaración de **qué no mide** no es adorno: es lo que
 * permite responder «¿de dónde sale este número?» sin abrir el código, que es
 * la línea que el §9.3 pide que el tablero diga siempre.
 */
const NOMBRE_DE_EVENTO: Record<string, { titulo: string; detalle: string }> = {
  clic_inscripcion: {
    titulo: 'Clics en inscripción',
    detalle:
      'Cuánta gente llega a escribirle al organizador — el único número que dice si una ' +
      'actividad convierte. Mide la vía (mail, WhatsApp, DM, formulario), nunca el destino.',
  },
  filtro_sin_resultados: {
    titulo: 'Filtros que no encuentran nada',
    /*
     * **Decía «qué combinación de filtros deja la lista vacía» y esta fila no
     * puede decir cuál** — lo preguntó el dueño el 2026-09-07, mirando la
     * pantalla: «no hay que expandir eso para saber qué filtros?».
     *
     * Tenía razón. El evento **sí** lleva el eje y el slug elegidos
     * (`analyticsSitio.ts`), pero la Function pide a GA4 `eventName` +
     * `eventCount` y nada más, así que lo que llega al panel es **el número de
     * veces**, no el desglose. La frase prometía el desglose.
     *
     * Ahora dice lo que la fila muestra. Traer el desglose es **B-798**, y no es
     * solo código: pide registrar `eje` y `slug` como dimensiones
     * personalizadas en la consola de GA4 —que **no es retroactivo**— y sumar
     * una dimensión a `DIMENSIONES_PERMITIDAS`, que es una lista blanca que
     * existe justamente para que no entre `pageLocation` ni la demografía.
     */
    detalle:
      'Cuántas veces alguien filtró y no quedó nada. Todavía no dice cuál filtro fue ' +
      '(B-798). Mide el filtro elegido, nunca lo que alguien escribió en el buscador.',
  },
  clic_triptico: {
    titulo: 'Clics en «¿Qué hay ahora?»',
    detalle:
      'Si la gente usa los tres paneles de la home (Hoy · Este finde · Esta semana) o baja ' +
      'directo al listado. Mide qué panel, nunca qué actividad se abrió.',
  },
};

/**
 * Las filas de la mitad **b** cuando todavía no hay datos — y **derivadas del
 * vocabulario real, no escritas al lado**.
 *
 * Antes eran una lista aparte con las dos que existían, y era una divergencia
 * esperando: el evento que se agregue mañana aparece en la rama con datos —que
 * recorre lo que GA4 devolvió— y no en la vacía, así que el tablero mostraría
 * tres filas un día y dos el anterior sin que nada falle. Es la clase de bug
 * que este repo persigue: dos listas de lo mismo, una de las cuales se
 * actualiza.
 *
 * `NOMBRES_EVENTOS_SITIO` es la fuente y `NOMBRE_DE_EVENTO` el castellano: un
 * evento nuevo aparece acá solo, con su nombre técnico de respaldo hasta que
 * alguien le escriba el castellano.
 */
const METRICAS_PARA_MEJORAR: { titulo: string; detalle: string }[] = NOMBRES_EVENTOS_SITIO.map(
  (nombre) => NOMBRE_DE_EVENTO[nombre] ?? { titulo: nombre, detalle: 'Sin descripción todavía.' },
);

/** El grupo de filas sin datos: la estructura, sin un número inventado (B-502). */
function GrupoDeMetricas({
  titulo,
  nota,
  items,
}: {
  titulo: string;
  nota: string;
  items: { titulo: string; detalle: string }[];
}) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta/55">{titulo}</h3>
      <p className="mt-0.5 text-xs text-tinta/45">{nota}</p>
      <ul className="mt-2 divide-y divide-borde border border-borde">
        {items.map((it) => (
          <li key={it.titulo} className="flex items-start justify-between gap-4 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">{it.titulo}</p>
              <p className="mt-0.5 text-xs text-tinta/60">{it.detalle}</p>
            </div>
            <span className="shrink-0 whitespace-nowrap text-xs text-tinta/40">
              sin datos aún
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Un número grande con su variación. La variación solo si existe.
 *
 * `formato` es opcional y **el default sigue siendo el entero con separador de
 * miles**, que es lo que necesitan las cuatro métricas de conteo. Lo usan las dos
 * que no son enteras (B-800): los segundos promedio y la tasa de enganche, que
 * vienen crudas de GA4 justamente para que el formato lo decida esta pantalla.
 */
function NumeroGrande({
  titulo,
  metrica,
  formato = (v) => v.toLocaleString('es-AR'),
}: {
  titulo: string;
  metrica: MetricaConVariacion;
  formato?: (valor: number) => string;
}) {
  const variacion = variacionLegible(metrica.variacion);
  return (
    <div className="min-w-0 border border-borde px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-tinta/55">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{formato(metrica.valor)}</p>
      {/*
        «Sin comparación» y no «0 %»: son dos cosas distintas y las dos pasan.
        `null` es «no hay ventana anterior con qué comparar», que es el estado
        del primer mes entero de medición; afirmar «0 %» ahí sería afirmar una
        comparación que no se hizo.
      */}
      <p className="mt-0.5 text-xs text-tinta/50">
        {variacion ? `${variacion} vs. los 28 días anteriores` : 'sin comparación todavía'}
      </p>
    </div>
  );
}

/** Un ranking con su barra, reusando la misma barra decorativa del catálogo. */
function RankingDelSitio({
  titulo,
  nota,
  filas,
  vacio,
}: {
  titulo: string;
  nota: string;
  filas: FilaDeRanking[];
  vacio: string;
}) {
  const tope = filas[0]?.valor ?? 0;
  return (
    <section className="min-w-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta/55">{titulo}</h3>
      <p className="mt-0.5 text-xs text-tinta/45">{nota}</p>
      {filas.length === 0 ? (
        <p className="mt-2 text-sm text-tinta/50">{vacio}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {filas.map((f) => (
            <li key={f.clave} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm" title={f.clave}>
                  {f.clave}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">{f.valor}</span>
              </div>
              <Barra parte={f.valor} total={tope} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Lo que hay que hacer para que una fuente deje de estar vacía, según en qué
 * situación esté.
 *
 * **Cada situación tiene una acción distinta y una sola**, y eso es todo el
 * punto de que `resumenDelSitio.ts` las distinga: un tablero que dice «no hay
 * datos» sin decir por qué obliga a adivinar entre desplegar una Function,
 * cargar una variable de entorno, revisar un permiso y esperar.
 */
function QueFalta({
  fuente,
  situacion,
  motivo,
}: {
  fuente: string;
  situacion: SituacionDeFuente;
  motivo: string | null;
}) {
  if (situacion === 'ok') return null;
  const texto = {
    'sin-documento': `Todavía no llegó ningún resumen de ${fuente}. La lectura corre una vez por día: si la función se acaba de desplegar, aparece mañana.`,
    /*
     * El motivo dice **qué variable falta**, y la frase manda al lugar exacto
     * donde están los pasos. Un «falta configurar algo» sin decir qué ni dónde
     * es lo mismo que no decir nada.
     */
    'sin-configurar': `Falta un paso de configuración para ${fuente}: ${motivo ?? 'sin detalle'}. Los pasos están en docs/16-analitica-del-sitio.md, en «Los pasos de consola del dueño».`,
    falla: `${fuente} devolvió un error y por eso no hay números: ${motivo ?? 'sin detalle'}.`,
    'sin-datos': `${fuente} contestó bien y todavía no hay volumen: los números están en cero de verdad, no falta nada.`,
  }[situacion];
  return (
    <p
      className={`text-xs ${situacion === 'falla' ? 'text-acento' : 'text-tinta/55'}`}
    >
      {texto}
    </p>
  );
}

/**
 * **La mitad que falta, construida como estado vacío deliberado — no como
 * error.** El pedido quería vistas, páginas más vistas, secciones, clics y
 * fricciones; todo eso sale de GA4 vía su Data API, y esa lectura es **B-374**
 * y no está construida — hace falta la Function que la trae al panel y, sobre
 * todo, un mes de datos acumulados (GA4 no mide retroactivo). Poner números de
 * relleno acá sería mentirle al dueño en la única pantalla que existe para no
 * mentirle.
 *
 * En vez de eso: la estructura real de lo que va a aparecer, agrupada igual
 * que el documento de arquitectura (§2 — la mitad que se vende y la mitad que
 * mejora el sitio), con la fecha exacta desde la que hay algo que medir y qué
 * falta para que dejen de decir «sin datos aún».
 *
 * ── Y qué cambió con B-374/B-373 ───────────────────────────────────────────
 * Ahora hay una Function que lee GA4 y Search Console
 * (`functions/analitica-trigger.js`) y escribe un resumen diario, así que esta
 * pantalla **puede** mostrar números. Lo que **no** cambió es la decisión:
 * cuando no hay datos sigue estando el estado vacío, y ahora dice además **por
 * qué** está vacío —nunca corrió, falta un paso de consola, la API falló, o
 * todavía no hay volumen—, que son cuatro acciones distintas y hasta ahora se
 * veían iguales. Las distingue `lib/resumenDelSitio.ts`, que es puro; acá solo
 * se acomoda.
 */
function PanelSitioPublico({ resumen }: { resumen: ResumenDelSitio }) {
  const { ga4, searchConsole } = resumen;
  const hayNumerosDeGa4 = ga4.situacion === 'ok';
  const periodo = periodoLegible(ga4.ventana);

  return (
    <div className="space-y-6">
      <div className="border border-borde bg-white px-3 py-3">
        {/*
          **Acá había un párrafo que explicaba de qué es esta pestaña** —«cómo se
          usa el sitio público, y no lo que hay cargado, que es la otra»— y lo sacó
          el dueño el 2026-09-07.

          Estaba puesto por el andamiaje honesto de D-272, y el argumento de
          entonces era bueno: la pestaña iba a estar vacía un mes y algo tenía que
          decir de qué se trata. Pero el nombre de la pestaña ya lo dice, y una
          explicación de para qué sirve la pantalla que se está mirando envejece
          mal — la lee cien veces la misma persona, que después de la primera ya
          sabe.

          Y **los tres párrafos que seguían también los borró**, el mismo día y
          por lo mismo: «Hay datos desde el …, antes de esa fecha el sitio no
          medía nada», «los números son de GA4, 28 días contra los 28 anteriores,
          los informes tardan 24 a 48 horas» y «resumen calculado el …, se
          recalcula una vez por día».

          El argumento que yo había escrito acá para conservar el primero —«no
          explica la pantalla, califica los números, y sin ella un total no se
          puede leer»— **perdió contra verlo puesto**, y queda escrito porque era
          razonable y puede volver a tentar.

          Lo que hay que saber para no reponerlo por las dudas: **nada de eso era
          lo único que impedía leer mal un número.**

          - La comparación contra los 28 días anteriores **no puede mentir sin el
            texto**: `variacion` es `null` a propósito cuando la ventana anterior
            fue cero —el primer mes de medición entero— y la fila muestra «sin
            comparación todavía» en vez de un porcentaje. Vive en
            `resumenDelSitio.ts` y tiene su test.
          - Los cuatro estados vacíos siguen abajo (`QueFalta`, D-272): nunca
            corrió, falta un paso de consola y cuál, la API falló y por qué, o
            contestó y hay cero de verdad.
          - El «desde cuándo» sigue en el dato (`ga4.desdeCuando`), así que
            reponerlo es una línea el día que se lo extrañe.
        */}
        <div className="mt-2 space-y-1">
          <QueFalta fuente="Google Analytics" situacion={ga4.situacion} motivo={ga4.motivo} />
          <QueFalta
            fuente="Search Console"
            situacion={searchConsole.situacion}
            motivo={searchConsole.motivo}
          />
        </div>
        {resumen.generadoEn && (
          <p className="mt-2 text-xs text-tinta/40">
            Resumen calculado el{' '}
            {new Date(resumen.generadoEn).toLocaleString('es-AR', {
              timeZone: 'America/Argentina/Buenos_Aires',
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            . Se recalcula una vez por día.
          </p>
        )}
      </div>

      {/* ── Para ofrecer a un anunciante — la mitad a del §2 ────────────── */}
      {hayNumerosDeGa4 && ga4.sesiones && ga4.personas && ga4.vistas ? (
        <section className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta/55">
              Para ofrecer a un anunciante
            </h3>
            <p className="mt-0.5 text-xs text-tinta/45">
              De Google Analytics, sin ningún evento propio.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumeroGrande titulo="Visitas" metrica={ga4.sesiones} />
            <NumeroGrande titulo="Personas" metrica={ga4.personas} />
            <NumeroGrande titulo="Vistas de página" metrica={ga4.vistas} />
            {/*
              B-800 — las tres que pidió el dueño («sumarle más cosas con lo que
              nos de google»). Cada una contesta una pregunta que las de arriba
              no: si la audiencia **crece** o son los mismos volviendo, cuánto se
              **quedan**, y si **hacen algo** o entran y salen.

              Van con `&&` y no dentro del `hayNumerosDeGa4` de la sección: una
              propiedad de GA4 puede contestar las tres primeras y no estas —son
              métricas más nuevas— y en ese caso la fila no se dibuja en vez de
              mostrar un cero que no midió nada.
            */}
            {ga4.nuevos && <NumeroGrande titulo="Gente nueva" metrica={ga4.nuevos} />}
            {ga4.duracion && (
              <NumeroGrande
                titulo="Cuánto se quedan"
                metrica={ga4.duracion}
                formato={duracionLegible}
              />
            )}
            {ga4.enganche && (
              <NumeroGrande
                titulo="Sesiones con interacción"
                metrica={ga4.enganche}
                formato={engancheLegible}
              />
            )}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <RankingDelSitio
              titulo="Las páginas más vistas"
              nota="Qué se mira más: el inicio, la cartelera, la agenda por mes, el detalle."
              filas={ga4.paginas}
              vacio="Todavía no hay ninguna página con vistas."
            />
            <RankingDelSitio
              titulo="De dónde entra la gente"
              nota="El buscador, las redes, un link pegado o directo."
              filas={ga4.canales}
              vacio="Todavía no hay visitas de ningún canal."
            />
            <RankingDelSitio
              titulo="Con qué aparato"
              nota="Lo que un anunciante pregunta segundo, después del volumen."
              filas={ga4.dispositivos}
              vacio="Todavía no hay visitas de ningún aparato."
            />
          </div>
        </section>
      ) : (
        <GrupoDeMetricas
          titulo="Para ofrecer a un anunciante"
          nota="Lo que Google Analytics da solo, sin ningún evento propio."
          items={METRICAS_PARA_VENDER}
        />
      )}

      {/* ── Para mejorar el sitio — la mitad b, los eventos propios ─────── */}
      {hayNumerosDeGa4 && Object.keys(ga4.eventos).length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta/55">
            Para mejorar el sitio
          </h3>
          <p className="mt-0.5 text-xs text-tinta/45">
            Fricciones concretas, de los eventos propios del sitio.
          </p>
          <ul className="mt-2 divide-y divide-borde border border-borde">
            {Object.entries(ga4.eventos).map(([nombre, cuenta]) => {
              const etiqueta = NOMBRE_DE_EVENTO[nombre];
              return (
                <li
                  key={nombre}
                  className="flex items-start justify-between gap-4 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{etiqueta?.titulo ?? nombre}</p>
                    {etiqueta && (
                      <p className="mt-0.5 text-xs text-tinta/60">{etiqueta.detalle}</p>
                    )}
                  </div>
                  {/*
                    Un cero se escribe, no se esconde. La Function rellena en
                    cero los eventos que GA4 no devolvió justamente para que
                    esta fila exista: «cero clics de inscripción» es un dato, y
                    una fila ausente se confunde con un enganche roto.
                  */}
                  <span className="shrink-0 text-sm font-medium tabular-nums">{cuenta}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <GrupoDeMetricas
          titulo="Para mejorar el sitio"
          nota="Fricciones concretas. Los eventos ya están instalados y esperando volumen."
          items={METRICAS_PARA_MEJORAR}
        />
      )}

      {/* ── ¿Google nos encuentra? — B-373, la pregunta 7 del §3 ────────── */}
      <section className="space-y-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta/55">
            ¿Google nos encuentra?
          </h3>
          <p className="mt-0.5 text-xs text-tinta/45">
            De Search Console, que no usa cookies ni JavaScript.{' '}
            {searchConsole.situacion === 'ok' && periodoLegible(searchConsole.ventana)
              ? `${periodoLegible(searchConsole.ventana)} — sus datos tardan de 2 a 3 días.`
              : ''}
          </p>
        </div>
        {searchConsole.situacion === 'ok' ? (
          <>
            <p className="text-sm text-tinta/70">
              {/*
                «En el tope» y no «en el sitio», que es lo que el campo dice: es
                la suma de las diez búsquedas más frecuentes, no el total. Un
                total del sitio presentado como si lo fuera es un número que se
                cae en la primera pregunta.
              */}
              <strong>{searchConsole.clicsEnElTope.toLocaleString('es-AR')}</strong> clics y{' '}
              <strong>{searchConsole.impresionesEnElTope.toLocaleString('es-AR')}</strong>{' '}
              apariciones, sumando las diez búsquedas más frecuentes (no todo el sitio).
            </p>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <TablaDeBusquedas
                titulo="Con qué se nos busca"
                nota="Las diez consultas que más nos muestran en Google."
                filas={searchConsole.busquedas}
                columna="Búsqueda"
              />
              <TablaDeBusquedas
                titulo="Qué páginas rankean"
                nota="Dónde el trabajo de SEO rindió — y dónde falta."
                filas={searchConsole.paginas}
                columna="Página"
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-tinta/50">
            Cuando haya datos, esto va a decir con qué búsquedas nos encuentra la gente y
            qué páginas rankean — la pregunta que justifica todo el trabajo de SEO del
            sitio.
          </p>
        )}
      </section>
    </div>
  );
}

/** Una tabla de Search Console: clave, clics, apariciones, CTR y posición. */
function TablaDeBusquedas({
  titulo,
  nota,
  filas,
  columna,
}: {
  titulo: string;
  nota: string;
  filas: FilaDeBusqueda[];
  columna: string;
}) {
  return (
    <section className="min-w-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-tinta/55">{titulo}</h4>
      <p className="mt-0.5 text-xs text-tinta/45">{nota}</p>
      {filas.length === 0 ? (
        <p className="mt-2 text-sm text-tinta/50">Todavía ninguna.</p>
      ) : (
        /*
          Scroll propio y no del `<body>`: una consulta larga o una URL entera
          desbordan en el teléfono, y una tabla que empuja el ancho de la página
          rompe el resto del panel.
        */
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[24rem] border border-borde text-sm">
            <thead>
              <tr className="border-b border-borde text-xs uppercase tracking-wide text-tinta/50">
                <th className="px-2 py-1.5 text-left font-semibold">{columna}</th>
                <th className="px-2 py-1.5 text-right font-semibold">Clics</th>
                <th className="px-2 py-1.5 text-right font-semibold">Aparece</th>
                <th className="px-2 py-1.5 text-right font-semibold">CTR</th>
                <th className="px-2 py-1.5 text-right font-semibold">Posición</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {filas.map((f) => (
                <tr key={f.clave}>
                  <td className="max-w-[16rem] truncate px-2 py-1.5" title={f.clave}>
                    {f.clave}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{f.clics}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{f.impresiones}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{ctrLegible(f.ctr)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{f.posicion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

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
    listarActividades()
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
        setFallo(e instanceof Error ? e.message : 'No se pudieron leer las actividades.');
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

  if (cargando) return <p className="text-sm text-tinta/50">Cargando…</p>;

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
                  : 'border-transparent text-tinta/55 hover:border-borde hover:text-tinta'
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
            porId={porId}
            onEditar={onEditar}
            deTaxonomia={deTaxonomia}
            tonosDeTipo={tonos}
          />
        ) : resumenDelSitio ? (
          <PanelSitioPublico resumen={resumenDelSitio} />
        ) : (
          <p className="text-sm text-tinta/50">Cargando…</p>
        )}
      </div>
    </div>
  );
}
