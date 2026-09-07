import { useState } from 'react';
import { porcentaje, type Tajada } from '@/lib/estadoDelCatalogo';
import {
  SLUG_RESTO,
  agruparCola,
  arcosDeTorta,
  colorDeTajada,
  porcentajeLegible,
  sumaDeTajadas,
} from '@/lib/tortaDelPanel';
import {
  ETIQUETA_VISTA,
  VISTAS_DE_GRAFICO,
  almacenDeVistas,
  leerVistaRecordada,
  recordarVista,
  vistaInicial,
  type VistaDeGrafico,
} from '@/lib/vistaDeGrafico';

/**
 * Un reparto del tablero, con sus dos vistas — B-700, B-701, D-401.
 *
 * **Acá no se decide nada.** Los ángulos, la agrupación de la cola, el color y
 * el porcentaje salen de `lib/tortaDelPanel.ts`; con qué vista arranca, de
 * `lib/vistaDeGrafico.ts`. Este archivo es maquetación y cableado, que es lo
 * único que no se puede testear en este repo (§05: los componentes del panel no
 * tienen tests de render salvo la excepción angosta de B-08).
 *
 * Las tres cosas que sí decide, y las tres son de presentación:
 *
 * 1. **La torta lleva `role="img"` con la etiqueta completa.** Un `<svg>` de
 *    cuñas no lo lee nada: el `aria-label` dice el reparto entero en palabras,
 *    así que la vista de torta no es un callejón sin salida para un lector de
 *    pantalla ni siquiera antes de tocar el toggle.
 * 2. **Las cuñas van separadas por una línea del color del papel.** Dos barrios
 *    con matices derivados de slugs parecidos pueden caer a pocos grados uno del
 *    otro (`colorDeTipo` garantiza contraste contra el fondo, no entre dos
 *    tonos); el filete es lo que deja ver dónde termina una y empieza la otra.
 * 3. **La nota dice sobre qué todo se reparte**, y es obligatoria por firma
 *    (`unidad`): es la mitad de D-401 que el módulo puro no puede hacer cumplir.
 *    «Sobre 47 formas de cursar ofrecidas» y no «sobre 40 actividades».
 */

interface Props {
  titulo: string;
  /**
   * De qué son las tajadas: `'actividades'`, `'formas de cursar ofrecidas'`.
   * Obligatoria — es lo que hace que el porcentaje signifique algo (D-401).
   */
  unidad: string;
  /** Una aclaración más, cuando el reparto tiene una trampa propia. */
  nota?: string;
  /** Con qué clave se recuerda la vista elegida. Única por reparto. */
  clave: string;
  tajadas: Tajada[];
  /** Del slug a la etiqueta de `/opciones/*`. La resuelve la pantalla (§4.1). */
  etiqueta: (valor: string) => string;
  /** Los matices elegidos a mano, cuando el reparto es por tipo (D-150). */
  tonos?: Record<string, number>;
  /** Qué vista se usa si no hay memoria. */
  porDefecto?: VistaDeGrafico;
}

/** Cómo se lee «el resto» en pantalla, sabiendo cuántas categorías junta. */
const etiquetaDelResto = (agrupa: number): string =>
  `Otras ${agrupa}`;

export function Reparto({
  titulo,
  unidad,
  nota,
  clave,
  tajadas,
  etiqueta,
  tonos = {},
  porDefecto = 'torta',
}: Props) {
  /*
   * La memoria se lee **una sola vez, al montar** (inicializador perezoso del
   * `useState`). Leerla en cada render la convertiría en una lectura de
   * `localStorage` por reparto por render, y peor: pisaría lo que la persona
   * acaba de elegir con lo que había guardado.
   */
  const [vista, setVista] = useState<VistaDeGrafico>(() =>
    vistaInicial({ recordada: leerVistaRecordada(almacenDeVistas(), clave), porDefecto }),
  );

  const elegir = (proxima: VistaDeGrafico) => {
    setVista(proxima);
    recordarVista(almacenDeVistas(), clave, proxima);
  };

  const agrupadas = agruparCola(tajadas);
  const total = sumaDeTajadas(agrupadas);
  const arcos = arcosDeTorta(agrupadas, tonos);

  const nombre = (valor: string, agrupa: number): string =>
    valor === SLUG_RESTO ? etiquetaDelResto(agrupa) : etiqueta(valor);

  return (
    <section className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta/55">{titulo}</h3>
          {/*
            D-401 — sobre qué todo se reparte, **siempre**. Sin esta línea, un
            reparto que cuenta doble (B-224) se lee como si fuera sobre las
            actividades y los porcentajes mienten sin que nada se vea roto.
          */}
          <p className="mt-0.5 text-xs text-tinta/45">
            Sobre {total} {unidad}.{nota ? ` ${nota}` : ''}
          </p>
        </div>
        {total > 0 && (
          <div className="flex shrink-0 border border-borde" role="group" aria-label={`Vista de «${titulo}»`}>
            {VISTAS_DE_GRAFICO.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={vista === v}
                onClick={() => elegir(v)}
                className={`px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acento/40 ${
                  vista === v ? 'bg-tinta text-papel' : 'text-tinta/55 hover:text-tinta'
                }`}
              >
                {ETIQUETA_VISTA[v]}
              </button>
            ))}
          </div>
        )}
      </div>

      {total === 0 ? (
        <p className="mt-2 text-sm text-tinta/50">Todavía nada acá.</p>
      ) : vista === 'torta' ? (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <svg
            viewBox="0 0 100 100"
            className="h-28 w-28 shrink-0"
            role="img"
            aria-label={`${titulo}: ${arcos
              .map(
                (a) =>
                  `${nombre(a.valor, a.agrupa)}, ${a.cantidad}, ${porcentajeLegible(a.cantidad, total)}`,
              )
              .join('; ')}`}
          >
            {arcos.map((a) => (
              <path
                key={a.valor}
                d={a.d}
                fill={a.color}
                stroke="var(--color-papel)"
                strokeWidth={1}
              />
            ))}
          </svg>
          {/*
            La referencia va al lado y no encima de las cuñas: una etiqueta
            adentro de una cuña de 8° no entra, y el sistema no tiene una tinta
            clara con contraste suficiente para escribir arriba de las siete.
          */}
          <ul className="min-w-0 flex-1 space-y-1">
            {arcos.map((a) => (
              <li key={a.valor} className="flex items-baseline gap-2">
                <span
                  aria-hidden="true"
                  /* 12px y no 10: los espaciados de este archivo se apoyan en
                     la grilla de base de 4px del sistema visual. */
                  className="mt-1 block h-3 w-3 shrink-0"
                  style={{ backgroundColor: a.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {nombre(a.valor, a.agrupa)}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">{a.cantidad}</span>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-tinta/50">
                  {porcentajeLegible(a.cantidad, total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        /*
          La lista: **no** agrupa la cola. Es su ventaja sobre la torta —no tiene
          un límite de legibilidad a las seis filas—, y agrupar acá le sacaría el
          nombre a categorías que sí entran.
        */
        <ul className="mt-3 space-y-2">
          {tajadas.map((t) => (
            <li key={t.valor} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm">{etiqueta(t.valor)}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {t.cantidad}
                  <span className="ml-2 font-normal text-tinta/50">
                    {porcentajeLegible(t.cantidad, total)}
                  </span>
                </span>
              </div>
              <span
                aria-hidden="true"
                className="mt-1 block h-1.5 w-full overflow-hidden bg-tinta/8"
              >
                <span
                  className="block h-full"
                  style={{
                    width: `${porcentaje(t.cantidad, total)}%`,
                    backgroundColor: colorDeTajada(t.valor, tonos),
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
