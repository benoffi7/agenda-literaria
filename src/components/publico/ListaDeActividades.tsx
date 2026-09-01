/**
 * El listado, agrupado por mes — B-227, rehecho en B-260 (D-146).
 *
 * Como `FilaDeActividad`, tiene **un solo markup** y dos usos: el HTML del build
 * (sin hidratar, sin JavaScript) y el re-render de la island después de filtrar.
 *
 * ── El marcador de mes es el gesto más fuerte de la página ────────────────
 * «SEPTIEMBRE» en la display a 72px con una regla gruesa debajo. No es un separador
 * decorativo: es lo que convierte una lista de 38 fechas en un **programa**, y es
 * la única cosa de la página que va a `display-lg`. Por eso el nombre del sitio,
 * que en la referencia iba al mismo cuerpo, bajó un escalón (ver `Encabezado`).
 *
 * Lo dibuja `MarcadorDeMes`, que **no vive acá** desde B-113: la página de mes
 * pinta exactamente el mismo marcador, y dos markups iguales se separan en el
 * primer cambio — el año en versalitas de un lado y en cuerpo del otro, la regla
 * gruesa en uno y no en el otro.
 *
 * ── Los separadores de mes solo aparecen con el orden cronológico ──────────
 * Con «Recién agregadas» o «Título» el mes deja de ser la estructura de la lista
 * y un separador que agrupa cosas que no están juntas miente. Lo decide quien
 * llama, porque es quien sabe qué orden está puesto (ver `agruparPorMes`).
 *
 * ── Las tres formas de la misma lista ─────────────────────────────────────
 * | Cómo se llama | Qué sale | Quién la usa |
 * |---|---|---|
 * | por defecto | un marcador por mes, agrupando por la próxima sesión | la home y la island con el orden cronológico |
 * | `agrupar={false}` | una lista corrida, sin marcadores | la island con «Recién agregadas» o «Título» |
 * | `mes="2026-09"` | **un solo** grupo, con el marcador de ese mes | la página `/agenda/2026-09` (B-113) |
 *
 * La tercera no es la primera con otro nombre: agrupar por la próxima sesión en
 * la página de octubre pondría un ciclo que empezó en septiembre bajo un marcador
 * «SEPTIEMBRE», que es exactamente lo que esa página no puede decir.
 *
 * ── Sin grilla y sin `lazy` que administrar ───────────────────────────────
 * B-247 tenía acá un contador de portadas prioritarias que cruzaba los grupos,
 * para que las tres primeras imágenes no fueran `lazy`. Ya no existe: **el
 * listado no tiene imágenes**, así que no hay nada que priorizar y la página no
 * pide un solo byte de imagen. Es la mejora de rendimiento más grande del
 * rediseño y salió de una decisión de diseño, no de una optimización.
 */
import { FilaDeActividad } from '@/components/publico/FilaDeActividad';
import { MarcadorDeMes } from '@/components/publico/MarcadorDeMes';
import type { EntradaDeIndice } from '@/lib/eventsJson';
import { agruparPorMes, type MapaDeEtiquetas, type TonosDeTipo } from '@/lib/listadoPublico';

interface Props {
  entradas: readonly EntradaDeIndice[];
  ahora: Date;
  etiquetas: MapaDeEtiquetas;
  /** Los matices elegidos para los tipos (D-150). Se pasan a cada fila. */
  tonos: TonosDeTipo;
  /** Con `false` sale una lista corrida, sin marcadores de mes. */
  agrupar?: boolean;
  /**
   * La clave del mes cuando la lista **es** una página de mes (`/agenda/2026-09`,
   * B-113): sale un solo grupo con ese marcador, y la clave viaja hasta cada
   * fila, que con ella recalcula lo que deriva de las sesiones para hablar de ese
   * mes y no del ciclo entero.
   */
  mes?: string;
}

/**
 * La regla que abre la lista, escrita **una sola vez**.
 *
 * `regla-gruesa-arriba` cierra el bloque por arriba: el sistema pide que una
 * sección mayor la corte una regla de 2px, y la primera fila necesita una regla
 * de este lado para que la lista arranque contra algo. **Adentro de un grupo no
 * va**: ya la puso el marcador, y dos reglas de 2px pegadas se leen como una de
 * 4px que nadie pidió.
 */
const CLASE_FILAS = 'flex flex-col';
const CLASE_LISTA = `regla-gruesa-arriba ${CLASE_FILAS}`;

export function ListaDeActividades({
  entradas,
  ahora,
  etiquetas,
  tonos,
  agrupar = true,
  mes,
}: Props) {
  /*
   * Las filas se arman en un solo lugar y las tres formas lo reusan: escrito tres
   * veces, el día que la fila gane una prop hay dos que se olvidan — y las tres
   * se ven bien por separado, que es la firma de esta clase de bug.
   */
  const filas = (deLaLista: readonly EntradaDeIndice[]) =>
    deLaLista.map((e) => (
      <FilaDeActividad
        key={e.id}
        entrada={e}
        ahora={ahora}
        etiquetas={etiquetas}
        tonos={tonos}
        mes={mes}
      />
    ));

  // Una página de mes: un solo grupo, con el marcador de **ese** mes y no del que
  // salga de la próxima sesión de cada entrada.
  if (mes) {
    return (
      <section aria-labelledby={`mes-${mes}`}>
        <MarcadorDeMes clave={mes} id={`mes-${mes}`} />
        <ul className={CLASE_FILAS}>{filas(entradas)}</ul>
      </section>
    );
  }

  if (!agrupar) return <ul className={CLASE_LISTA}>{filas(entradas)}</ul>;

  return (
    <div className="flex flex-col gap-10 sm:gap-14">
      {agruparPorMes(entradas, ahora).map((grupo) => (
        <section key={grupo.clave} aria-labelledby={`mes-${grupo.clave}`}>
          <MarcadorDeMes clave={grupo.clave} id={`mes-${grupo.clave}`} />
          <ul className={CLASE_FILAS}>{filas(grupo.entradas)}</ul>
        </section>
      ))}
    </div>
  );
}
