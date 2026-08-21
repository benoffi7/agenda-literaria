import { useEffect, useMemo, useState } from 'react';
import { claseInput } from '@/components/admin/campos/Campo';
import { borrarActividad, listarActividades } from '@/lib/actividades';
import { normalize } from '@/lib/normalize';
import type { ActividadConId } from '@/types/actividad';

interface Props {
  onEditar: (a: ActividadConId) => void;
  onNueva: () => void;
  /** Cambia cuando se guarda algo, para refrescar el listado. */
  version: number;
}

const COLOR_ESTADO: Record<string, string> = {
  borrador: 'bg-tinta/10 text-tinta/70',
  pendiente: 'bg-amber-100 text-amber-800',
  publicado: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-acento/10 text-acento',
};

export function ListaActividades({ onEditar, onNueva, version }: Props) {
  const [actividades, setActividades] = useState<ActividadConId[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    listarActividades()
      .then((as) => vivo && setActividades(as))
      .catch((e: unknown) => vivo && setFallo(e instanceof Error ? e.message : 'Error al listar'))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [version]);

  // Misma normalización que el sitio público (§6).
  const filtradas = useMemo(() => {
    const q = normalize(busqueda.trim());
    if (!q) return actividades;
    return actividades.filter((a) => (a.searchText ?? '').includes(q));
  }, [actividades, busqueda]);

  const eliminar = async (a: ActividadConId) => {
    if (!confirm(`¿Borrar «${a.titulo}»? No se puede deshacer.`)) return;
    await borrarActividad(a.id);
    setActividades((as) => as.filter((x) => x.id !== a.id));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${claseInput} max-w-xs`}
          placeholder="Buscar…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <button
          type="button"
          onClick={onNueva}
          className="ml-auto rounded-md bg-acento px-4 py-2 text-sm text-white"
        >
          + Nueva actividad
        </button>
      </div>

      {cargando && <p className="text-sm text-tinta/50">Cargando…</p>}
      {fallo && (
        <p className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento">
          {fallo}
        </p>
      )}

      {!cargando && filtradas.length === 0 && (
        <p className="rounded-md border border-dashed border-borde px-3 py-10 text-center text-sm text-tinta/50">
          {actividades.length === 0 ? 'Todavía no hay actividades.' : 'Nada coincide con la búsqueda.'}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {filtradas.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center gap-3 rounded-md border border-borde bg-white px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif font-semibold">{a.titulo}</p>
              <p className="text-xs text-tinta/55">
                {a.tipo} · {a.sesiones?.length ?? 0}{' '}
                {(a.sesiones?.length ?? 0) === 1 ? 'encuentro' : 'encuentros'}
                {a.sede?.barrio ? ` · ${a.sede.barrio}` : ''}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${COLOR_ESTADO[a.estado] ?? ''}`}
            >
              {a.estado}
            </span>
            <button
              type="button"
              onClick={() => onEditar(a)}
              className="rounded-md border border-borde px-3 py-1.5 text-sm"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => void eliminar(a)}
              className="rounded px-2 py-1 text-xs text-acento hover:bg-acento/10"
            >
              Borrar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
