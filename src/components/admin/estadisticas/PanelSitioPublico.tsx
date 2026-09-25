import { Barra } from '@/components/admin/estadisticas/Barra';
/*
 * El vocabulario de los eventos del **sitio público**, no del panel. Es un
 * `EVENTOS_SITIO` de puros tipos y strings: importarlo acá no arrastra nada del
 * transporte (`medicionSitio.ts`), que es lo único que no puede aparecer del
 * lado del panel.
 */
import { NOMBRES_EVENTOS_SITIO, type EjeMedible } from '@/lib/analyticsSitio';
import {
  ctrLegible,
  periodoLegible,
  duracionLegible,
  engancheLegible,
  variacionLegible,
  type FilaDeBusqueda,
  type FilaDeRanking,
  type FilaSinResultados,
  type MetricaConVariacion,
  type ResumenDelSitio,
  type SituacionDeFuente,
} from '@/lib/resumenDelSitio';

/*
 * M-17 — la pestaña «El sitio público» del tablero, en su archivo. Salió entera
 * de `EstadisticasPanel.tsx`, que sigue siendo el que pide el resumen al abrir
 * la pestaña: esto solo pinta lo que recibe.
 */

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
  clic_banner_ciudad: {
    titulo: 'Clics en el banner de ciudad',
    detalle:
      'Si la gente toca el banner que aparece al filtrar por una ciudad que tiene uno. ' +
      'Mide qué ciudad, nunca a dónde lleva ni de quién es.',
  },
  clic_inscripcion: {
    titulo: 'Clics en inscripción',
    detalle:
      'Cuánta gente llega a escribirle al organizador — el único número que dice si una ' +
      'actividad convierte. Mide la vía (mail, WhatsApp, DM, formulario), nunca el destino.',
  },
  filtro_sin_resultados: {
    titulo: 'Filtros que no encuentran nada',
    /*
     * **El desglose llegó con B-798.** Lo preguntó el dueño el 2026-09-07,
     * mirando esta fila: «no hay que expandir eso para saber qué filtros?». La
     * fila se despliega (`DesgloseSinResultados`) cuando la Function trae filas,
     * y las trae desde que `eje` y `slug` quedaron registradas como dimensiones
     * de GA4, el 2026-09-25.
     */
    detalle:
      'Cuántas veces alguien filtró y no quedó nada, y con qué filtro. Mide el filtro ' +
      'elegido, nunca lo que alguien escribió en el buscador.',
  },
  clic_triptico: {
    titulo: 'Clics en «¿Qué hay ahora?»',
    detalle:
      'Si la gente usa los tres paneles de la home (Hoy · Este finde · Esta semana) o baja ' +
      'directo al listado. Mide qué panel, nunca qué actividad se abrió.',
  },
};

/**
 * El nombre en castellano de cada filtro del listado, para el desglose de
 * `filtro_sin_resultados` — B-798.
 *
 * `Record<EjeMedible, …>` y no un mapa suelto: un eje nuevo en
 * `analyticsSitio.ts` no compila hasta que alguien le escriba el nombre.
 */
const NOMBRE_DE_EJE: Record<EjeMedible, string> = {
  tipo: 'Tipo',
  arancel: 'Arancel',
  modalidad: 'Modalidad',
  provincia: 'Provincia',
  barrio: 'Barrio',
  ciudad: 'Ciudad',
  tag: 'Etiqueta',
  busqueda: 'Texto del buscador',
  cuando: 'Cuándo',
  abierta: 'Inscripción abierta',
  cursada: 'Cursada',
};

/*
 * Lo que no está en el mapa es `otro` —el eje que el saneador del sitio pone
 * cuando no reconoce el valor—, porque la Function descarta cualquier otro. Igual
 * no se pinta crudo: un valor inesperado no llega a la pantalla con su texto.
 */
const nombreDeEje = (eje: string | null): string =>
  eje === null ? 'Sin filtro identificado' : (NOMBRE_DE_EJE[eje as EjeMedible] ?? 'Otro filtro');

/**
 * Qué filtro dejó el listado vacío — B-798. Cerrado por defecto: la fila sigue
 * diciendo el total, y el detalle se abre a pedido.
 */
function DesgloseSinResultados({ filas }: { filas: FilaSinResultados[] }) {
  const tope = filas[0]?.valor ?? 0;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-medium text-tinta/80">
        Ver qué filtro fue
      </summary>
      <ul className="mt-2 space-y-2">
        {filas.map((f) => {
          const clave = `${f.eje ?? '-'}:${f.slug.join(',')}`;
          return (
            <li key={clave} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm" title={f.slug.join(', ')}>
                  {nombreDeEje(f.eje)}
                  {f.slug.length > 0 && (
                    <span className="text-tinta/65"> · {f.slug.join(', ')}</span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">{f.valor}</span>
              </div>
              <Barra parte={f.valor} total={tope} />
            </li>
          );
        })}
      </ul>
      {/*
        El `(not set)` de GA4 junta dos cosas que la API no separa, y sin esta
        línea la fila más alta del primer mes se lee como un bug.
      */}
      <p className="mt-2 text-xs text-tinta/65">
        «Sin filtro identificado» es un cero que ningún filtro solo explica, o una búsqueda
        de antes del 25 de septiembre de 2026, cuando se empezó a registrar el filtro.
      </p>
    </details>
  );
}

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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta/65">{titulo}</h3>
      <p className="mt-0.5 text-xs text-tinta/65">{nota}</p>
      <ul className="mt-2 divide-y divide-borde border border-borde">
        {items.map((it) => (
          <li key={it.titulo} className="flex items-start justify-between gap-4 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">{it.titulo}</p>
              <p className="mt-0.5 text-xs text-tinta/65">{it.detalle}</p>
            </div>
            <span className="shrink-0 whitespace-nowrap text-xs text-tinta/65">
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
      <p className="text-xs font-semibold uppercase tracking-wide text-tinta/65">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{formato(metrica.valor)}</p>
      {/*
        «Sin comparación» y no «0 %»: son dos cosas distintas y las dos pasan.
        `null` es «no hay ventana anterior con qué comparar», que es el estado
        del primer mes entero de medición; afirmar «0 %» ahí sería afirmar una
        comparación que no se hizo.
      */}
      <p className="mt-0.5 text-xs text-tinta/65">
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta/65">{titulo}</h3>
      <p className="mt-0.5 text-xs text-tinta/65">{nota}</p>
      {filas.length === 0 ? (
        <p className="mt-2 text-sm text-tinta/65">{vacio}</p>
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
      className={`text-xs ${situacion === 'falla' ? 'text-acento' : 'text-tinta/65'}`}
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
export function PanelSitioPublico({ resumen }: { resumen: ResumenDelSitio }) {
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
          <p className="mt-2 text-xs text-tinta/65">
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta/65">
              Para ofrecer a un anunciante
            </h3>
            <p className="mt-0.5 text-xs text-tinta/65">
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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta/65">
            Para mejorar el sitio
          </h3>
          <p className="mt-0.5 text-xs text-tinta/65">
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
                      <p className="mt-0.5 text-xs text-tinta/65">{etiqueta.detalle}</p>
                    )}
                    {nombre === 'filtro_sin_resultados' && ga4.sinResultados.length > 0 && (
                      <DesgloseSinResultados filas={ga4.sinResultados} />
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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta/65">
            ¿Google nos encuentra?
          </h3>
          <p className="mt-0.5 text-xs text-tinta/65">
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
          <p className="text-sm text-tinta/65">
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
      <h4 className="text-xs font-semibold uppercase tracking-wide text-tinta/65">{titulo}</h4>
      <p className="mt-0.5 text-xs text-tinta/65">{nota}</p>
      {filas.length === 0 ? (
        <p className="mt-2 text-sm text-tinta/65">Todavía ninguna.</p>
      ) : (
        /*
          Scroll propio y no del `<body>`: una consulta larga o una URL entera
          desbordan en el teléfono, y una tabla que empuja el ancho de la página
          rompe el resto del panel.
        */
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[24rem] border border-borde text-sm">
            <thead>
              <tr className="border-b border-borde text-xs uppercase tracking-wide text-tinta/65">
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
