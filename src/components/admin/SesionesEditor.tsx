import { useState } from 'react';
import {
  claseBotonFila,
  claseBotonPrimario,
  claseBotonSecundario,
  claseBotonTinta,
  claseInput,
} from '@/components/admin/campos/Campo';
import { medirFuncion } from '@/lib/analytics';
import {
  aDatetimeLocal,
  deDatetimeLocal,
  duplicarSesion,
  duracionMinutos,
  generarSesiones,
  ordenarPorInicio,
  sesionVacia,
} from '@/lib/sesiones';
import type { SesionForm } from '@/types/actividad';

interface Props {
  sesiones: SesionForm[];
  onChange: (s: SesionForm[]) => void;
  /** Los clubes de lectura muestran el campo "lectura" con más prominencia. */
  mostrarLectura?: boolean;
  error?: string;
}

/**
 * §11 — Editor de sesiones: filas dinámicas (agregar / duplicar / borrar),
 * cada una con su `id` generado al crearse.
 *
 * "Generar N encuentros semanales" ahorra mucho tipeo, pero las fechas
 * resultantes quedan editables una por una: los ciclos siempre tienen
 * excepciones (§2.2 — sin RRULE, lista explícita).
 */
export function SesionesEditor({ sesiones, onChange, mostrarLectura, error }: Props) {
  const [abrirGenerador, setAbrirGenerador] = useState(false);
  const [cantidad, setCantidad] = useState(8);
  const [cadaDias, setCadaDias] = useState(7);

  const primera = sesiones[0];
  const duracion = primera ? duracionMinutos(primera) : 120;

  const editar = (id: string, cambios: Partial<SesionForm>) =>
    onChange(sesiones.map((s) => (s.id === id ? { ...s, ...cambios } : s)));

  const agregar = () => {
    // Arranca una semana después de la última, que es el caso más común.
    const ultima = sesiones[sesiones.length - 1];
    const base = ultima ? deDatetimeLocal(ultima.inicio) : null;
    const siguiente = base ? new Date(base.getTime() + 7 * 86400_000) : new Date();
    medirFuncion('encuentro-agregar', undefined, sesiones.length + 1);
    onChange([...sesiones, sesionVacia(siguiente, duracion * 60_000)]);
  };

  /** Borra por id, nunca por índice (trampa 2). */
  const borrar = (id: string) => {
    medirFuncion('encuentro-borrar', undefined, sesiones.length - 1);
    onChange(sesiones.filter((s) => s.id !== id));
  };

  const duplicar = (id: string) => {
    const s = sesiones.find((x) => x.id === id);
    if (s) medirFuncion('encuentro-duplicar', undefined, sesiones.length + 1);
    if (s) onChange([...sesiones, duplicarSesion(s, 7)]);
  };

  const generar = () => {
    const inicio = primera?.inicio ?? aDatetimeLocal(new Date());
    medirFuncion('encuentros-generar', undefined, cantidad);
    onChange(
      // `previas` para que las filas que ya existen conserven su id y su evento
      // de calendario (B-90): sin eso, regenerar un ciclo publicado borraba y
      // recreaba los ocho eventos, y con ellos los recordatorios de la gente.
      generarSesiones({ cantidad, inicio, duracionMinutos: duracion, cadaDias, previas: sesiones }),
    );
    setAbrirGenerador(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button type="button" onClick={agregar} className={claseBotonTinta}>
          + Agregar encuentro
        </button>
        <button
          type="button"
          onClick={() => setAbrirGenerador((v) => !v)}
          className={claseBotonSecundario}
          aria-expanded={abrirGenerador}
        >
          Generar N encuentros…
        </button>
        <button
          type="button"
          onClick={() => {
            medirFuncion('encuentros-ordenar', undefined, sesiones.length);
            onChange(ordenarPorInicio(sesiones));
          }}
          className={claseBotonSecundario}
          disabled={sesiones.length < 2}
        >
          Ordenar por fecha
        </button>
        <span className="text-xs text-tinta/50 sm:ml-auto">
          {sesiones.length} {sesiones.length === 1 ? 'encuentro' : 'encuentros'}
        </span>
      </div>

      {abrirGenerador && (
        <div className="rounded-md border border-acento/30 bg-acento/5 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs">
              Cantidad
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={52}
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
                className={`${claseInput} w-24`}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Cada (días)
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={cadaDias}
                onChange={(e) => setCadaDias(Number(e.target.value))}
                className={`${claseInput} w-24`}
              />
            </label>
            <button
              type="button"
              onClick={generar}
              className={`${claseBotonPrimario} w-full sm:w-auto`}
            >
              Generar
            </button>
          </div>
          <p className="mt-2 text-xs text-tinta/60">
            Recalcula las fechas de la lista actual y borra los temas y lecturas
            ya cargados. Toma la fecha y duración del primer encuentro como base
            — después ajustás las excepciones una por una.
            {sesiones.some((s) => s.calendarEventId) && (
              <>
                {' '}
                Los encuentros que ya están en el calendario se mueven de fecha:
                no se borran ni se vuelven a crear, así que quien se suscribió los
                conserva.
              </>
            )}
          </p>
        </div>
      )}

      {error && (
        <p data-campo-con-error className="scroll-mt-16 text-xs font-medium text-acento">
          {error}
        </p>
      )}

      {sesiones.length === 0 && (
        <p className="rounded-md border border-dashed border-borde px-3 py-6 text-center text-sm text-tinta/50">
          Todavía no hay encuentros.
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {sesiones.map((s, i) => (
          <li
            key={s.id}
            className={`rounded-md border p-3 ${
              s.cancelada ? 'border-borde bg-black/[0.03] opacity-60' : 'border-borde bg-white'
            }`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-serif text-sm font-semibold text-tinta/70">
                Encuentro {i + 1}
              </span>
              {s.calendarEventId && (
                <span
                  className="rounded-full bg-tinta/10 px-2 py-0.5 text-[11px] text-tinta/60"
                  title={`Evento de Calendar: ${s.calendarEventId}`}
                >
                  en Calendar
                </span>
              )}
              <div className="ml-auto flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => duplicar(s.id)}
                  className={`${claseBotonFila} text-tinta/60 hover:bg-black/5`}
                >
                  Duplicar
                </button>
                <button
                  type="button"
                  onClick={() => borrar(s.id)}
                  aria-label={`Borrar encuentro ${s.inicio || ''}`}
                  className={`${claseBotonFila} text-acento hover:bg-acento/10`}
                >
                  Borrar
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs">
                Inicio
                <input
                  type="datetime-local"
                  value={s.inicio}
                  onChange={(e) => editar(s.id, { inicio: e.target.value })}
                  className={claseInput}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Fin
                <input
                  type="datetime-local"
                  value={s.fin}
                  onChange={(e) => editar(s.id, { fin: e.target.value })}
                  className={claseInput}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Tema
                <input
                  value={s.tema}
                  onChange={(e) => editar(s.id, { tema: e.target.value })}
                  placeholder="Ejercicio de voz"
                  className={claseInput}
                />
              </label>
              {mostrarLectura !== false && (
                <label className="flex flex-col gap-1 text-xs">
                  Lectura asignada
                  <input
                    value={s.lectura}
                    onChange={(e) => editar(s.id, { lectura: e.target.value })}
                    placeholder="Cap. 1-4"
                    className={claseInput}
                  />
                </label>
              )}
            </div>

            <label className="mt-2 flex items-center gap-2 text-xs text-tinta/70">
              <input
                type="checkbox"
                checked={s.cancelada}
                onChange={(e) => editar(s.id, { cancelada: e.target.checked })}
              />
              Cancelado — se borra del calendario público (§7.3)
            </label>
          </li>
        ))}
      </ol>
    </div>
  );
}
