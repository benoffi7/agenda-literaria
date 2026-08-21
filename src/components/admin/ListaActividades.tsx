import { useEffect, useMemo, useState } from 'react';
import {
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
} from '@/components/admin/campos/Campo';
import { MenuAcciones } from '@/components/admin/MenuAcciones';
import { borrarActividad, documentoAForm, listarActividades } from '@/lib/actividades';
import { duplicarActividadForm } from '@/lib/duplicar';
import { normalize } from '@/lib/normalize';
import type { ActividadConId, ActividadForm } from '@/types/actividad';

interface Props {
  onEditar: (a: ActividadConId) => void;
  onNueva: () => void;
  /** Abre el formulario con una copia lista para editar y guardar como nueva. */
  onDuplicar: (copia: ActividadForm, tituloOrigen: string) => void;
  /** Cambia cuando se guarda algo, para refrescar el listado. */
  version: number;
}

const COLOR_ESTADO: Record<string, string> = {
  borrador: 'bg-tinta/10 text-tinta/70',
  pendiente: 'bg-amber-100 text-amber-800',
  publicado: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-acento/10 text-acento',
};

export function ListaActividades({ onEditar, onNueva, onDuplicar, version }: Props) {
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

  /**
   * B-11 — la copia se arma acá porque el listado ya tiene todos los slugs en
   * memoria: alcanza para proponer uno libre sin ir a Firestore. La guarda real
   * contra el choque sigue siendo `slugDisponible` en el submit.
   */
  const duplicar = (a: ActividadConId) => {
    const copia = duplicarActividadForm(documentoAForm(a), {
      tomados: actividades.map((x) => x.slug),
    });
    onDuplicar(copia, a.titulo);
  };

  const eliminar = async (a: ActividadConId) => {
    if (!confirm(`¿Borrar «${a.titulo}»? No se puede deshacer.`)) return;
    await borrarActividad(a.id);
    setActividades((as) => as.filter((x) => x.id !== a.id));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          className={`${claseInput} sm:max-w-xs`}
          placeholder="Buscar…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <button
          type="button"
          onClick={onNueva}
          className={`${claseBotonPrimario} w-full sm:ml-auto sm:w-auto`}
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
            className="rounded-md border border-borde bg-white px-3 py-2.5 sm:flex sm:items-center sm:gap-3"
          >
            <div className="flex min-w-0 items-start gap-2 sm:flex-1">
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif font-semibold">{a.titulo}</p>
                <p className="text-xs text-tinta/55">
                  {a.tipo} · {a.sesiones?.length ?? 0}{' '}
                  {(a.sesiones?.length ?? 0) === 1 ? 'encuentro' : 'encuentros'}
                  {a.sede?.barrio ? ` · ${a.sede.barrio}` : ''}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${COLOR_ESTADO[a.estado] ?? ''}`}
              >
                {a.estado}
              </span>
            </div>
            {/*
              Duplicar y borrar van en un menú y no en la fila: tres botones en
              360px dan blancos de ~100px y se erra el toque. Ver MenuAcciones.
            */}
            <div className="mt-2 flex gap-2 sm:mt-0 sm:shrink-0">
              <button
                type="button"
                onClick={() => onEditar(a)}
                className={`${claseBotonSecundario} flex-1 sm:flex-none`}
              >
                Editar
              </button>
              <MenuAcciones
                etiqueta={`Más acciones de ${a.titulo}`}
                acciones={[
                  { label: 'Duplicar', onSelect: () => duplicar(a) },
                  { label: 'Borrar', onSelect: () => void eliminar(a), peligrosa: true },
                ]}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
