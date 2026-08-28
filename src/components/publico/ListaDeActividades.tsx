/**
 * El listado, agrupado por mes — B-227, §4.1 del diseño.
 *
 * Como `Tarjeta`, tiene **un solo markup** y dos usos: el HTML del build (sin
 * hidratar, sin JavaScript) y el re-render de la island después de filtrar.
 *
 * **Los separadores de mes solo aparecen con el orden cronológico.** Con «Recién
 * agregadas» o «Título» el mes deja de ser la estructura de la lista y un
 * separador que agrupa cosas que no están juntas miente. Lo decide quien llama,
 * porque es quien sabe qué orden está puesto (ver `agruparPorMes`).
 */
import { Tarjeta } from '@/components/publico/Tarjeta';
import { agruparPorMes, type MapaDeEtiquetas } from '@/lib/listadoPublico';
import type { EntradaDeIndice } from '@/lib/eventsJson';

interface Props {
  entradas: readonly EntradaDeIndice[];
  ahora: Date;
  etiquetas: MapaDeEtiquetas;
  /** Con `false` sale una lista plana, sin separadores. */
  agrupar?: boolean;
}

export function ListaDeActividades({ entradas, ahora, etiquetas, agrupar = true }: Props) {
  if (!agrupar) {
    return (
      <ul className="flex flex-col gap-3">
        {entradas.map((e) => (
          <Tarjeta key={e.id} entrada={e} ahora={ahora} etiquetas={etiquetas} />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {agruparPorMes(entradas, ahora).map((grupo) => (
        <section key={grupo.clave} aria-labelledby={`mes-${grupo.clave}`}>
          {/*
            Un `h2` de verdad y no un `div` con estilo: la jerarquía sin saltos
            es lo que hace navegable la página con lector de pantalla, y es lo
            mismo que lee el buscador (§10).
          */}
          <h2
            id={`mes-${grupo.clave}`}
            className="mb-3 border-b border-borde pb-1 font-sans text-xs font-semibold tracking-[0.15em] text-tinta/65 uppercase"
          >
            {grupo.titulo}
          </h2>
          <ul className="flex flex-col gap-3">
            {grupo.entradas.map((e) => (
              <Tarjeta key={e.id} entrada={e} ahora={ahora} etiquetas={etiquetas} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
