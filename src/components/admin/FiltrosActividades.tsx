import { useId, useState } from 'react';
import { Campo, claseBotonChip, claseBotonChipActivo, claseInput } from '@/components/admin/campos/Campo';
import {
  CUANDOS,
  ETIQUETA_CUANDO,
  ETIQUETA_ESTADO,
  ETIQUETA_MODALIDAD,
  ETIQUETA_ORDEN,
  FILTROS_VACIOS,
  ORDENES,
  cantidadDeFiltros,
  legible,
  type Filtros,
  type OpcionesPresentes,
  type Orden,
} from '@/lib/filtrosActividades';
import type { LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import type { Estado, Modalidad } from '@/types/actividad';

interface Props {
  filtros: Filtros;
  onFiltros: (f: Filtros) => void;
  orden: Orden;
  onOrden: (o: Orden) => void;
  /** Solo los valores que existen en los datos (ver `opcionesPresentes`). */
  opciones: OpcionesPresentes;
  /** `{ campo: { valor: etiqueta } }` — se muestra la etiqueta, no el valor (§4.1). */
  labels: LabelsTaxonomia;
  /** Cuántas hay en total y cuántas quedaron después de filtrar. */
  total: number;
  mostradas: number;
}

/**
 * Orden y filtros del listado (B-126, D-73, D-74).
 *
 * **Los filtros arrancan colapsados detrás de un botón** que muestra cuántos hay
 * puestos. En 360px cinco desplegables abiertos empujan el listado abajo del
 * pliegue, y el listado es lo que se vino a ver. El número del botón es lo que
 * impide que un filtro olvidado explique un listado que parece vacío.
 *
 * **No hay una sola query nueva:** todo sale de las actividades que el listado ya
 * tiene en memoria (§2.5).
 */
export function FiltrosActividades({
  filtros,
  onFiltros,
  orden,
  onOrden,
  opciones,
  labels,
  total,
  mostradas,
}: Props) {
  const puestos = cantidadDeFiltros(filtros);
  const [abierto, setAbierto] = useState(puestos > 0);
  const id = useId();

  const cambiar = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) =>
    onFiltros({ ...filtros, [campo]: valor });

  /** La etiqueta de un valor de taxonomía, con la legibilización como respaldo. */
  const etiqueta = (campo: 'tipo' | 'barrio', valor: string) =>
    labels[campo]?.[valor] ?? legible(valor);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={id}
          onClick={() => setAbierto((v) => !v)}
          className={puestos > 0 ? claseBotonChipActivo : claseBotonChip}
        >
          Filtros{puestos > 0 && ` (${puestos})`}
        </button>

        <label className="flex min-w-0 items-center gap-2 text-xs text-tinta/60">
          Ordenar por
          <select
            className={`${claseInput} sm:max-w-52`}
            value={orden}
            onChange={(e) => onOrden(e.target.value as Orden)}
          >
            {ORDENES.map((o) => (
              <option key={o} value={o}>
                {ETIQUETA_ORDEN[o]}
              </option>
            ))}
          </select>
        </label>

        <p className="text-xs text-tinta/55 sm:ml-auto">
          {mostradas === total
            ? `${total} ${total === 1 ? 'actividad' : 'actividades'}`
            : `${mostradas} de ${total}`}
        </p>
      </div>

      {abierto && (
        <div
          id={id}
          className="flex flex-col gap-3 rounded-md border border-borde bg-white/60 px-3 py-3"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Campo label="Estado" htmlFor={`${id}-estado`}>
              <select
                id={`${id}-estado`}
                className={claseInput}
                value={filtros.estado}
                onChange={(e) => cambiar('estado', e.target.value as Estado | '')}
              >
                <option value="">Cualquiera</option>
                {opciones.estados.map((v) => (
                  <option key={v} value={v}>
                    {ETIQUETA_ESTADO[v]}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Tipo" htmlFor={`${id}-tipo`}>
              <select
                id={`${id}-tipo`}
                className={claseInput}
                value={filtros.tipo}
                onChange={(e) => cambiar('tipo', e.target.value)}
              >
                <option value="">Cualquiera</option>
                {opciones.tipos.map((v) => (
                  <option key={v} value={v}>
                    {etiqueta('tipo', v)}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Modalidad" htmlFor={`${id}-modalidad`}>
              <select
                id={`${id}-modalidad`}
                className={claseInput}
                value={filtros.modalidad}
                onChange={(e) => cambiar('modalidad', e.target.value as Modalidad | '')}
              >
                <option value="">Cualquiera</option>
                {opciones.modalidades.map((v) => (
                  <option key={v} value={v}>
                    {ETIQUETA_MODALIDAD[v]}
                  </option>
                ))}
              </select>
            </Campo>

            {/* El barrio solo aparece si alguna actividad tiene sede cargada: un
                desplegable con una única opción "Cualquiera" es ruido. */}
            {opciones.barrios.length > 0 && (
              <Campo label="Barrio" htmlFor={`${id}-barrio`}>
                <select
                  id={`${id}-barrio`}
                  className={claseInput}
                  value={filtros.barrio}
                  onChange={(e) => cambiar('barrio', e.target.value)}
                >
                  <option value="">Cualquiera</option>
                  {opciones.barrios.map((v) => (
                    <option key={v} value={v}>
                      {etiqueta('barrio', v)}
                    </option>
                  ))}
                </select>
              </Campo>
            )}

            <Campo
              label="Fechas"
              htmlFor={`${id}-cuando`}
              ayuda="«Con algo por venir» mira los encuentros no cancelados que todavía no pasaron."
            >
              <select
                id={`${id}-cuando`}
                className={claseInput}
                value={filtros.cuando}
                onChange={(e) => cambiar('cuando', e.target.value as Filtros['cuando'])}
              >
                {CUANDOS.map((c) => (
                  <option key={c} value={c}>
                    {ETIQUETA_CUANDO[c]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {puestos > 0 && (
            <button
              type="button"
              // El texto se conserva: limpiar los filtros no debería borrar lo
              // que se está buscando, que está en otro control y a la vista.
              onClick={() => onFiltros({ ...FILTROS_VACIOS, texto: filtros.texto })}
              className={`${claseBotonChip} self-start`}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
