import { useEffect, useMemo, useRef, useState } from 'react';
import { claseEnlaceCelda } from '@/components/admin/campos/Campo';
import { useLabelsTaxonomia } from '@/components/admin/useOpciones';
import { listarActividades } from '@/lib/actividades';
import { medirFuncion } from '@/lib/analytics';
import {
  DIAS_PROXIMOS,
  estadoDelCatalogo,
  porcentaje,
  type Tajada,
} from '@/lib/estadoDelCatalogo';
import { ETIQUETA_ESTADO, ETIQUETA_MODALIDAD, legible } from '@/lib/filtrosActividades';
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
 * Cuatro propiedades, todas deliberadas:
 *
 * 1. **No mide a nadie.** No existe el visitante en esta pantalla, y nada de lo
 *    que se ve acá sale del navegador del dueño.
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

export function EstadisticasPanel({ onEditar }: Props) {
  const [actividades, setActividades] = useState<ActividadConId[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState<string | null>(null);
  const labels = useLabelsTaxonomia();

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
        Esto es lo que se sabe del catálogo, sin medir a nadie que visite el sitio.
        El sitio público hoy no mide nada.
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

      {/* ── Qué tan completo está lo que se publica ── */}
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
              falta="Las demás ya pasaron y siguen publicadas."
            />
          </ul>
        </section>
      )}

      {/* ── Los repartos ── */}
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
  );
}
