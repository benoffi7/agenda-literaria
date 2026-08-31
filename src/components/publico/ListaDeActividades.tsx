/**
 * El listado, agrupado por mes — B-227, rehecho en B-260 (D-146).
 *
 * Como `FilaDeActividad`, tiene **un solo markup** y dos usos: el HTML del build
 * (sin hidratar, sin JavaScript) y el re-render de la island después de filtrar.
 *
 * ── El marcador de mes es el gesto más fuerte de la página ────────────────
 * «SEPTIEMBRE» en Bodoni de 72px con una regla gruesa debajo. No es un separador
 * decorativo: es lo que convierte una lista de 38 fechas en un **programa**, y es
 * la única cosa de la página que va a `display-lg`. Por eso el nombre del sitio,
 * que en la referencia iba al mismo cuerpo, bajó un escalón (ver `Encabezado`).
 *
 * **El año va aparte y chico.** «SEPTIEMBRE DE 2026» a 72px no entra en un
 * teléfono y encima agranda el dato que menos importa: casi siempre es el año
 * corriente. El corte lo hace `partesDeMes`, que es puro y sale de las partes de
 * `Intl` y no de partir la cadena ya formateada — que es lo que se rompe el día
 * que cambie el formato del idioma.
 *
 * ── Los separadores de mes solo aparecen con el orden cronológico ──────────
 * Con «Recién agregadas» o «Título» el mes deja de ser la estructura de la lista
 * y un separador que agrupa cosas que no están juntas miente. Lo decide quien
 * llama, porque es quien sabe qué orden está puesto (ver `agruparPorMes`).
 *
 * ── Sin grilla y sin `lazy` que administrar ───────────────────────────────
 * B-247 tenía acá un contador de portadas prioritarias que cruzaba los grupos,
 * para que las tres primeras imágenes no fueran `lazy`. Ya no existe: **el
 * listado no tiene imágenes**, así que no hay nada que priorizar y la página no
 * pide un solo byte de imagen. Es la mejora de rendimiento más grande del
 * rediseño y salió de una decisión de diseño, no de una optimización.
 */
import { FilaDeActividad } from '@/components/publico/FilaDeActividad';
import type { EntradaDeIndice } from '@/lib/eventsJson';
import { partesDeMes } from '@/lib/fechasPublicas';
import { agruparPorMes, type MapaDeEtiquetas } from '@/lib/listadoPublico';

interface Props {
  entradas: readonly EntradaDeIndice[];
  ahora: Date;
  etiquetas: MapaDeEtiquetas;
  /** Con `false` sale una lista corrida, sin marcadores de mes. */
  agrupar?: boolean;
}

/**
 * La lista, **una sola definición**. Se usa agrupada y plana, y son la misma
 * lista: escrita dos veces, cambiar una sola deja las dos vistas del mismo
 * listado con distinto ritmo vertical.
 *
 * `regla-gruesa-arriba` cierra el bloque por arriba: el sistema pide que una
 * sección mayor la corte una regla de 2px, y la primera fila necesita una regla
 * de este lado para que la lista arranque contra algo.
 */
const CLASE_LISTA = 'regla-gruesa-arriba flex flex-col';

export function ListaDeActividades({ entradas, ahora, etiquetas, agrupar = true }: Props) {
  if (!agrupar) {
    return (
      <ul className={CLASE_LISTA}>
        {entradas.map((e) => (
          <FilaDeActividad key={e.id} entrada={e} ahora={ahora} etiquetas={etiquetas} />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-10 sm:gap-14">
      {agruparPorMes(entradas, ahora).map((grupo) => {
        const { mes, anio } = partesDeMes(grupo.clave);
        return (
          <section key={grupo.clave} aria-labelledby={`mes-${grupo.clave}`}>
            {/*
              Un `h2` de verdad y no un `div` con estilo: la jerarquía sin saltos
              es lo que hace navegable la página con lector de pantalla, y es lo
              mismo que lee el buscador (§10).

              La regla gruesa va **en el `h2`**, no en un `<hr>`: es el borde de
              abajo del marcador, así que no puede quedar separada de él.
            */}
            <h2
              id={`mes-${grupo.clave}`}
              className="regla-gruesa flex items-baseline justify-between gap-4 pb-2"
            >
              <span className="display-lg text-acento">{mes}</span>
              {/*
                El año en versalitas al lado. Sin `aria-hidden`: es parte del
                nombre del grupo y quien escucha la página necesita saber de qué
                año se está hablando tanto como quien lo ve.
              */}
              {anio && <span className="label-caps shrink-0 text-super">{anio}</span>}
            </h2>

            {/*
              La lista de este mes **no** lleva la regla gruesa de arriba: ya la
              puso el marcador. Por eso las clases se componen y no se reusa
              `CLASE_LISTA` entera.
            */}
            <ul className="flex flex-col">
              {grupo.entradas.map((e) => (
                <FilaDeActividad key={e.id} entrada={e} ahora={ahora} etiquetas={etiquetas} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
