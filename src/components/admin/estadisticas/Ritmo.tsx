import { useId } from 'react';
import { Barra } from '@/components/admin/estadisticas/Barra';
import { diaLegible } from '@/lib/calendarioPanel';
import {
  DIAS_DE_LA_SEMANA,
  FRANJAS,
  INFO_FRANJA,
  cuantosEncuentros,
  fechaCorta,
  hayEscala,
  rangosDeLaEscala,
  textoDeCelda,
  type DiaDelMapa,
  type RitmoDelCatalogo,
} from '@/lib/ritmoDelCatalogo';
import { porcentajeLegible } from '@/lib/tortaDelPanel';

/**
 * «Cuándo pasan las cosas» — el ritmo del catálogo dibujado (B-1081, sobre
 * B-704, B-705 y B-706).
 *
 * **Acá no se decide nada que se pueda testear sin DOM.** Qué encuentros
 * cuentan, la escala, la leyenda, qué semana está vacía y cómo se dice una celda
 * en palabras salen de `lib/ritmoDelCatalogo.ts`; este archivo acomoda. Es el
 * mismo reparto que `Reparto.tsx` con `lib/tortaDelPanel.ts`.
 *
 * Las decisiones de presentación, que son las que viven acá:
 *
 * 1. **El mapa es una `<table>` de verdad**, no una grilla de `<div>`. Es el
 *    equivalente para un lector de pantalla sin escribir una segunda vista: cada
 *    fila es una semana con su `<th scope="row">`, cada columna un día con su
 *    `<th scope="col">`, y cada celda dice en palabras la fecha y la cantidad
 *    (`textoDeCelda`). Arriba de la tabla va además **la conclusión en texto**
 *    —cuántos días sin nada y qué semanas quedan vacías—, que es lo que quien
 *    mira los colores saca de un golpe y quien recorre celda por celda no.
 * 2. **El color nunca es lo único que informa** (WCAG 1.4.1). Cada celda con
 *    encuentros lleva su número escrito; el color ayuda a encontrar la semana
 *    cargada, no la afirma. Por eso la escala puede ser de tres escalones y no
 *    de diez.
 * 3. **Ningún número inventado** (D-272). Sin encuentros en la ventana no se
 *    dibuja una grilla de ceros: se dice que no hay y por qué. Con un máximo de
 *    uno o dos encuentros por día no hay escala, y la leyenda y una frase lo
 *    dicen, en vez de pintar «saturado» un día con dos.
 * 4. **En un teléfono entra sin scroll.** Siete columnas y la fecha corta de la
 *    fila (`28/9`) caben en 288px; la tabla tiene su `overflow-x-auto` igual,
 *    por si una fuente grande la empuja, para que nunca ensanche el panel entero.
 */

/**
 * Las clases de una celda según su nivel, del 0 (nada) al 3 (mucho).
 *
 * Exportadas para que `tests/ritmo-del-tablero.render.test.tsx` mida el
 * contraste del número **contra el fondo que de verdad lleva**, leyéndolo de
 * estas mismas clases: una lista de colores copiada en el test se quedaría con
 * la paleta vieja el día que alguien cambie una de acá.
 *
 * El nivel 3 lleva el texto en blanco y no en tinta: sobre el acento pleno la
 * tinta da 2,57:1 y el blanco 6,67:1.
 */
export const CELDA_POR_NIVEL: readonly string[] = [
  'bg-white text-tinta',
  'bg-acento/15 text-tinta',
  'bg-acento/40 text-tinta',
  'bg-acento text-white',
];

/** Los días de esta semana que ya pasaron: apagados, sin el color de la escala. */
export const CELDA_YA_PASO = 'bg-tinta/6 text-tinta/70';

/** Cómo se llama cada nivel en la leyenda. */
const NOMBRE_DEL_NIVEL = ['nada', 'poco', 'bastante', 'mucho'];

export const claseDeCelda = (d: DiaDelMapa): string =>
  d.yaPaso ? CELDA_YA_PASO : (CELDA_POR_NIVEL[d.nivel] ?? CELDA_POR_NIVEL[0]!);

const rango = (desde: number, hasta: number): string =>
  desde === hasta ? `${desde}` : `${desde} a ${hasta}`;

/** «la semana del 12/10», «la del 12/10 y la del 19/10». */
const listaDeSemanas = (claves: string[]): string => {
  const partes = claves.map((c, i) => `${i === 0 ? 'la semana' : 'la'} del ${fechaCorta(c)}`);
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
};

/** Una muestra de color de la leyenda. Decorativa: el nombre va al lado. */
function Muestra({ clase }: { clase: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-4 shrink-0 rounded-sm border border-tinta/10 ${clase}`}
    />
  );
}

function MapaDeCalor({ ritmo }: { ritmo: RitmoDelCatalogo }) {
  const { mapa, semanasVacias } = ritmo;
  const primero = mapa.semanas[0]![0]!.clave;
  const ultimo = mapa.semanas.at(-1)!.at(-1)!.clave;
  const dias = mapa.semanas.length * 7;
  const conEscala = hayEscala(mapa);
  const rangos = rangosDeLaEscala(mapa.maximo);

  return (
    <section className="min-w-0">
      <h3 className="text-sm font-medium">Las próximas {mapa.semanas.length} semanas</h3>
      {mapa.total === 0 ? (
        <p className="mt-1 text-sm text-tinta/70">
          No hay ningún encuentro cargado entre el {diaLegible(primero)} y el{' '}
          {diaLegible(ultimo)}, así que no hay mapa que mostrar: serían {dias} casilleros
          vacíos. En cuanto se cargue uno, aparece acá.
        </p>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-tinta/70">
            Del {diaLegible(primero)} al {diaLegible(ultimo)}: {cuantosEncuentros(mapa.total)},
            y {mapa.diasVacios} de los {dias} días sin ninguno.{' '}
            {semanasVacias.length === 0
              ? 'Ninguna semana queda sin nada por venir.'
              : `Sin nada por venir: ${listaDeSemanas(semanasVacias)}.`}
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[17rem] table-fixed border-separate border-spacing-0.5 text-center text-xs tabular-nums sm:text-sm">
              <caption className="sr-only">
                Encuentros por día, del {diaLegible(primero)} al {diaLegible(ultimo)}. Cada fila
                es una semana y cada columna un día.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="w-12">
                    <span className="sr-only">Semana del</span>
                  </th>
                  {DIAS_DE_LA_SEMANA.map((d) => (
                    <th key={d.indice} scope="col" className="pb-1 font-medium text-tinta/70">
                      <span aria-hidden="true">{d.corto}</span>
                      <span className="sr-only">{d.largo}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mapa.semanas.map((semana) => (
                  <tr key={semana[0]!.clave}>
                    <th
                      scope="row"
                      className="pr-1 text-right text-xs font-normal whitespace-nowrap text-tinta/70"
                    >
                      <span className="sr-only">Semana del </span>
                      {fechaCorta(semana[0]!.clave)}
                    </th>
                    {semana.map((d) => (
                      <td
                        key={d.clave}
                        title={textoDeCelda(d)}
                        data-nivel={d.yaPaso ? 'ya-paso' : d.nivel}
                        className={`h-8 rounded-sm border border-tinta/10 ${claseDeCelda(d)} ${
                          d.esHoy ? 'ring-2 ring-tinta ring-inset' : ''
                        }`}
                      >
                        <span aria-hidden="true">{d.cantidad > 0 ? d.cantidad : ''}</span>
                        <span className="sr-only">{textoDeCelda(d)}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
            La leyenda dice qué cantidades pinta cada color —«3 a 4», no solo
            «bastante»—, y los rangos salen de la inversa de la escala: una
            leyenda escrita a mano al lado de celdas calculadas es la clase de
            dos listas que se separan sin que nada falle.
          */}
          <ul
            aria-label="Referencias del mapa"
            className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta/70"
          >
            <li className="flex items-center gap-1.5">
              <Muestra clase={CELDA_POR_NIVEL[0]!} />
              {NOMBRE_DEL_NIVEL[0]}
            </li>
            {conEscala ? (
              rangos.map((r) => (
                <li key={r.nivel} className="flex items-center gap-1.5">
                  <Muestra clase={CELDA_POR_NIVEL[r.nivel]!} />
                  {NOMBRE_DEL_NIVEL[r.nivel]} ({rango(r.desde, r.hasta)})
                </li>
              ))
            ) : (
              <li className="flex items-center gap-1.5">
                <Muestra clase={CELDA_POR_NIVEL[1]!} />
                hay
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <Muestra clase={CELDA_YA_PASO} />
              ya pasó
            </li>
            <li className="flex items-center gap-1.5">
              <Muestra clase="bg-white ring-2 ring-tinta ring-inset" />
              hoy
            </li>
          </ul>
          {!conEscala && (
            <p className="mt-1 text-xs text-tinta/70">
              Ningún día tiene más de {cuantosEncuentros(mapa.maximo)}, así que el color no
              gradúa: dice solo si hay o no hay.
            </p>
          )}
        </>
      )}
    </section>
  );
}

interface FilaDeTiempo {
  clave: string;
  etiqueta: string;
  detalle?: string;
  cantidad: number;
}

/**
 * Una de las dos vistas de tiempo: filas con su número, su porcentaje y la
 * barra del tablero.
 *
 * **Todas las filas, también las de cero.** «No hay nada los lunes» es lo que
 * esta vista vino a contestar, y una fila ausente se confunde con un día que no
 * se miró. La barra va contra el más cargado y no contra el total: con siete
 * días, contra el total todas quedarían cortas y no se distinguiría el martes
 * saturado; el porcentaje escrito es el que dice la parte del total.
 */
function VistaDeTiempo({
  titulo,
  nota,
  filas,
  total,
}: {
  titulo: string;
  nota: string;
  filas: FilaDeTiempo[];
  total: number;
}) {
  const tope = filas.reduce((m, f) => Math.max(m, f.cantidad), 0);
  return (
    <section className="min-w-0">
      <h3 className="text-sm font-medium">{titulo}</h3>
      <p className="mt-0.5 text-xs text-tinta/70">{nota}</p>
      <ul className="mt-2 space-y-2">
        {filas.map((f) => (
          <li key={f.clave} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm">
                {f.etiqueta}
                {f.detalle && <span className="ml-1 text-xs text-tinta/70">{f.detalle}</span>}
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {f.cantidad}
                <span className="ml-1 font-normal text-tinta/70">
                  ({porcentajeLegible(f.cantidad, total)})
                </span>
              </span>
            </div>
            <Barra parte={f.cantidad} total={tope} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const conMayuscula = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function Ritmo({ ritmo }: { ritmo: RitmoDelCatalogo }) {
  const idTitulo = useId();
  const nota =
    ritmo.porVenir === 1
      ? 'Sobre el único encuentro por venir, no solo las próximas semanas.'
      : `Sobre los ${ritmo.porVenir} encuentros por venir, no solo las próximas semanas.`;

  return (
    <section aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="font-serif text-lg font-semibold">
        Cuándo pasan las cosas
      </h2>
      <p className="mt-0.5 text-xs text-tinta/70">
        Cuentan los encuentros que pueden pasar: los cancelados no, los borradores sí, porque
        ocupan una fecha.
      </p>
      {/*
        B-1081 · D-400 — el mapa a la izquierda y las dos vistas de tiempo a la
        derecha desde `xl`, que es donde el mapa ya no gana nada con más ancho:
        ocho filas de siete celdas se leen igual a 700px que a 1000. Por debajo
        de `xl` van apiladas, y las dos vistas se ponen lado a lado desde `sm`.
      */}
      <div className="mt-3 grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <MapaDeCalor ritmo={ritmo} />
        {ritmo.porVenir === 0 ? (
          <p className="text-sm text-tinta/70">
            No hay ningún encuentro por venir, así que no hay reparto por día ni por franja
            que mostrar: los dos serían ceros.
          </p>
        ) : (
          <div className="grid min-w-0 gap-6 sm:grid-cols-2 xl:grid-cols-1">
            <VistaDeTiempo
              titulo="Por día de la semana"
              nota={nota}
              total={ritmo.porVenir}
              filas={DIAS_DE_LA_SEMANA.map((d) => ({
                clave: d.largo,
                etiqueta: conMayuscula(d.largo),
                cantidad: ritmo.porDia[d.indice] ?? 0,
              }))}
            />
            <VistaDeTiempo
              titulo="Por franja horaria"
              nota="Con los cortes del circuito: un taller de las 19 es de noche."
              total={ritmo.porVenir}
              filas={FRANJAS.map((f) => ({
                clave: f,
                etiqueta: INFO_FRANJA[f].etiqueta,
                detalle: `de ${INFO_FRANJA[f].desde} a ${INFO_FRANJA[f].hasta} h`,
                cantidad: ritmo.porFranja[f],
              }))}
            />
          </div>
        )}
      </div>
    </section>
  );
}
