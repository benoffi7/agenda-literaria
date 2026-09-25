import { claseEnlaceCelda } from '@/components/campos/Campo';
import { Barra } from '@/components/admin/estadisticas/Barra';
import { Reparto } from '@/components/admin/estadisticas/Reparto';
import { Ritmo } from '@/components/admin/estadisticas/Ritmo';
import type { RitmoDelCatalogo } from '@/lib/ritmoDelCatalogo';
import { DIAS_PROXIMOS, porcentaje, type EstadoDelCatalogo } from '@/lib/estadoDelCatalogo';
import { porcentajeLegible } from '@/lib/tortaDelPanel';
import { ETIQUETA_ESTADO, ETIQUETA_MODALIDAD, legible } from '@/lib/filtrosActividades';
import type { ActividadConId, CampoTaxonomia, Estado, Modalidad } from '@/types/actividad';

/*
 * M-17 — la pestaña «El catálogo» del tablero, en su archivo. Salió entera de
 * `EstadisticasPanel.tsx`, que sigue siendo el que carga la colección y arma las
 * pestañas: esto solo pinta lo que recibe.
 */

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
          <span className="ml-1 font-normal text-tinta/65">
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
          <span className="ml-1 font-normal text-tinta/65">
            ({porcentaje(cuantas, total)} %)
          </span>
        </span>
      </div>
      <Barra parte={cuantas} total={total} />
      {cuantas < total && <p className="mt-0.5 text-xs text-tinta/65">{falta}</p>}
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
export function PanelCatalogo({
  estado,
  ritmo,
  porId,
  onEditar,
  deTaxonomia,
  tonosDeTipo,
}: {
  estado: EstadoDelCatalogo;
  /** B-1081 — cuándo pasan las cosas: el mapa de ocho semanas, el día y la franja. */
  ritmo: RitmoDelCatalogo;
  porId: Map<string, ActividadConId>;
  onEditar: (a: ActividadConId) => void;
  deTaxonomia: (campo: CampoTaxonomia) => (valor: string) => string;
  /** D-150 — los matices elegidos a mano para los tipos, si hay alguno. */
  tonosDeTipo: Record<string, number>;
}) {
  if (estado.total === 0) {
    return (
      <p className="text-sm text-tinta/65">
        Todavía no hay actividades cargadas. Cuando haya, acá aparece qué se está
        ofreciendo y qué le falta.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-tinta/65">
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
            <dt className="text-xs text-tinta/65">{n.que}</dt>
            <dd className="font-serif text-2xl font-semibold tabular-nums">{n.valor}</dd>
          </div>
        ))}
      </dl>

      {/* ── Los avisos, primero porque son lo accionable ── */}
      <section>
        <h2 className="font-serif text-lg font-semibold">Qué conviene mirar</h2>
        {estado.avisos.length === 0 ? (
          <p className="mt-2 text-sm text-tinta/65">
            Nada pendiente: todo lo publicado tiene imagen, etiquetas, descripción,
            encuentros por venir, y la web del organizador —donde hay una— enlaza.
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
                <p className="mt-0.5 text-xs text-tinta/65">{aviso.porque}</p>
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
                          <span className="text-xs text-tinta/65">{a.titulo}</span>
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
            <p className="mt-0.5 text-xs text-tinta/65">
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
              B-813 — «lo que Google puede mostrar», y son proporciones y no
              avisos a propósito.

              Los cuatro avisos del informe «Eventos» que no eran un bug del
              markup —`performer`, `image`, `organizer.url`, `price`— son el
              dato que falta y no el campo. Listarlos como pendientes sería
              **D-273 otra vez**: 65 de 68 publicadas sin tallerista no es una
              lista de trabajo, es el catálogo con otro nombre, y para casi
              ninguna entrada hay algo que hacer (un club de lectura no tiene
              tallerista, la mitad de los organizadores no tiene web, y una
              arancelada «a convenir» es legítima — B-114 dejó el monto
              opcional a propósito).

              Por eso van con `Proporcion` y no con `Cobertura`: la distinción
              es justamente si hay una acción pendiente detrás. Y por eso son
              **tres** y no cuatro: la imagen ya es la primera cobertura de
              acá arriba, y repetirla sería una segunda derivación de la misma
              pregunta.
            */}
            <div className="mt-3 border-t border-borde pt-3">
              <p className="text-sm font-medium">Lo que Google puede mostrar</p>
              <p className="mt-0.5 text-xs text-tinta/65">
                Con foto, con quién la da y con precio, un resultado de Google se ve
                como un evento y no como un link. La foto es «Con imagen», acá
                arriba; éstas son las otras tres. Ninguna es obligatoria: hay
                actividades que legítimamente no tienen tallerista, ni web, ni un
                monto cerrado.
              </p>
              <ul className="mt-3 space-y-3">
                <Proporcion
                  que="Dicen quién la da"
                  cuantas={estado.publicadas.enGoogle.conQuienLaDa}
                  total={estado.publicadas.total}
                />
                <Proporcion
                  que="Con web del organizador"
                  cuantas={estado.publicadas.enGoogle.conWebDelOrganizador}
                  total={estado.publicadas.total}
                />
                {/*
                  El denominador son las que **admiten** monto y no todas las
                  publicadas: gratis y a la gorra no lo llevan (el schema las
                  rechaza), así que contarlas como «sin precio» sería el
                  denominador equivocado — el mismo cuidado que B-703.
                */}
                {estado.publicadas.enGoogle.admitenMonto > 0 && (
                  <Proporcion
                    que="Aranceladas con el monto cargado"
                    cuantas={estado.publicadas.enGoogle.conMonto}
                    total={estado.publicadas.enGoogle.admitenMonto}
                  />
                )}
              </ul>
            </div>
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
            <p className="self-end text-sm text-tinta/65">
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

      {/*
        B-1081 — el ritmo va **al final** y no arriba: los avisos siguen siendo
        lo accionable, y «qué semanas están vacías» es contexto para decidir qué
        salir a buscar, no algo que haya que arreglar hoy. Contesta lo que los
        repartos de arriba no contestan nunca, que es *cuándo*.
      */}
      <Ritmo ritmo={ritmo} />
    </div>
  );
}
