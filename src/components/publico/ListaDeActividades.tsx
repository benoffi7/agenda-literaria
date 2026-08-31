/**
 * La grilla del listado, agrupada por mes — B-227, regrillada en B-247 (D-141).
 *
 * Como `Tarjeta`, tiene **un solo markup** y dos usos: el HTML del build (sin
 * hidratar, sin JavaScript) y el re-render de la island después de filtrar.
 *
 * ── Una, dos o tres columnas ──────────────────────────────────────────────
 * `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. **Una sola columna en el teléfono
 * no se negocia** (§8 del diseño: «nada de grilla de dos tarjetas en 375px»): la
 * mayoría entra desde un link de Instagram, en un navegador embebido, y dos
 * tarjetas en 375px dejan la portada del tamaño de un sello y el título en tres
 * palabras por línea.
 *
 * ── Los separadores de mes solo aparecen con el orden cronológico ──────────
 * Con «Recién agregadas» o «Título» el mes deja de ser la estructura de la lista
 * y un separador que agrupa cosas que no están juntas miente. Lo decide quien
 * llama, porque es quien sabe qué orden está puesto (ver `agruparPorMes`).
 *
 * ── El contador de prioridad cruza los grupos ─────────────────────────────
 * Las tres primeras portadas se cargan sin `lazy`, y «las tres primeras» es de la
 * **página**, no del grupo: con un índice por grupo, un mes con una sola actividad
 * dejaría eager la primera tarjeta de cada mes —incluida la de diciembre, que está
 * a cinco pantallas— y el navegador pediría de más justo lo que se quería evitar.
 */
import { Tarjeta } from '@/components/publico/Tarjeta';
import type { EntradaDeIndice } from '@/lib/eventsJson';
import { agruparPorMes, type MapaDeEtiquetas } from '@/lib/listadoPublico';

interface Props {
  entradas: readonly EntradaDeIndice[];
  ahora: Date;
  etiquetas: MapaDeEtiquetas;
  /** Con `false` sale una grilla plana, sin separadores. */
  agrupar?: boolean;
}

/** Cuántas portadas se cargan sin `lazy`: las que entran en el primer pantallazo. */
const PORTADAS_PRIORITARIAS = 3;

const CLASE_GRILLA = 'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3';

export function ListaDeActividades({ entradas, ahora, etiquetas, agrupar = true }: Props) {
  if (!agrupar) {
    return (
      <ul className={CLASE_GRILLA}>
        {entradas.map((e, i) => (
          <Tarjeta
            key={e.id}
            entrada={e}
            ahora={ahora}
            etiquetas={etiquetas}
            prioridad={i < PORTADAS_PRIORITARIAS}
          />
        ))}
      </ul>
    );
  }

  let vistas = 0;

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      {agruparPorMes(entradas, ahora).map((grupo) => (
        <section key={grupo.clave} aria-labelledby={`mes-${grupo.clave}`}>
          {/*
            Un `h2` de verdad y no un `div` con estilo: la jerarquía sin saltos
            es lo que hace navegable la página con lector de pantalla, y es lo
            mismo que lee el buscador (§10).
          */}
          <h2
            id={`mes-${grupo.clave}`}
            className="mb-3 flex items-center gap-3 font-sans text-xs font-semibold tracking-[0.18em] text-tinta/70 uppercase"
          >
            {grupo.titulo}
            {/* La línea que completa el ancho es decoración: no aporta nada que
                leer, así que no entra al árbol de accesibilidad. */}
            <span aria-hidden="true" className="h-px flex-1 bg-borde" />
          </h2>
          <ul className={CLASE_GRILLA}>
            {grupo.entradas.map((e) => {
              const prioridad = vistas < PORTADAS_PRIORITARIAS;
              vistas += 1;
              return (
                <Tarjeta
                  key={e.id}
                  entrada={e}
                  ahora={ahora}
                  etiquetas={etiquetas}
                  prioridad={prioridad}
                />
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
