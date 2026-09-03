import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { claseEnlaceCelda } from '@/components/admin/campos/Campo';
import { useLabelsTaxonomia } from '@/components/admin/useOpciones';
import { listarActividades } from '@/lib/actividades';
import { medirFuncion } from '@/lib/analytics';
import {
  DIAS_PROXIMOS,
  estadoDelCatalogo,
  porcentaje,
  type EstadoDelCatalogo,
  type Tajada,
} from '@/lib/estadoDelCatalogo';
import { ETIQUETA_ESTADO, ETIQUETA_MODALIDAD, legible } from '@/lib/filtrosActividades';
import { leerAnaliticaDelSitio } from '@/lib/analiticaDelSitio';
import {
  ctrLegible,
  diaLegible,
  periodoLegible,
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

/** Un reparto con su título. No se dibuja si no hay nada que repartir. */
function Reparto({
  titulo,
  nota,
  tajadas,
  referencia,
  etiqueta,
}: {
  titulo: string;
  nota?: string;
  tajadas: Tajada[];
  /** Contra qué se compara el ancho de la barra. */
  referencia: number;
  etiqueta: (valor: string) => string;
}) {
  if (tajadas.length === 0) return null;
  return (
    <section className="min-w-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta/55">{titulo}</h3>
      {nota && <p className="mt-0.5 text-xs text-tinta/45">{nota}</p>}
      <ul className="mt-2 space-y-2">
        {tajadas.map((t) => (
          <li key={t.valor} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm">{etiqueta(t.valor)}</span>
              <span className="shrink-0 text-sm font-medium tabular-nums">{t.cantidad}</span>
            </div>
            <Barra parte={t.cantidad} total={referencia} />
          </li>
        ))}
      </ul>
    </section>
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
}: {
  estado: EstadoDelCatalogo;
  porId: Map<string, ActividadConId>;
  onEditar: (a: ActividadConId) => void;
  deTaxonomia: (campo: CampoTaxonomia) => (valor: string) => string;
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
          <ul className="mt-3 space-y-4">
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
          </section>
        )}

        <section>
          <h2 className="font-serif text-lg font-semibold">Qué hay cargado</h2>
          <div className="mt-3 grid gap-6 sm:grid-cols-2">
            <Reparto
              titulo="Por estado"
              tajadas={estado.porEstado}
              referencia={estado.total}
              etiqueta={(v) => ETIQUETA_ESTADO[v as Estado] ?? legible(v)}
            />
            <Reparto
              titulo="Por tipo"
              tajadas={estado.porTipo}
              referencia={estado.total}
              etiqueta={deTaxonomia('tipo')}
            />
            <Reparto
              titulo="Por arancel"
              tajadas={estado.porArancel}
              referencia={estado.total}
              etiqueta={deTaxonomia('arancel')}
            />
            <Reparto
              titulo="Por forma de cursar"
              nota="Una actividad cuenta en cada forma que ofrece, así que suman más que el total."
              tajadas={estado.porModalidad}
              referencia={estado.total}
              etiqueta={(v) => ETIQUETA_MODALIDAD[v as Modalidad] ?? legible(v)}
            />
          </div>
          <p className="mt-4 text-sm text-tinta/60">
            {estado.ciclos} {estado.ciclos === 1 ? 'ciclo' : 'ciclos'} y {estado.sueltas}{' '}
            {estado.sueltas === 1 ? 'actividad suelta' : 'actividades sueltas'}, con{' '}
            {estado.encuentros.total}{' '}
            {estado.encuentros.total === 1 ? 'encuentro' : 'encuentros'} cargados en total.
          </p>
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
 * Eventos propios, diseñados uno por uno (mitad **b** del §2) — las
 * fricciones. **Estos dos ya están instalados** (B-375): lo que falta no es
 * escribirlos, es la conexión que los trae al panel (B-374).
 */
const METRICAS_PARA_MEJORAR: { titulo: string; detalle: string }[] = [
  {
    titulo: 'Clics en inscripción',
    detalle:
      'Cuánta gente llega a escribirle al organizador — el único número que dice si una ' +
      'actividad convierte. Mide la vía (mail, WhatsApp, DM, formulario), nunca el destino.',
  },
  {
    titulo: 'Filtros que no encuentran nada',
    detalle:
      'Qué combinación de filtros deja la lista vacía, para saber qué etiqueta conviene ' +
      'completar o retirar. Mide el filtro elegido, nunca lo que alguien escribió en el buscador.',
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
    detalle:
      'Qué combinación de filtros deja la lista vacía, para saber qué etiqueta conviene ' +
      'completar o retirar. Mide el filtro elegido, nunca lo que alguien escribió en el buscador.',
  },
  clic_triptico: {
    titulo: 'Clics en «¿Qué hay ahora?»',
    detalle:
      'Si la gente usa los tres paneles de la home (Hoy · Mañana · Este finde) o baja ' +
      'directo al listado. Mide qué panel, nunca qué actividad se abrió.',
  },
};

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

/** Un número grande con su variación. La variación solo si existe. */
function NumeroGrande({
  titulo,
  metrica,
}: {
  titulo: string;
  metrica: MetricaConVariacion;
}) {
  const variacion = variacionLegible(metrica.variacion);
  return (
    <div className="min-w-0 border border-borde px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-tinta/55">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {metrica.valor.toLocaleString('es-AR')}
      </p>
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
    'sin-configurar': `Falta un paso de configuración para ${fuente}: ${motivo ?? 'sin detalle'}. Está en el manual de operación, en «Conectar los números del sitio al panel».`,
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
        <p className="text-sm text-tinta">
          Cómo se usa el sitio público — quién lo mira, qué páginas recorre, dónde hace
          clic — y no lo que hay cargado, que es la otra pestaña.
        </p>
        {/*
          La línea que hace creíbles a las demás (§9.3): «12.000 visitas» sin
          decir que la medición arrancó hace seis semanas es un número que se
          cae en la primera pregunta. La fecha sale de GA4 —el primer día con
          sesiones— y no de una constante escrita acá.
        */}
        <p className="mt-2 text-sm text-tinta/70">
          {ga4.desdeCuando ? (
            <>
              Hay datos desde el <strong>{diaLegible(ga4.desdeCuando, true)}</strong>.
            </>
          ) : (
            <>
              La medición del sitio arrancó el{' '}
              <strong>3 de septiembre de 2026</strong>.
            </>
          )}{' '}
          Antes de esa fecha el sitio público no medía nada —cero cookies, cero
          JavaScript de analítica— así que no hay historia previa que mostrar, y Google
          Analytics no la puede reconstruir después: no mide para atrás.
        </p>
        {periodo && hayNumerosDeGa4 && (
          <p className="mt-2 text-xs text-tinta/55">
            Los números de abajo son de Google Analytics, {periodo} — 28 días, comparados
            contra los 28 anteriores. Los informes de Google tardan de 24 a 48 horas, así
            que el último día siempre queda afuera.
          </p>
        )}
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
